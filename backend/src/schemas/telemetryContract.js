export const operationalStatuses = new Set(["normal", "warning", "critical", "hardware_fault"]);
export const cylinderStatuses = new Set(["IN_USE", "REPLACED"]);

export function validateTelemetryPayload(payload) {
  const errors = [];
  const data = payload && typeof payload === "object" ? payload : {};
  const requiredFields = new Set(["device_id", "ward_id", "flow_rate", "operational_status", "timestamp"]);
  const cylinderFields = ["cylinder_capacity", "consumed_volume", "cylinder_status"];
  const allowedFields = new Set([...requiredFields, ...cylinderFields, "breathing_variance", "emr_status"]);

  Object.keys(data).forEach(key => {
    if (!allowedFields.has(key)) errors.push(`Unknown field: ${key}`);
  });

  requiredFields.forEach(key => {
    if (!(key in data)) errors.push(`Missing required field: ${key}`);
  });

  const hasCylinderData = cylinderFields.some(key => key in data);
  if (hasCylinderData) {
    cylinderFields.forEach(key => {
      if (!(key in data)) errors.push(`Missing required cylinder field: ${key}`);
    });
  }

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

  if (hasCylinderData) {
    if (typeof data.cylinder_capacity !== "number" || !Number.isFinite(data.cylinder_capacity) || data.cylinder_capacity <= 0) {
      errors.push("cylinder_capacity must be a number greater than 0");
    }
    if (typeof data.consumed_volume !== "number" || !Number.isFinite(data.consumed_volume) || data.consumed_volume < 0) {
      errors.push("consumed_volume must be a number greater than or equal to 0");
    } else if (Number.isFinite(data.cylinder_capacity) && data.consumed_volume > data.cylinder_capacity) {
      errors.push("consumed_volume must not exceed cylinder_capacity");
    }
    if (typeof data.cylinder_status !== "string" || !cylinderStatuses.has(data.cylinder_status)) {
      errors.push("cylinder_status must be IN_USE or REPLACED");
    }
  }

  if (
    "breathing_variance" in data
    && (typeof data.breathing_variance !== "number" || !Number.isFinite(data.breathing_variance) || data.breathing_variance < 0)
  ) {
    errors.push("breathing_variance must be a number greater than or equal to 0");
  }

  if ("emr_status" in data && (typeof data.emr_status !== "string" || !data.emr_status.trim())) {
    errors.push("emr_status must be a non-empty string");
  }

  return { ok: errors.length === 0, errors };
}
