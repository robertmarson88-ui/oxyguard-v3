# OxyGuard V3

Hospital oxygen monitoring dashboard with role-based login, email authentication, live ward telemetry, reporting, analytics, and replacement tank order summaries.

## Run Locally

```powershell
node server.js
```

Then open:

```text
http://127.0.0.1:4180
```

## Environment

Create a `.env` file from `.env.example` for local email delivery. Do not commit `.env`.

Required for production email codes:

```text
RESEND_API_KEY=
OXYGUARD_AUTH_EMAIL=robertmarson88@gmail.com
OXYGUARD_EMAIL_FROM=OxyGuard <onboarding@resend.dev>
```

## Login Roles

- `user1` is the administrator.
- `user2` is also an administrator.
- `vernon` is an administrator.
- `martin` is an administrator.
