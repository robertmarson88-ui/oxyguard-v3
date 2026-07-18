import { createHash, randomInt, randomUUID } from "node:crypto";

export function createAuthService(db) {
  const sessions = new Map();
  const mfaChallenges = new Map();
  const MFA_TTL_MS = 10 * 60 * 1000;

  function authenticate(username, password) {
    const user = validateCredentials(username, password);

    if (!user) return null;

    return createSessionForUser(user);
  }

  function createMfaChallenge(username, password) {
    const user = validateCredentials(username, password);

    if (!user) return null;

    clearExpiredMfaChallenges();
    const challengeId = randomUUID();
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + MFA_TTL_MS).toISOString();

    mfaChallenges.set(challengeId, {
      user_id: user.user_id,
      code_hash: hashMfaCode(code),
      attempts: 0,
      expires_at: expiresAt
    });

    return {
      challenge_id: challengeId,
      code,
      expires_at: expiresAt,
      expires_in_seconds: Math.floor(MFA_TTL_MS / 1000),
      user: buildSafeUser(user)
    };
  }

  function verifyMfaChallenge(challengeId, code) {
    clearExpiredMfaChallenges();
    const challenge = mfaChallenges.get(String(challengeId || ""));
    if (!challenge) return { ok: false, status: 401, message: "MFA challenge expired. Please log in again." };

    challenge.attempts += 1;
    if (challenge.attempts > 5) {
      mfaChallenges.delete(challengeId);
      return { ok: false, status: 429, message: "Too many MFA attempts. Please log in again." };
    }

    if (challenge.code_hash !== hashMfaCode(String(code || "").trim())) {
      return { ok: false, status: 401, message: "Invalid authentication code." };
    }

    mfaChallenges.delete(challengeId);
    const user = db.users.find(item => String(item.user_id) === String(challenge.user_id));
    if (!user) return { ok: false, status: 401, message: "MFA user could not be verified." };

    return { ok: true, ...createSessionForUser(user) };
  }

  function validateCredentials(username, password) {
    const normalizedUsername = String(username || "").trim();
    const user = findUser(normalizedUsername);

    if (!user || !isValidPassword(user, password)) return null;

    return user;
  }

  function createSessionForUser(user) {
    const role = db.roles.find(item => Number(item.role_id) === Number(user.role_id));
    if (!role) return null;
    const permissions = getPermissionNamesForRole(user.role_id);
    const accessToken = randomUUID();
    const roleLabel = String(role.role_name || "").toLowerCase();
    const roleKey = roleKeyForLabel(roleLabel);

    sessions.set(accessToken, {
      user: { ...user, role_name: role.role_name },
      issued_at: new Date().toISOString()
    });

    return {
      access_token: accessToken,
      role: role.role_name,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: roleKey,
        role_id: user.role_id,
        label: role.role_name,
        email: user.email,
        permissions
      }
    };
  }

  function buildSafeUser(user) {
    const role = db.roles.find(item => Number(item.role_id) === Number(user.role_id));
    return {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role_id: user.role_id,
      label: role?.role_name || "User"
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
      .filter(item => Number(item.role_id) === Number(roleId))
      .map(item => item.permission_id);

    return db.permissions
      .filter(permission => permissionIds.some(id => Number(id) === Number(permission.permission_id)))
      .map(permission => permission.permission_name || permission.permission_key);
  }

  function roleKeyForLabel(roleLabel) {
    const keys = {
      administrator: "admin",
      "facilities admin": "admin",
      executive: "executive",
      "executive user": "executive",
      "facilities manager": "facilities-manager",
      "nurse manager": "nurse-supervisor",
      "nurse supervisor": "nurse-supervisor",
      "biomedical technician": "facilities-manager",
      nurse: "nurse"
    };
    return keys[roleLabel] || "viewer";
  }

  function hashMfaCode(code) {
    return createHash("sha256").update(String(code || "")).digest("hex");
  }

  function clearExpiredMfaChallenges() {
    const now = Date.now();
    for (const [challengeId, challenge] of mfaChallenges.entries()) {
      if (new Date(challenge.expires_at).getTime() <= now) {
        mfaChallenges.delete(challengeId);
      }
    }
  }

  return { authenticate, authorizeRequest, createMfaChallenge, verifyMfaChallenge };
}
