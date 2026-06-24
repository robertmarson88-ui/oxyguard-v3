import { randomUUID } from "node:crypto";

export function createAuthService(db) {
  const sessions = new Map();

  function authenticate(username, password) {
    const normalizedUsername = String(username || "").trim();
    const user = db.users.find(item => item.username === normalizedUsername);

    if (!user || user.password !== password) return null;

    const role = db.roles.find(item => item.role_id === user.role_id);
    const permissions = getPermissionNamesForRole(user.role_id);
    const accessToken = randomUUID();
    const isAdministrator = role.role_name === "Administrator";

    sessions.set(accessToken, { user, issued_at: new Date().toISOString() });

    return {
      access_token: accessToken,
      role: role.role_name,
      user: {
        user_id: user.user_id,
        username: normalizedUsername,
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
    return getPermissionNamesForRole(user.role_id).includes(permissionName);
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
