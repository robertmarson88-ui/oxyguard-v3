import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { randomUUID } from "node:crypto";

await loadLocalEnv();

const port = Number(process.env.PORT || 4180);
const root = process.cwd();
const nurseStationDataPath = join(process.env.USERPROFILE || "C:\\Users\\twcl.ssa", "Desktop", "data.txt");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};
const operationalStatuses = new Set(["normal", "warning", "critical", "hardware_fault"]);
const alertSeverities = new Set(["High", "Medium", "Low"]);
const sessions = new Map();
const db = createRelationalStore();

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === "/api/nurse-station") {
      const body = await readFile(nurseStationDataPath, "utf8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(parseNurseStationData(body)));
      return;
    }

    if (await handleApi(req, res, url)) return;

    const target = normalize(join(root, url.pathname === "/" ? "index.html" : url.pathname));
    if (!target.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, { "content-type": types[extname(target)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`OxyGuard web dashboard running at http://127.0.0.1:${port}`);
});

async function handleApi(req, res, url) {
  const path = url.pathname;
  const apiPath = path.startsWith("/api/v1") ? path.slice("/api/v1".length) || "/" : path.startsWith("/api") ? path.slice("/api".length) || "/" : "";
  if (!apiPath) return false;

  if (req.method === "GET" && apiPath === "/health") {
    sendJson(res, 200, { status: "healthy" });
    return true;
  }

  if (req.method === "POST" && apiPath === "/login") {
    await login(req, res, path.startsWith("/api/v1"));
    return true;
  }

  if (req.method === "POST" && apiPath === "/telemetry") {
    await ingestTelemetry(req, res);
    return true;
  }

  if (req.method === "GET" && apiPath === "/devices") {
    const auth = requireSession(req, res);
    if (!auth) return true;
    sendJson(res, 200, getDeviceInventory());
    return true;
  }

  if (req.method === "GET" && apiPath === "/telemetry") {
    const auth = requireSession(req, res);
    if (!auth) return true;
    sendJson(res, 200, queryTelemetry(url));
    return true;
  }

  if (req.method === "GET" && apiPath === "/alerts") {
    const auth = requireSession(req, res);
    if (!auth) return true;
    sendJson(res, 200, db.alerts);
    return true;
  }

  const resolveMatch = apiPath.match(/^\/alerts\/(\d+)\/resolve$/);
  if (req.method === "POST" && resolveMatch) {
    const auth = requireSession(req, res);
    if (!auth) return true;
    resolveAlert(res, Number(resolveMatch[1]), auth.user);
    return true;
  }

  if (req.method === "GET" && apiPath === "/reports") {
    const auth = requireSession(req, res);
    if (!auth) return true;
    sendJson(res, 200, buildReportSummary());
    return true;
  }

  if (path.startsWith("/api/")) {
    sendJson(res, 404, { ok: false, message: "API route not found." });
    return true;
  }

  return false;
}

async function login(req, res, apiV1) {
  const { username, password } = await readJson(req);
  const normalizedUsername = String(username || "").trim();
  const user = db.users.find(item => item.username === normalizedUsername);

  if (!user || user.password !== password) {
    sendJson(res, 401, { ok: false, message: "Invalid username or password." });
    return;
  }

  const role = db.roles.find(item => item.role_id === user.role_id);
  const token = issueToken(user);
  const isAdministrator = role.role_name === "Administrator";
  const sessionUser = {
    username: normalizedUsername,
    role: isAdministrator ? "admin" : "viewer",
    label: role.role_name
  };

  if (apiV1) {
    sendJson(res, 200, {
      access_token: token,
      token_type: "bearer",
      user: sessionUser
    });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    access_token: token,
    token_type: "bearer",
    user: sessionUser
  });
}

