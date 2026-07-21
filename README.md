# OxyGuard V3

Hospital oxygen monitoring dashboard with role-based login, live ward telemetry, reporting, analytics, and replacement tank order summaries.

## Run Locally

```powershell
node server.js
```

Then open:

```text
http://127.0.0.1:4180
```

## Login Roles

- `user1` is the administrator.
- `user2` is also an administrator.
- `vernon` is an administrator.
- `martin` is an administrator.

## Authentication

OxyGuard uses email MFA followed by a signed HS256 JWT bearer token. Access tokens expire after 15 minutes by default. Production requires a `JWT_SECRET` containing at least 32 characters; the included Render Blueprint generates this value automatically.
