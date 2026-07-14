import { createAuthService } from "../services/authService.js";
import { buildReportSummary } from "../services/reportService.js";
import { ingestTelemetry, queryTelemetry } from "../services/telemetryService.js";
import { readNurseStationData } from "../services/nurseStationService.js";
import { readJson, sendJson } from "../utils/http.js";

export function createApiHandler({ db, nurseStationDataPath }) {
  const auth = createAuthService(db);

  return async function handleApi(req, res, url) {
    const path = url.pathname;
    const apiPath = path.startsWith("/api/v1")
      ? path.slice("/api/v1".length) || "/"
      : path.startsWith("/api")
        ? path.slice("/api".length) || "/"
        : "";

    if (!apiPath) return false;

    if (req.method === "GET" && apiPath === "/health") {
      sendJson(res, 200, {
        status: "healthy",
        database: db.source || "demo",
        database_url_configured: Boolean(process.env.DATABASE_URL),
        database_error: db.connection_error || null
      });
      return true;
    }

    if (req.method === "GET" && apiPath === "/nurse-station") {
      sendJson(res, 200, await readNurseStationData(nurseStationDataPath));
      return true;
    }

    if (req.method === "POST" && apiPath === "/login") {
      await login(req, res, db, auth, path.startsWith("/api/v1"));
      return true;
    }

    if (req.method === "GET" && apiPath === "/users") {
      const session = requireAdmin(req, res, auth);
      if (!session) return true;
      sendJson(res, 200, { ok: true, users: listUsers(db) });
      return true;
    }

    if (req.method === "POST" && apiPath === "/users") {
      const session = requireAdmin(req, res, auth);
      if (!session) return true;
      await createUser(req, res, db, session.user);
      return true;
    }

    const userMatch = apiPath.match(/^\/users\/([^/]+)$/);
    if (req.method === "PATCH" && userMatch) {
      const session = requireAdmin(req, res, auth);
      if (!session) return true;
      await updateUserRole(req, res, db, decodeURIComponent(userMatch[1]), session.user);
      return true;
    }

    if (req.method === "POST" && apiPath === "/telemetry") {
      await createTelemetry(req, res, db);
      return true;
    }

    if (req.method === "GET" && apiPath === "/devices") {
      const session = requireAuthorized(req, res, auth, "view_logs");
      if (!session) return true;
      sendJson(res, 200, getDeviceInventory(db));
      return true;
    }

    if (req.method === "GET" && apiPath === "/telemetry") {
      const session = requireAuthorized(req, res, auth, "view_logs");
      if (!session) return true;
      sendJson(res, 200, queryTelemetry(db, url));
      return true;
    }

    if (req.method === "GET" && apiPath === "/alerts") {
      const session = requireAuthorized(req, res, auth, "view_logs");
      if (!session) return true;
      sendJson(res, 200, queryAlerts(db, url));
      return true;
    }

    if (req.method === "GET" && apiPath === "/audit-logs") {
      const session = requireAuthorized(req, res, auth, "view_logs");
      if (!session) return true;
      sendJson(res, 200, { ok: true, audit_logs: listAuditLogs(db) });
      return true;
    }

    const resolveMatch = apiPath.match(/^\/alerts\/(\d+)\/resolve$/);
    if (req.method === "POST" && resolveMatch) {
      const session = requireAuthorized(req, res, auth, "resolve_alert");
      if (!session) return true;
      await resolveAlert(db, res, Number(resolveMatch[1]), session.user);
      return true;
    }

    if (req.method === "GET" && apiPath === "/reports") {
      const session = requireAuthorized(req, res, auth, "view_logs");
      if (!session) return true;
      sendJson(res, 200, buildReportSummary(db));
      return true;
    }

    if (path.startsWith("/api/")) {
      sendJson(res, 404, { ok: false, message: "API route not found." });
      return true;
    }

    return false;
  };
}

async function login(req, res, db, auth, apiV1) {
  const { username, password } = await readJson(req);
  const result = auth.authenticate(username, password);

  if (!result) {
    sendJson(res, 401, { ok: false, message: "Invalid username or password." });
    return;
  }

  await addAuditLog(db, result.user, "User Login", result.user.username, getClientIp(req));

  const response = {
    access_token: result.access_token,
    token_type: "bearer",
    role: result.role,
    user: result.user
  };

  sendJson(res, 200, apiV1 ? response : { ok: true, ...response });
}

