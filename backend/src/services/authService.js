import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

const JWT_ALGORITHM = "HS256";

export function createAuthService(db) {
  const jwtConfig = resolveJwtConfig();
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
    const roleLabel = String(role.role_name || "").toLowerCase();
    const roleKey = roleKeyForLabel(roleLabel);
    const accessToken = createAccessToken({
      user_id: user.user_id,
      username: user.username,
      role_id: user.role_id,
      role: roleKey
    }, jwtConfig);

    return {
      access_token: accessToken,
      expires_in: jwtConfig.accessTtlSeconds,
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
    const verification = verifyAccessToken(token, jwtConfig);

    if (!verification.ok) {
      return { ok: false, status: 401, message: verification.message };
    }

    const user = db.users.find(item => String(item.user_id) === String(verification.payload.sub));
    if (!user) return { ok: false, status: 401, message: "Token user no longer exists." };

    const role = db.roles.find(item => Number(item.role_id) === Number(user.role_id));
    if (!role) return { ok: false, status: 401, message: "Token user role is no longer valid." };

    const session = {
      user: { ...user, role_name: role.role_name },
      issued_at: new Date(verification.payload.iat * 1000).toISOString(),
      token_id: verification.payload.jti
    };

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

function createAccessToken(user, config) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: JWT_ALGORITHM, typ: "JWT" };
  const payload = {
    sub: String(user.user_id),
    username: user.username,
    role_id: user.role_id,
    role: user.role,
    iss: config.issuer,
    aud: config.audience,
    iat: now,
    exp: now + config.accessTtlSeconds,
    jti: randomUUID()
  };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  return `${signingInput}.${sign(signingInput, config.secret)}`;
}

function verifyAccessToken(token, config) {
  if (!token) return { ok: false, message: "Missing bearer token." };
  const segments = token.split(".");
  if (segments.length !== 3 || segments.some(segment => !segment)) {
    return { ok: false, message: "Invalid bearer token." };
  }

  const [encodedHeader, encodedPayload, signature] = segments;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, config.secret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, message: "Invalid bearer token signature." };
  }

  try {
    const header = decodeJson(encodedHeader);
    const payload = decodeJson(encodedPayload);
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== JWT_ALGORITHM || header.typ !== "JWT") throw new Error("algorithm");
    if (payload.iss !== config.issuer || payload.aud !== config.audience) throw new Error("claims");
    if (!payload.sub || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) throw new Error("claims");
    if (payload.exp <= now) return { ok: false, message: "Bearer token has expired. Please log in again." };
    if (payload.iat > now + 30) throw new Error("issued-at");
    return { ok: true, payload };
  } catch {
    return { ok: false, message: "Invalid bearer token." };
  }
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function resolveJwtConfig() {
  const configured = String(process.env.JWT_SECRET || "");
  const production = String(process.env.NODE_ENV || "development").toLowerCase() === "production"
    || Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_HOSTNAME);
  let secret = configured;
  if (configured.length >= 32) {
    secret = configured;
  } else if (production) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters in production.");
  } else if (configured) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  } else {
    console.warn("OxyGuard is using a development-only JWT secret. Set JWT_SECRET before deployment.");
    secret = "oxyguard-local-development-secret-change-me";
  }
  return {
    secret,
    issuer: process.env.JWT_ISSUER || "oxyguard-api",
    audience: process.env.JWT_AUDIENCE || "oxyguard-web",
    accessTtlSeconds: readPositiveInteger(process.env.JWT_ACCESS_TTL_SECONDS, 15 * 60)
  };
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
