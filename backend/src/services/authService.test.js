import assert from "node:assert/strict";
import test from "node:test";

import { createAuthService } from "./authService.js";

const db = {
  users: [{ user_id: 7, username: "jwt-user", password: "secret", role_id: 2, email: "jwt@example.com" }],
  roles: [{ role_id: 2, role_name: "Nurse" }],
  permissions: [{ permission_id: 11, permission_name: "alerts:view" }],
  role_permissions: [{ role_id: 2, permission_id: 11 }]
};

test("issues and authorizes a signed JWT after MFA", () => {
  const auth = createAuthService(db);
  const challenge = auth.createMfaChallenge("jwt-user", "secret");
  const result = auth.verifyMfaChallenge(challenge.challenge_id, challenge.code);

  assert.equal(result.ok, true);
  assert.equal(result.access_token.split(".").length, 3);
  assert.equal(result.expires_in, 900);

  const authorization = auth.authorizeRequest({
    headers: { authorization: `Bearer ${result.access_token}` }
  }, "view_logs");
  assert.equal(authorization.ok, true);
  assert.equal(authorization.session.user.user_id, 7);
});

test("rejects tampered JWTs and unauthorized permissions", () => {
  const auth = createAuthService(db);
  const result = auth.authenticate("jwt-user", "secret");
  const segments = result.access_token.split(".");
  const lastCharacter = segments[2].at(-1) === "x" ? "y" : "x";
  const tampered = `${segments[0]}.${segments[1]}.${segments[2].slice(0, -1)}${lastCharacter}`;

  assert.equal(auth.authorizeRequest({ headers: { authorization: `Bearer ${tampered}` } }).status, 401);
  assert.equal(auth.authorizeRequest({
    headers: { authorization: `Bearer ${result.access_token}` }
  }, "telemetry_write").status, 403);
});
