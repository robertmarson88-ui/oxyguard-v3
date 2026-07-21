import { validateTelemetryPayload } from "../schemas/telemetryContract.js";

const alertSeverities = new Set(["high", "medium", "low", "critical"]);
const OXYGEN_COST_PER_LITRE = 1.51;
const RESIDUAL_GAS_RECOMMENDATION = "Review cylinder replacement procedures.";
const GHOST_FLOW_RECOMMENDATION = "Verify patient occupancy and close oxygen supply.";
const UNAUTHORIZED_BED_RECOMMENDATION = "Verify patient assignment and investigate oxygen usage.";
const UNAUTHORIZED_EMR_STATUSES = new Set(["EMPTY", "DISCHARGED", "TRANSFERRED", "UNASSIGNED"]);
const MINIMUM_RULE_DURATION_MINUTES = 10;

export async function ingestTelemetry(db, payload) {
  const validation = validateTelemetryPayload(payload);
  if (!validation.ok) return validation;

  await ensureWard(db, payload.ward_id);
  await ensureDevice(db, payload.device_id, payload.ward_id);

  let telemetry_log = {
    log_id: db.nextLogId++,
    device_id: payload.device_id,
    ward_id: payload.ward_id,
    flow_rate: Number(payload.flow_rate.toFixed(2)),
    operational_status: payload.operational_status,
    device_timestamp: payload.timestamp,
    received_at: new Date().toISOString(),
    ...(payload.cylinder_capacity !== undefined ? {
      cylinder_capacity: Number(payload.cylinder_capacity.toFixed(2)),
      consumed_volume: Number(payload.consumed_volume.toFixed(2)),
      cylinder_status: payload.cylinder_status
    } : {}),
    ...(payload.breathing_variance !== undefined ? {
      breathing_variance: Number(payload.breathing_variance.toFixed(6))
    } : {}),
    ...(payload.emr_status !== undefined ? {
      emr_status: payload.emr_status.trim().toUpperCase()
    } : {})
  };

  if (db.pgPool) telemetry_log = await insertTelemetryLog(db, telemetry_log);
  db.telemetry_logs.push(telemetry_log);

  const generatedAlerts = evaluateAlerts(db, telemetry_log);
  const alerts = [];
  for (const generatedAlert of generatedAlerts) {
    const alert = db.pgPool ? await insertAlert(db, generatedAlert, telemetry_log.log_id) : generatedAlert;
    db.alerts.push(alert);
    alerts.push(alert);
  }

  return { ok: true, telemetry_log, alert: alerts[0] || null, alerts };
}

export function queryTelemetry(db, url) {
  const deviceId = url.searchParams.get("device_id");
  const wardId = url.searchParams.get("ward_id");
  const limit = clampNumber(Number(url.searchParams.get("limit") || 100), 1, 500);

  return db.telemetry_logs
    .filter(log => (!deviceId || log.device_id === deviceId) && (!wardId || log.ward_id === wardId))
    .slice(-limit)
    .reverse();
}

function evaluateAlerts(db, log) {
  const alerts = [];
  if (log.cylinder_status === "REPLACED" && log.consumed_volume > (0.9 * log.cylinder_capacity)) {
    const remainingVolume = round(log.cylinder_capacity - log.consumed_volume, 2);
    const unusedPercentage = round(remainingVolume / log.cylinder_capacity, 6);
    const financialLoss = round(remainingVolume * OXYGEN_COST_PER_LITRE, 2);
    alerts.push(createAlert(db, log, "residual_gas_waste", "medium", {
      remaining_volume: remainingVolume,
      unused_percentage: unusedPercentage,
      estimated_oxygen_waste: remainingVolume,
      estimated_financial_loss: financialLoss,
      potential_savings: financialLoss,
      recommended_action: RESIDUAL_GAS_RECOMMENDATION
    }));
  }

  const ghostFlowDuration = continuousQualifyingDuration(db, log, sample => (
    sample.flow_rate > 0.5 && sample.breathing_variance < 0.01
  ));
  if (ghostFlowDuration > MINIMUM_RULE_DURATION_MINUTES && !hasActiveAlert(db, log.device_id, "ghost_flow")) {
    alerts.push(createAlert(db, log, "ghost_flow", "high", {
      recommended_action: GHOST_FLOW_RECOMMENDATION
    }));
  }

  const unauthorizedBedDuration = continuousQualifyingDuration(db, log, sample => (
    UNAUTHORIZED_EMR_STATUSES.has(String(sample.emr_status || "").toUpperCase())
    && sample.flow_rate >= 2.0
  ));
  if (unauthorizedBedDuration > MINIMUM_RULE_DURATION_MINUTES && !hasActiveAlert(db, log.device_id, "unauthorized_bed_usage")) {
    alerts.push(createAlert(db, log, "unauthorized_bed_usage", "high", {
      recommended_action: UNAUTHORIZED_BED_RECOMMENDATION
    }));
  }

  if (log.operational_status === "hardware_fault") {
    alerts.push(createAlert(db, log, "hardware_fault", "high"));
  } else if (log.operational_status === "critical") {
    alerts.push(createAlert(db, log, "critical_flow", "critical"));
  } else if (log.operational_status === "warning" || log.flow_rate >= 30) {
    const alertType = log.flow_rate >= 30 ? "high_flow" : "warning";
    const severity = log.flow_rate >= 50 ? "high" : "medium";
    alerts.push(createAlert(db, log, alertType, severity));
  }
  return alerts;
}