async function ingestTelemetry(req, res) {
  const payload = await readJson(req);
  const validation = validateTelemetryPayload(payload);
  if (!validation.ok) {
    sendJson(res, 400, { ok: false, errors: validation.errors });
    return;
  }

  ensureWard(payload.ward_id);
  ensureDevice(payload.device_id, payload.ward_id);

  const log = {
    log_id: db.nextLogId++,
    device_id: payload.device_id,
    ward_id: payload.ward_id,
    flow_rate: Number(payload.flow_rate.toFixed(2)),
    operational_status: payload.operational_status,
    device_timestamp: payload.timestamp,
    received_at: new Date().toISOString()
  };
  db.telemetry_logs.push(log);

  const alert = evaluateAlert(log);
  if (alert) db.alerts.push(alert);

  sendJson(res, 201, { ok: true, telemetry_log: log, alert_created: Boolean(alert), alert });
}

function validateTelemetryPayload(payload) {
  const errors = [];
  const data = payload && typeof payload === "object" ? payload : {};
  const allowedFields = new Set(["device_id", "ward_id", "flow_rate", "operational_status", "timestamp"]);
  const requiredFields = [...allowedFields];
  Object.keys(data).forEach(key => {
    if (!allowedFields.has(key)) errors.push(`Unknown field: ${key}`);
  });
  requiredFields.forEach(key => {
    if (!(key in data)) errors.push(`Missing required field: ${key}`);
  });

  if (typeof data.device_id !== "string" || !/^ESP32-[A-Z0-9-]+$/.test(data.device_id)) {
    errors.push("device_id must match ^ESP32-[A-Z0-9-]+$");
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

function evaluateAlert(log) {
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

function requireSession(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const session = sessions.get(token);
  if (!session) {
    sendJson(res, 401, { ok: false, message: "Missing or invalid bearer token." });
    return null;
  }
  return session;
}

function issueToken(user) {
  const token = randomUUID();
  sessions.set(token, { user, issued_at: new Date().toISOString() });
  return token;
}

function resolveAlert(res, alertId, user) {
  const role = db.roles.find(item => item.role_id === user.role_id);
  if (!role || role.role_name !== "Administrator") {
    sendJson(res, 403, { ok: false, message: "Session lacks resolve_alert permission." });
    return;
  }

  const alert = db.alerts.find(item => item.alert_id === alertId);
  if (!alert) {
    sendJson(res, 404, { ok: false, message: "Alert not found." });
    return;
  }

  alert.is_resolved = true;
  alert.resolved_by = user.user_id;
  alert.resolved_at = new Date().toISOString();
  db.audit_logs.push({
    audit_id: db.nextAuditId++,
    user_id: user.user_id,
    action: "Resolve Alert",
    target: `Alert #${alert.alert_id}`,
    performed_at: new Date().toISOString()
  });

  sendJson(res, 200, { ok: true, alert });
}

function getDeviceInventory() {
  return db.devices.map(device => {
    const logs = db.telemetry_logs.filter(log => log.device_id === device.device_id);
    const latest = logs.at(-1);
    return {
      device_id: device.device_id,
      device_name: `${device.ward_id} Monitor`,
      ward_id: device.ward_id,
      device_status: latest?.operational_status === "hardware_fault" ? "hardware_fault" : "active",
      last_seen: latest?.received_at || device.created_at,
      created_at: device.created_at
    };
  });
}

function queryTelemetry(url) {
  const deviceId = url.searchParams.get("device_id");
  const limit = clampNumber(Number(url.searchParams.get("limit") || 100), 1, 500);
  return db.telemetry_logs
    .filter(log => !deviceId || log.device_id === deviceId)
    .slice(-limit)
    .reverse();
}

function buildReportSummary() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    total_monitored_devices: db.devices.length,
    active_unresolved_alerts: db.alerts.filter(alert => !alert.is_resolved).length,
    critical_system_incidents_today: db.alerts.filter(alert => alert.severity === "High" && alert.created_at.startsWith(today)).length,
    uptime_percentage: 99.45
  };
}

function ensureWard(wardId) {
  if (db.wards.some(ward => ward.ward_id === wardId)) return;
  db.wards.push({ ward_id: wardId, ward_name: wardId, location: null });
}

function ensureDevice(deviceId, wardId) {
  if (db.devices.some(device => device.device_id === deviceId)) return;
  db.devices.push({ device_id: deviceId, ward_id: wardId, created_at: new Date().toISOString() });
}

function createRelationalStore() {
  const now = new Date().toISOString();
  const store = {
    roles: [
      { role_id: 1, role_name: "Administrator" },
      { role_id: 2, role_name: "Executive / CFO" },
      { role_id: 3, role_name: "Facilities Manager" },
      { role_id: 4, role_name: "Nurse Manager" },
      { role_id: 5, role_name: "Nurse" }
    ],
    permissions: [
      { permission_id: 1, permission_name: "resolve_alert" },
      { permission_id: 2, permission_name: "view_logs" }
    ],
    role_permissions: [
      { role_id: 1, permission_id: 1 },
      { role_id: 1, permission_id: 2 },
      { role_id: 2, permission_id: 2 },
      { role_id: 3, permission_id: 2 },
      { role_id: 4, permission_id: 1 },
      { role_id: 4, permission_id: 2 },
      { role_id: 5, permission_id: 2 }
    ],
    users: [
      createUser(1, "user1", "password1", process.env.OXYGUARD_AUTH_EMAIL || "robertmarson88@gmail.com", 1),
      createUser(2, "user2", "password2", process.env.OXYGUARD_AUTH_EMAIL || "robertmarson88@gmail.com", 1),
      createUser(3, "vernon", "vernon1", "vernon.dacosta@gmail.com", 1),
      createUser(4, "martin", "martin1", "robinsonmartin187@gmail.com", 1)
    ],
    wards: [
      { ward_id: "AE-WARD", ward_name: "A&E Ward", location: "Emergency" },
      { ward_id: "NURSE-STATION", ward_name: "Nurse Station", location: "Central Desk" },
      { ward_id: "PAEDIATRIC", ward_name: "Paediatric Ward", location: "East Wing" },
      { ward_id: "RECOVERY", ward_name: "Recovery Bay", location: "Post-care" },
      { ward_id: "LABOUR", ward_name: "Labour Ward", location: "Maternity" }
    ],
    devices: [
      { device_id: "ESP32-AE-WARD", ward_id: "AE-WARD", created_at: now },
      { device_id: "ESP32-NURSE-STATION", ward_id: "NURSE-STATION", created_at: now },
      { device_id: "ESP32-PAEDIATRIC", ward_id: "PAEDIATRIC", created_at: now },
      { device_id: "ESP32-RECOVERY", ward_id: "RECOVERY", created_at: now },
      { device_id: "ESP32-LABOUR", ward_id: "LABOUR", created_at: now }
    ],
    telemetry_logs: [],
    alerts: [],
    audit_logs: [],
    nextLogId: 1,
    nextAlertId: 1,
    nextAuditId: 1
  };
  return store;
}

function createUser(user_id, username, password, email, role_id) {
  return {
    user_id,
    username,
    email,
    email_verified: true,
    password,
    password_hash: `demo-hash:${username}`,
    role_id,
    created_at: new Date().toISOString()
  };
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function loadLocalEnv() {
  try {
    const body = await readFile(join(process.cwd(), ".env"), "utf8");
    body.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separator = trimmed.indexOf("=");
      if (separator === -1) return;
      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      if (!key || process.env[key]) return;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    });
  } catch {
    // .env is optional; the server also accepts normal environment variables.
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function parseNurseStationData(body) {
  const data = {
    flowRate: 7,
    pressure: 48,
    volumeRemaining: 960,
    stationFlowRate: 7,
    occupied: true,
    active: true
  };

  body.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [rawKey, rawValue] = trimmed.split("=");
    if (!rawKey || rawValue === undefined) return;
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (["flowRate", "pressure", "volumeRemaining", "stationFlowRate"].includes(key)) {
      data[key] = Number(value);
    } else if (["active", "occupied"].includes(key)) {
      data[key] = value.toLowerCase() === "true";
    }
  });

  if (!Number.isFinite(data.stationFlowRate)) data.stationFlowRate = data.flowRate;
  return data;
}
