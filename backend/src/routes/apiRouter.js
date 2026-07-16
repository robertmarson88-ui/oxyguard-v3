import { createAuthService } from "../services/authService.js";
import { buildReportSummary } from "../services/reportService.js";
import { getDatabaseConnectionInfo } from "../database/store.js";
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
      const databaseConnected = db.source === "supabase";
      const databaseConnectionInfo = getDatabaseConnectionInfo();
      const databaseUrlConfigured = Boolean(databaseConnectionInfo.connectionString);
      await auditDatabaseHealth(db, req, databaseConnectionInfo);
      sendJson(res, 200, {
        status: "healthy",
        database: db.source || "demo",
        database_status: databaseConnected
          ? "connected"
          : databaseUrlConfigured
            ? "not_connected"
            : databaseConnectionInfo.projectUrlConfigured
              ? "project_url_only"
              : "local_demo",
        database_url_configured: databaseUrlConfigured,
        database_config_source: databaseConnectionInfo.envName || (databaseConnectionInfo.projectUrlConfigured ? "SUPABASE_URL_ONLY" : "none"),
        supabase_project_url_configured: databaseConnectionInfo.projectUrlConfigured,
        database_error: db.connection_error || null,
        telemetry_rows: db.telemetry_logs.length
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

    if (req.method === "GET" && apiPath === "/ward-card-statuses") {
      const session = requireAuthorized(req, res, auth, "view_logs");
      if (!session) return true;
      try {
        sendJson(res, 200, { ok: true, statuses: await listWardCardStatuses(db) });
      } catch (error) {
        console.warn(`OxyGuard ward status query failed: ${String(error?.message || error)}`);
        sendJson(res, 500, { ok: false, message: "Ward statuses could not be loaded from the database." });
      }
      return true;
    }

    if (req.method === "PATCH" && apiPath === "/ward-card-statuses") {
      const session = requireWardStatusEditor(req, res, auth);
      if (!session) return true;
      await updateWardCardStatus(req, res, db, session.user);
      return true;
    }

    if (req.method === "GET" && apiPath === "/audit-logs") {
      const session = requireSession(req, res, auth);
      if (!session) return true;
      try {
        sendJson(res, 200, { ok: true, audit_logs: await listAuditLogs(db, url) });
      } catch (error) {
        console.warn(`OxyGuard audit log query failed: ${String(error?.message || error)}`);
        sendJson(res, 500, { ok: false, message: "Audit logs could not be loaded from the database." });
      }
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

    if (req.method === "GET" && apiPath === "/order-summary") {
      const session = requireAuthorized(req, res, auth, "view_logs");
      if (!session) return true;
      sendJson(res, 200, { ok: true, order_summary: buildOrderSummary(db) });
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

  if (result.alert) {
    const actor = getSystemAuditActor(db);
    const target = `${result.alert.alert_type} on ${result.alert.device_id} (${result.alert.severity})`;
    await addAuditLog(db, actor, "Alert Created", target, getClientIp(req));
  }
}

async function auditDatabaseHealth(db, req, connectionInfo = getDatabaseConnectionInfo()) {
  const isConnected = db.source === "supabase";
  const hasPostgresUrl = Boolean(connectionInfo.connectionString);
  const status = isConnected
    ? "connected"
    : hasPostgresUrl
      ? "not_connected"
      : connectionInfo.projectUrlConfigured
        ? "project_url_only"
        : "local_demo";
  const error = db.connection_error
    || (status === "project_url_only"
      ? "Supabase project URL is configured, but no Postgres connection string is configured."
      : status === "local_demo"
        ? "No Postgres connection string configured; using local data."
        : "No database error reported.");
  const signature = `${status}|${error}`;
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;

  if (db.lastDatabaseStatusAuditSignature === signature && now - (db.lastDatabaseStatusAuditAt || 0) < fifteenMinutes) {
    return;
  }

  db.lastDatabaseStatusAuditSignature = signature;
  db.lastDatabaseStatusAuditAt = now;
  const source = connectionInfo.envName || (connectionInfo.projectUrlConfigured ? "SUPABASE_URL_ONLY" : "none");
  await addAuditLog(
    db,
    getSystemAuditActor(db),
    "Database Status",
    truncateAuditDetail(`Supabase ${status}; source=${source}; error=${error}`),
    getClientIp(req)
  );
}

function requireAuthorized(req, res, auth, permissionName) {
  const result = auth.authorizeRequest(req, permissionName);
  if (!result.ok) {
    sendJson(res, result.status, { ok: false, message: result.message });
    return null;
  }
  return result.session;
}

function requireSession(req, res, auth) {
  const result = auth.authorizeRequest(req);
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

function requireWardStatusEditor(req, res, auth) {
  const result = auth.authorizeRequest(req, "view_logs");
  if (!result.ok) {
    sendJson(res, result.status, { ok: false, message: result.message });
    return null;
  }

  const roleName = String(result.session.user.role_name || "").trim().toLowerCase();
  const editorRoles = new Set([
    "administrator",
    "facilities admin",
    "nurse manager",
    "nurse supervisor",
    "nurse"
  ]);
  if (!editorRoles.has(roleName)) {
    sendJson(res, 403, { ok: false, message: "Administrator, Nurse Manager, or Nurse permission required." });
    return null;
  }

  return result.session;
}

const WARD_STATUS_OPTIONS = new Set(["Normal", "Supply Failure", "Ghost Flow", "Flow Anomaly", "Leakage"]);

async function listWardCardStatuses(db) {
  if (db.pgPool) {
    const result = await db.pgPool.query(
      `select ward_key, asset_key, status, updated_by, updated_at
       from public.ward_card_statuses
       order by ward_key, asset_key`
    );
    return result.rows;
  }
  return Array.isArray(db.ward_card_statuses) ? db.ward_card_statuses : [];
}

async function updateWardCardStatus(req, res, db, actor) {
  const payload = await readJson(req);
  const wardKey = String(payload.ward_key || "").trim().toLowerCase();
  const assetKey = String(payload.asset_key || "").trim().toLowerCase();
  const status = String(payload.status || "").trim();

  if (!/^[a-z0-9-]{1,40}$/.test(wardKey) || !/^[a-z0-9-]{1,40}$/.test(assetKey) || !WARD_STATUS_OPTIONS.has(status)) {
    sendJson(res, 400, { ok: false, message: "Select a valid ward asset and status." });
    return;
  }

  const updatedAt = new Date().toISOString();
  let savedStatus = { ward_key: wardKey, asset_key: assetKey, status, updated_by: actor.user_id, updated_at: updatedAt };

  try {
    if (db.pgPool) {
      const result = await db.pgPool.query(
        `insert into public.ward_card_statuses (ward_key, asset_key, status, updated_by, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (ward_key, asset_key)
         do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()
         returning ward_key, asset_key, status, updated_by, updated_at`,
        [wardKey, assetKey, status, String(actor.user_id)]
      );
      savedStatus = result.rows[0];
    } else {
      db.ward_card_statuses ||= [];
      const existing = db.ward_card_statuses.find(item => item.ward_key === wardKey && item.asset_key === assetKey);
      if (existing) Object.assign(existing, savedStatus);
      else db.ward_card_statuses.push(savedStatus);
    }

    await addAuditLog(db, actor, "Update Ward Status", `${wardKey}/${assetKey}: ${status}`, getClientIp(req));
    sendJson(res, 200, { ok: true, status: savedStatus });
  } catch (error) {
    console.warn(`OxyGuard ward status update failed: ${String(error?.message || error)}`);
    sendJson(res, 500, { ok: false, message: "Ward status could not be saved to the database." });
  }
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
    target_resource: truncateAuditDetail(target),
    target: truncateAuditDetail(target),
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

function getSystemAuditActor(db) {
  return db.users.find(user => user.username === "admin")
    || db.users.find(user => Number(user.role_id) === 1)
    || db.users[0]
    || { user_id: "AA008", username: "system" };
}

function truncateAuditDetail(value) {
  const text = String(value || "Recorded");
  return text.length > 100 ? `${text.slice(0, 97)}...` : text;
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

function buildOrderSummary(db) {
  const tankCost = 48000;
  const wardsById = new Map(db.wards.map(ward => [ward.ward_id, ward]));
  const latestLogsByDevice = new Map();
  for (const log of db.telemetry_logs) {
    const current = latestLogsByDevice.get(log.device_id);
    if (!current || new Date(log.received_at || log.device_timestamp || 0) > new Date(current.received_at || current.device_timestamp || 0)) {
      latestLogsByDevice.set(log.device_id, log);
    }
  }

  const unresolvedAlertsByDevice = new Map();
  for (const alert of db.alerts.filter(item => !item.is_resolved)) {
    const list = unresolvedAlertsByDevice.get(alert.device_id) || [];
    list.push(alert);
    unresolvedAlertsByDevice.set(alert.device_id, list);
  }

  const tankRows = db.devices.map((device, index) => {
    const latest = latestLogsByDevice.get(device.device_id);
    const alerts = unresolvedAlertsByDevice.get(device.device_id) || [];
    const flowRate = Number(latest?.flow_rate || 0);
    const alertSeverity = alerts.some(alert => ["critical", "high"].includes(String(alert.severity || "").toLowerCase()));
    const statusText = String(latest?.operational_status || "").toLowerCase();
    const basePercent = alertSeverity || statusText.includes("critical")
      ? 6 + (index % 5)
      : statusText.includes("warning") || alerts.length
        ? 12 + (index % 12)
        : Math.max(24, 78 - Math.round(flowRate * 4) - (index % 9));
    const volumePercent = Math.max(0, Math.min(100, basePercent));
    const minutesToEmpty = flowRate > 0
      ? Math.max(35, Math.round((volumePercent / Math.max(flowRate, 1)) * 18))
      : 240 + index * 18;
    const ward = wardsById.get(device.ward_id);
    return {
      tank: device.device_name || device.device_id,
      device_id: device.device_id,
      ward: ward?.ward_name ? normalizeWardName(ward.ward_name) : device.ward_id || "Unassigned",
      remaining_percent: volumePercent,
      empty_in: formatDuration(minutesToEmpty),
      status: volumePercent < 10 ? "Critical" : volumePercent < 30 ? "Low" : "Stable",
      flow_rate: flowRate,
      alert_count: alerts.length,
      last_seen: latest?.received_at || latest?.device_timestamp || device.last_seen || device.created_at || null
    };
  });

  const replacementTanks = tankRows
    .filter(row => row.remaining_percent < 30 || row.alert_count > 0)
    .sort((a, b) => a.remaining_percent - b.remaining_percent || b.alert_count - a.alert_count)
    .slice(0, 6);
  const visibleReplacementTanks = replacementTanks.length ? replacementTanks : tankRows.sort((a, b) => a.remaining_percent - b.remaining_percent).slice(0, 3);
  const recommendedQuantity = Math.max(10, Math.ceil((visibleReplacementTanks.length * 3 + unresolvedAlertsByDevice.size) / 5) * 5);
  const criticalCount = visibleReplacementTanks.filter(row => row.remaining_percent < 10 || row.status === "Critical").length;
  const lowestCapacity = tankRows.length ? Math.min(...tankRows.map(row => row.remaining_percent)) : 0;
  const affectedWards = [...new Set(visibleReplacementTanks.map(row => row.ward))].slice(0, 4);
  const predictedShortage = visibleReplacementTanks[0]?.empty_in || "No immediate shortage";
  const orderValue = recommendedQuantity * tankCost;
  const estimatedWastePrevented = Math.round(Math.max(visibleReplacementTanks.length, 1) * tankCost * 2.2);
  const downtimeAvoided = Math.round(Math.max(criticalCount, 1) * tankCost * 6.5);
  const monthlySavings = Math.round((estimatedWastePrevented + downtimeAvoided) * 0.28);
  const tanksInUse = tankRows.filter(row => Number(row.flow_rate || 0) > 0 || row.remaining_percent < 90).length;
  const reserveTanks = Math.max(0, tankRows.length - tanksInUse);

  return {
    source: db.source || "demo",
    generated_at: new Date().toISOString(),
    metrics: {
      reason: `${criticalCount || visibleReplacementTanks.length} tank${(criticalCount || visibleReplacementTanks.length) === 1 ? "" : "s"} below reorder watch level`,
      predicted_shortage: predictedShortage,
      recommendation: `Order ${recommendedQuantity} replacement tanks`,
      confidence: tankRows.length ? "94%" : "82%"
    },
    trigger_summary: {
      tanks_below_threshold: visibleReplacementTanks.length,
      forecasted_demand_increase: `${Math.min(28, 12 + visibleReplacementTanks.length * 2)}%`,
      current_system_capacity: `${lowestCapacity}%`,
      threshold_exceeded: visibleReplacementTanks.some(row => row.remaining_percent < 30)
    },
    financial_summary: {
      order_value: orderValue,
      estimated_waste_prevented: estimatedWastePrevented,
      potential_downtime_avoided: downtimeAvoided,
      projected_monthly_savings: monthlySavings
    },
    supplier_information: {
      supplier: "Industrial Gases Limited (IGL)",
      expected_delivery: "Tomorrow, 08:00 AM",
      lead_time: criticalCount ? "8 hours" : "14 hours",
      past_orders: 23,
      reliability: "99%"
    },
    inventory_details: {
      total_tanks: tankRows.length,
      tanks_in_use: tanksInUse,
      critical_tanks: criticalCount,
      reorder_level: "30%",
      available_reserve: reserveTanks,
      last_updated: new Date().toISOString()
    },
    order_details: {
      product: "Oxygen Tank (Medical)",
      quantity: recommendedQuantity,
      tank_type: "D-Type (6,800 L)",
      po_number: `AUTO-PO-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(visibleReplacementTanks.length || 1).padStart(2, "0")}`,
      status: "Pending Approval"
    },
    risk: {
      level: criticalCount ? "High" : visibleReplacementTanks.length ? "Moderate" : "Low",
      affected_wards: affectedWards,
      estimated_impact: criticalCount ? "Service interruption and patient care delay" : "Monitor reorder timing",
      time_until_shortage: predictedShortage
    },
    replacement_tanks: visibleReplacementTanks
  };
}

function normalizeWardName(name) {
  const value = String(name || "");
  if (/^a&e$/i.test(value)) return "A&E Ward";
  if (/paediatric/i.test(value)) return "Paediatric Ward";
  if (/labour/i.test(value)) return "Labour Ward";
  if (/nurse/i.test(value)) return "Nurse Station";
  return value.endsWith("Ward") || value.endsWith("Bay") || value.endsWith("Station") ? value : `${value} Ward`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

async function listAuditLogs(db, url) {
  const requestedDay = String(url?.searchParams?.get("day") || "");
  const day = /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) ? requestedDay : "";
  const requestedLimit = Number.parseInt(url?.searchParams?.get("limit") || "500", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(500, Math.max(1, requestedLimit)) : 500;

  if (db.pgPool) {
    const availableColumns = new Set(db.audit_log_columns || []);
    const targetSelect = availableColumns.has("target_resource")
      ? "a.target_resource"
      : availableColumns.has("target")
        ? "a.target as target_resource"
        : "null::text as target_resource";
    const ipSelect = availableColumns.has("ip_address")
      ? "a.ip_address::text as ip_address"
      : "null::text as ip_address";
    const params = day ? [day] : [];
    const dayFilter = day
      ? "where (a.performed_at at time zone 'America/Jamaica')::date = $1::date"
      : "";
    const result = await db.pgPool.query(
      `select a.audit_id, a.user_id, coalesce(u.username, a.user_id::text) as username,
              ${targetSelect}, ${ipSelect}, a.action, a.performed_at
       from public.audit_logs a
       left join public.users u on u.user_id = a.user_id
       ${dayFilter}
       order by a.performed_at desc
       limit ${limit}`,
      params
    );
    return result.rows;
  }

  const usersById = new Map(db.users.map(user => [String(user.user_id), user]));
  return db.audit_logs
    .slice()
    .filter(log => !day || String(log.performed_at || "").slice(0, 10) === day)
    .sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at))
    .slice(0, limit)
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
