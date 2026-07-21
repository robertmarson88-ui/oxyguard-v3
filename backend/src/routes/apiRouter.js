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
      await login(req, res, auth, path.startsWith("/api/v1"));
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
      sendJson(res, 200, await queryAuditLogs(db, url));
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

async function login(req, res, auth, apiV1) {
  const { username, password } = await readJson(req);
  const result = auth.authenticate(username, password);

  if (!result) {
    sendJson(res, 401, { ok: false, message: "Invalid username or password." });
    return;
  }

  const response = {
    access_token: result.access_token,
    token_type: "bearer",
    role: result.role,
    user: result.user
  };

  sendJson(res, 200, apiV1 ? response : { ok: true, ...response });
}

async function createTelemetry(req, res, db) {
  const payload = await readJson(req);
  const result = await ingestTelemetry(db, payload);

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
    alert: result.alert,
    alerts: result.alerts
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

async function resolveAlert(db, res, alertId, user) {
  const alert = db.alerts.find(item => item.alert_id === alertId);
  if (!alert) {
    sendJson(res, 404, { ok: false, message: "Alert not found." });
    return;
  }

  const resolvedAt = new Date().toISOString();
  const auditTarget = `Alert #${alert.alert_id}`;
  let resolvedAlert = {
    ...alert,
    is_resolved: true,
    resolved_by: user.user_id,
    resolved_at: resolvedAt
  };
  let auditLog = {
    audit_id: db.nextAuditId++,
    user_id: user.user_id,
    username: user.username,
    action: "Resolve Alert",
    target: auditTarget,
    performed_at: resolvedAt
  };

  if (db.pgPool) {
    const targetColumn = normalizeAuditTargetColumn(db.audit_target_column);
    const alertLogIdSelection = db.alerts_has_log_id ? "log_id," : "";
    const client = await db.pgPool.connect();
    try {
      await client.query("begin");
      const alertResult = await client.query(
        `update public.alerts
         set is_resolved = true, resolved_by = $1, resolved_at = $2
         where alert_id = $3
         returning alert_id, ${alertLogIdSelection} device_id, alert_type, severity, is_resolved, resolved_by, resolved_at, created_at`,
        [user.user_id, resolvedAt, alert.alert_id]
      );
      if (!alertResult.rows[0]) throw new Error("Alert disappeared before it could be resolved");
      const auditResult = await client.query(
        `insert into public.audit_logs (user_id, action, ${targetColumn}, performed_at)
         values ($1, $2, $3, $4)
         returning audit_id, user_id, action, ${targetColumn} as target, performed_at`,
        [user.user_id, "Resolve Alert", auditTarget, resolvedAt]
      );
      await client.query("commit");
      resolvedAlert = alertResult.rows[0];
      auditLog = { ...auditResult.rows[0], username: user.username };
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  Object.assign(alert, resolvedAlert);
  db.audit_logs.push(auditLog);

  sendJson(res, 200, {
    ok: true,
    status: "success",
    message: "Alert resolved successfully.",
    alert
  });
}

async function queryAuditLogs(db, url) {
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  if (db.pgPool) {
    const targetColumn = normalizeAuditTargetColumn(db.audit_target_column);
    const result = await db.pgPool.query(
      `select a.audit_id, a.user_id, coalesce(u.username, a.user_id) as username,
              coalesce(r.role_name, 'Unknown') as role_name,
              a.action, a.${targetColumn} as target, a.performed_at
       from public.audit_logs a
       left join public.users u on u.user_id = a.user_id
       left join public.roles r on r.role_id = u.role_id
       order by a.performed_at desc, a.audit_id desc
       limit $1`,
      [limit]
    );
    return result.rows;
  }

  return [...db.audit_logs]
    .sort((left, right) => {
      const timeDifference = new Date(right.performed_at) - new Date(left.performed_at);
      return timeDifference || Number(right.audit_id) - Number(left.audit_id);
    })
    .slice(0, limit)
    .map(log => {
      const user = db.users.find(item => item.user_id === log.user_id);
      const role = db.roles.find(item => item.role_id === user?.role_id);
      return {
        ...log,
        username: log.username || user?.username || log.user_id,
        role_name: log.role_name || role?.role_name || "Unknown"
      };
    });
}

function normalizeAuditTargetColumn(value) {
  return value === "target_resource" ? "target_resource" : "target";
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

function parseBooleanQuery(value) {
  if (value === null || value === "") return null;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}
