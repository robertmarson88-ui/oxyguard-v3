import { randomUUID } from "node:crypto";

export function createAuthService(db) {
  const sessions = new Map();

  function authenticate(username, password) {
    const normalizedUsername = String(username || "").trim();
    const user = findUser(normalizedUsername);

    if (!user || !isValidPassword(user, password)) return null;

    const role = db.roles.find(item => item.role_id === user.role_id);
    const permissions = getPermissionNamesForRole(user.role_id);
    const accessToken = randomUUID();
    const roleLabel = String(role.role_name || "").toLowerCase();
    const isAdministrator = roleLabel === "administrator";

    sessions.set(accessToken, { user, issued_at: new Date().toISOString() });

    return {
      access_token: accessToken,
      role: role.role_name,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: isAdministrator ? "admin" : "viewer",
        role_id: user.role_id,
        label: role.role_name,
        email: user.email,
        permissions
      }
    };
  }

  function authorizeRequest(req, permissionName) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    const session = sessions.get(token);

    if (!session) {
      return { ok: false, status: 401, message: "Missing or invalid bearer token." };
    }

    if (permissionName && !hasPermission(session.user, permissionName)) {
      return { ok: false, status: 403, message: `Session lacks ${permissionName} permission.` };
    }

    return { ok: true, session };
  }

  function hasPermission(user, permissionName) {
    const permissions = getPermissionNamesForRole(user.role_id);
    if (permissions.includes(permissionName)) return true;
    const aliases = {
      view_logs: ["alerts:view", "reports:view", "dashboard:view"],
      resolve_alert: ["alerts:acknowledge"],
      telemetry_write: ["telemetry:write"]
    };
    return (aliases[permissionName] || []).some(alias => permissions.includes(alias));
  }

  function findUser(username) {
    const aliases = {
      martin: "martinm",
      vernon: "vernond"
    };
    return db.users.find(item => item.username === username)
      || db.users.find(item => item.username === aliases[username]);
  }

  function isValidPassword(user, password) {
    const acceptedPasswords = new Set([
      user.password,
      ...(user.password_aliases || []),
      ...(user.passwords || [])
    ].filter(Boolean));
    return acceptedPasswords.has(password) || user.password_hash === `demo-plain:${password}`;
  }

  function getPermissionNamesForRole(roleId) {
    const permissionIds = db.role_permissions
      .filter(item => item.role_id === roleId)
      .map(item => item.permission_id);

    return db.permissions
      .filter(permission => permissionIds.includes(permission.permission_id))
      .map(permission => permission.permission_name || permission.permission_key);
  }

  return { authenticate, authorizeRequest };
}