function createAlert(db, log, alertType, severity, details = {}) {
  if (!alertType || !alertSeverities.has(severity)) return null;
  return {
    alert_id: db.nextAlertId++,
    device_id: log.device_id,
    alert_type: alertType,
    severity,
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date().toISOString(),
    ...details
  };
}

function continuousQualifyingDuration(db, log, qualifies) {
  const currentTime = Date.parse(log.device_timestamp);
  if (!Number.isFinite(currentTime) || !qualifies(log)) return 0;
  const samples = db.telemetry_logs
    .filter(sample => sample.device_id === log.device_id && Date.parse(sample.device_timestamp) <= currentTime)
    .sort((left, right) => Date.parse(right.device_timestamp) - Date.parse(left.device_timestamp));
  let earliestQualifyingTime = currentTime;
  for (const sample of samples) {
    const sampleTime = Date.parse(sample.device_timestamp);
    if (!Number.isFinite(sampleTime) || !qualifies(sample)) break;
    earliestQualifyingTime = sampleTime;
  }
  return (currentTime - earliestQualifyingTime) / 60000;
}

function hasActiveAlert(db, deviceId, alertType) {
  return db.alerts.some(alert => (
    alert.device_id === deviceId && alert.alert_type === alertType && !alert.is_resolved
  ));
}

async function ensureWard(db, wardId) {
  if (db.wards.some(ward => ward.ward_id === wardId)) return;
  db.wards.push({ ward_id: wardId, ward_name: wardId, location: null });
  if (!db.pgPool) return;
  await db.pgPool.query(
    `insert into public.wards (ward_id, ward_name, location)
     values ($1, $2, $3)
     on conflict (ward_id) do nothing`,
    [wardId, wardId, "Simulator source"]
  );
}

async function ensureDevice(db, deviceId, wardId) {
  const now = new Date().toISOString();
  const existingDevice = db.devices.find(device => device.device_id === deviceId);
  if (existingDevice) existingDevice.ward_id = wardId;
  else db.devices.push({ device_id: deviceId, ward_id: wardId, created_at: now });
  if (!db.pgPool) return;
  await db.pgPool.query(
    `insert into public.devices (device_id, ward_id, created_at, device_name, device_status, last_seen)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (device_id) do update set
       ward_id = excluded.ward_id,
       device_status = excluded.device_status,
       last_seen = excluded.last_seen`,
    [deviceId, wardId, now, `${deviceId} Simulator`, "active", now]
  );
}

async function insertTelemetryLog(db, log) {
  const optionalColumns = [
    ...(db.telemetry_has_cylinder_fields && log.cylinder_capacity !== undefined ? ["cylinder_capacity", "consumed_volume", "cylinder_status"] : []),
    ...(db.telemetry_has_breathing_variance && log.breathing_variance !== undefined ? ["breathing_variance"] : []),
    ...(db.telemetry_has_emr_status && log.emr_status !== undefined ? ["emr_status"] : [])
  ];
  const columns = ["device_id", "ward_id", "flow_rate", "operational_status", "device_timestamp", "received_at", ...optionalColumns];
  const values = columns.map(column => log[column]);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await db.pgPool.query(
    `insert into public.telemetry_logs (${columns.join(", ")})
     values (${placeholders})
     returning log_id, ${columns.join(", ")}`,
    values
  );
  return { ...log, ...result.rows[0] };
}

async function insertAlert(db, alert, logId) {
  const baseColumns = ["device_id", "alert_type", "severity", "is_resolved", "resolved_by", "resolved_at", "created_at"];
  const residualColumns = db.alerts_has_residual_fields && alert.alert_type === "residual_gas_waste"
    ? ["remaining_volume", "unused_percentage", "estimated_oxygen_waste", "estimated_financial_loss", "potential_savings"]
    : [];
  const recommendationColumn = db.alerts_has_recommended_action && alert.recommended_action ? ["recommended_action"] : [];
  const columns = [...(db.alerts_has_log_id ? ["log_id"] : []), ...baseColumns, ...residualColumns, ...recommendationColumn];
  const row = { log_id: logId, ...alert };
  const values = columns.map(column => row[column]);
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await db.pgPool.query(
    `insert into public.alerts (${columns.join(", ")})
     values (${placeholders})
     returning alert_id, ${columns.join(", ")}`,
    values
  );
  return { ...alert, ...result.rows[0] };
}

function round(value, decimalPlaces) {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