async function createTelemetry(req, res, db) {
  let result;
  try {
    const payload = await readJson(req);
    result = await ingestTelemetry(db, payload);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      message: "Telemetry could not be logged.",
      error: String(error?.message || "Unknown telemetry error").replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***:***@")
    });
    return;
  }

  if (!result.ok) {
    sendJson(res, 400, { ok: false, errors: result.errors });
    return;
  }

  sendJson(res, 201, {
    ok: true,
    status: "success",
    message: "Telemetry logged successfully.",
    telemetry_log: result.telemetry_log,
    alert_created: Boolean(result.alert),
    alert: result.alert
  });
}

function requireAuthorized(req, res, auth, permissionName) {
  const result = auth.authorizeRequest(req, permissionName);
  if (!result.ok) {
    sendJson(res, result.status, { ok: false, message: result.message });
    return null;
  }
  return result.session;
}

function requireAdmin(req, res, auth) {
  const result = auth.authorizeRequest(req, "view_logs");
  if (!result.ok) {
    sendJson(res, result.status, { ok: false, message: result.message });
    return null;
  }

  if (Number(result.session.user.role_id) !== 1) {
    sendJson(res, 403, { ok: false, message: "Administrator permission required." });
    return null;
  }

  return result.session;
}

async function createUser(req, res, db, actor) {
  const { username, email, password, role_id } = await readJson(req);
  const normalizedUsername = String(username || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const roleId = Number(role_id);

  if (!normalizedUsername || !normalizedEmail || !password || !findRole(db, roleId)) {
    sendJson(res, 400, { ok: false, message: "Enter a username, email, password, and valid permission." });
    return;
  }

  if (!isValidEmail(normalizedEmail)) {
    sendJson(res, 400, { ok: false, message: "Enter a valid email address." });
    return;
  }

  if (db.users.some(user => user.username.toLowerCase() === normalizedUsername.toLowerCase())) {
    sendJson(res, 409, { ok: false, message: "That username already exists." });
    return;
  }

  if (db.users.some(user => String(user.email || "").toLowerCase() === normalizedEmail)) {
    sendJson(res, 409, { ok: false, message: "That email already exists." });
    return;
  }

  const user = {
    user_id: nextUserId(db),
    username: normalizedUsername,
    email: normalizedEmail,
    email_verified: true,
    password,
    password_hash: `demo-plain:${password}`,
    role_id: roleId,
    created_at: new Date().toISOString()
  };

  if (db.pgPool) {
    await db.pgPool.query(
      `insert into public.users (user_id, username, email, email_verified, password_hash, role_id, created_at)
       values ($1, $2, $3, true, $4, $5, $6)`,
      [user.user_id, user.username, user.email, user.password_hash, user.role_id, user.created_at]
    );
  }

  db.users.push(user);
  await addAuditLog(db, actor, "Create User", user.username);
  sendJson(res, 201, { ok: true, users: listUsers(db) });
}

async function updateUserRole(req, res, db, username, actor) {
  const { role_id } = await readJson(req);
  const roleId = Number(role_id);
  const user = db.users.find(item => item.username === username);

  if (!user || !findRole(db, roleId)) {
    sendJson(res, 404, { ok: false, message: "User not found or permission is invalid." });
    return;
  }

  user.role_id = roleId;

  if (db.pgPool) {
    await db.pgPool.query(
      "update public.users set role_id = $1 where username = $2",
      [roleId, username]
    );
  }

  await addAuditLog(db, actor, "Update User Role", username);
  sendJson(res, 200, { ok: true, users: listUsers(db) });
}

function listUsers(db) {
  return db.users.map(user => {
    const role = findRole(db, user.role_id);
    const isAdministrator = role?.role_name === "Administrator";
    return {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: isAdministrator ? "admin" : "viewer",
      role_id: user.role_id,
      label: role?.role_name || "Unknown"
    };
  });
}

function findRole(db, roleId) {
  return db.roles.find(role => Number(role.role_id) === Number(roleId));
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function nextUserId(db) {
  const next = db.users.reduce((max, user) => {
    const match = String(user.user_id || "").match(/AA(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `AA${String(next).padStart(3, "0")}`;
}

async function addAuditLog(db, actor, action, target, ipAddress = null) {
  const auditLog = {
    audit_id: db.nextAuditId++,
    user_id: actor.user_id,
    action,
    target_resource: target,
    target,
    ip_address: ipAddress,
    performed_at: new Date().toISOString()
  };

  db.audit_logs.push(auditLog);

  if (!db.pgPool) return auditLog;

  try {
    const { columns, values } = buildAuditInsert(db, auditLog);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    const result = await db.pgPool.query(
      `insert into public.audit_logs (${columns.join(", ")})
       values (${placeholders})
       returning audit_id`,
      values
    );
    const remoteAuditId = result.rows?.[0]?.audit_id;
    if (remoteAuditId) auditLog.audit_id = remoteAuditId;
  } catch (error) {
    console.warn(`OxyGuard audit log insert failed: ${String(error?.message || error)}`);
  }

  return auditLog;
}

function buildAuditInsert(db, auditLog) {
  const availableColumns = new Set(db.audit_log_columns || []);
  const hasKnownColumns = availableColumns.size > 0;
  const hasColumn = column => !hasKnownColumns || availableColumns.has(column);
  const entries = [
    ["user_id", auditLog.user_id],
    ["action", auditLog.action],
    [hasColumn("target_resource") ? "target_resource" : "target", auditLog.target_resource],
    ["ip_address", auditLog.ip_address],
    ["performed_at", auditLog.performed_at]
  ].filter(([column]) => hasColumn(column));

  return {
    columns: entries.map(([column]) => column),
    values: entries.map(([, value]) => value)
  };
}

async function resolveAlert(db, res, alertId, user) {
  const alert = db.alerts.find(item => item.alert_id === alertId);
  if (!alert) {
    sendJson(res, 404, { ok: false, message: "Alert not found." });
    return;
  }

  alert.is_resolved = true;
  alert.resolved_by = user.user_id;
  alert.resolved_at = new Date().toISOString();
  await addAuditLog(db, user, "Resolve Alert", `Alert #${alert.alert_id}`);

  sendJson(res, 200, {
    ok: true,
    status: "success",
    message: "Alert resolved successfully.",
    alert
  });
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const remoteAddress = forwardedFor || req.socket?.remoteAddress || null;
  return remoteAddress ? String(remoteAddress).replace(/^::ffff:/, "") : null;
}

function getDeviceInventory(db) {
  return db.devices.map(device => {
    const logs = db.telemetry_logs.filter(log => log.device_id === device.device_id);
    const latest = logs.at(-1);
    return {
      device_id: device.device_id,
      device_name: `${device.device_id} Monitor`,
      ward_id: device.ward_id,
      device_status: latest?.operational_status === "hardware_fault" ? "hardware_fault" : "active",
      last_seen: latest?.received_at || device.created_at,
      created_at: device.created_at
    };
  });
}

function queryAlerts(db, url) {
  const isResolved = parseBooleanQuery(url.searchParams.get("is_resolved"));
  const severity = url.searchParams.get("severity");
  return db.alerts.filter(alert => {
    const resolvedMatches = isResolved === null || alert.is_resolved === isResolved;
    const severityMatches = !severity || alert.severity === severity;
    return resolvedMatches && severityMatches;
  });
}

function listAuditLogs(db) {
  const usersById = new Map(db.users.map(user => [String(user.user_id), user]));
  return db.audit_logs
    .slice()
    .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at))
    .slice(0, 75)
    .map(log => {
      const user = usersById.get(String(log.user_id));
      return {
        audit_id: log.audit_id,
        user_id: log.user_id,
        username: user?.username || log.user_id,
        user_label: user?.email || user?.username || log.user_id,
        action: log.action,
        target_resource: log.target_resource || log.target || "",
        ip_address: log.ip_address || null,
        performed_at: log.performed_at
      };
    });
}

function parseBooleanQuery(value) {
  if (value === null || value === "") return null;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}
