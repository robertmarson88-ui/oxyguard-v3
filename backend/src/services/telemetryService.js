import { validateTelemetryPayload } from "../schemas/telemetryContract.js";

const alertSeverities = new Set(["high", "medium", "low", "critical"]);

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
    received_at: new Date().toISOString()
  };

  if (db.pgPool) {
    telemetry_log = await insertTelemetryLog(db, telemetry_log);
  }

  db.telemetry_logs.push(telemetry_log);

  const alert = evaluateAlert(db, telemetry_log);
  if (alert) {
    const persistedAlert = db.pgPool ? await insertAlert(db, alert, telemetry_log.log_id) : alert;
    db.alerts.push(persistedAlert);
  }

  return { ok: true, telemetry_log, alert };
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

function evaluateAlert(db, log) {
  let alert_type = "";
  let severity = "low";

  if (log.operational_status === "hardware_fault") {
    alert_type = "hardware_fault";
    severity = "high";
  } else if (log.operational_status === "critical") {
    alert_type = "critical_flow";
    severity = "critical";
  } else if (log.operational_status === "warning" || log.flow_rate >= 30) {
    alert_type = log.flow_rate >= 30 ? "high_flow" : "warning";
    severity = log.flow_rate >= 50 ? "high" : "medium";
  }

  if (!alert_type || !alertSeverities.has(severity)) return null;

  return {
    alert_id: db.nextAlertId++,
    device_id: log.device_id,
    alert_type,
    severity,
    is_resolved: false,
    resolved_by: null,
    resolved_at: null,
    created_at: new Date().toISOString()
  };
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
  if (existingDevice) {
    existingDevice.ward_id = wardId;
  } else {
    db.devices.push({ device_id: deviceId, ward_id: wardId, created_at: now });
  }

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
  const result = await db.pgPool.query(
    `insert into public.telemetry_logs
      (device_id, ward_id, flow_rate, operational_status, device_timestamp, received_at)
     values ($1, $2, $3, $4, $5, $6)
     returning log_id, device_id, ward_id, flow_rate, operational_status, device_timestamp, received_at`,
    [log.device_id, log.ward_id, log.flow_rate, log.operational_status, log.device_timestamp, log.received_at]
  );
  return result.rows[0];
}

async function insertAlert(db, alert, logId) {
  const result = await db.pgPool.query(
    `insert into public.alerts
      (log_id, device_id, alert_type, severity, is_resolved, resolved_by, resolved_at, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning alert_id, log_id, device_id, alert_type, severity, is_resolved, resolved_by, resolved_at, created_at`,
    [logId, alert.device_id, alert.alert_type, alert.severity, alert.is_resolved, alert.resolved_by, alert.resolved_at, alert.created_at]
  );
  return result.rows[0];
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
