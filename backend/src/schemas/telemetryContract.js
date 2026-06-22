export const operationalStatuses = new Set(["normal", "warning", "critical", "hardware_fault"]);

export function validateTelemetryPayload(payload) {
  const errors = [];
  const data = payload && typeof payload === "object" ? payload : {};
  const allowedFields = new Set(["device_id", "ward_id", "flow_rate", "operational_status", "timestamp"]);

  Object.keys(data).forEach(key => {
    if (!allowedFields.has(key)) errors.push(`Unknown field: ${key}`);
  });

  allowedFields.forEach(key => {
    if (!(key in data)) errors.push(`Missing required field: ${key}`);
  });

  if (typeof data.device_id !== "string" || !/^[A-Z]{2}\d{3}$/.test(data.device_id)) {
    errors.push("device_id must match two uppercase letters followed by three digits, for example TK001");
  }

  if (typeof data.ward_id !== "string" || !data.ward_id.trim()) {
    errors.push("ward_id must be a non-empty string");
  }

  if (typeof data.flow_rate !== "number" || !Number.isFinite(data.flow_rate) || data.flow_rate < 0 || data.flow_rate > 100) {
    errors.push("flow_rate must be a number from 0.0 to 100.0");
  }

  if (typeof data.operational_status !== "string" || !operationalStatuses.has(data.operational_status)) {
    errors.push("operational_status must be normal, warning, critical, or hardware_fault");
  }

  if (typeof data.timestamp !== "string" || Number.isNaN(Date.parse(data.timestamp))) {
    errors.push("timestamp must be an ISO-8601 string");
  }

  return { ok: errors.length === 0, errors };
}
