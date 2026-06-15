import { validateTelemetryPayload } from "../schemas/telemetryContract.js";

const alertSeverities = new Set(["High", "Medium", "Low"]);

export function ingestTelemetry(db, payload) {
  const validation = validateTelemetryPayload(payload);
  if (!validation.ok) return validation;

  ensureWard(db, payload.ward_id);
  ensureDevice(db, payload.device_id, payload.ward_id);

  const telemetry_log = {
    log_id: db.nextLogId++,
    device_id: payload.device_id,
    ward_id: payload.ward_id,
    flow_rate: Number(payload.flow_rate.toFixed(2)),
    operational_status: payload.operational_status,
    device_timestamp: payload.timestamp,
    received_at: new Date().toISOString()
  };

  db.telemetry_logs.push(telemetry_log);

  const alert = evaluateAlert(db, telemetry_log);
  if (alert) db.alerts.push(alert);

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
  let severity = "Low";

  if (log.operational_status === "hardware_fault") {
    alert_type = "hardware_fault";
    severity = "High";
  } else if (log.operational_status === "critical") {
    alert_type = "critical_flow";
    severity = "High";
  } else if (log.operational_status === "warning" || log.flow_rate >= 30) {
    alert_type = log.flow_rate >= 30 ? "high_flow" : "warning";
    severity = log.flow_rate >= 50 ? "High" : "Medium";
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

function ensureWard(db, wardId) {
  if (db.wards.some(ward => ward.ward_id === wardId)) return;
  db.wards.push({ ward_id: wardId, ward_name: wardId, location: null });
}

function ensureDevice(db, deviceId, wardId) {
  if (db.devices.some(device => device.device_id === deviceId)) return;
  db.devices.push({ device_id: deviceId, ward_id: wardId, created_at: new Date().toISOString() });
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
