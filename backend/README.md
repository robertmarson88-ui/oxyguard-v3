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

## Multifactor Authentication

Login is a two-step API flow:

1. `POST /api/login` with `username` and `password`.
   - When the password is correct, the API returns `mfa_required`, a `challenge_id`, and sends a 6-digit authentication code to the user's email.
2. `POST /api/mfa/verify` with `challenge_id` and `code`.
   - When the code is correct, the API returns the bearer `access_token` used by protected endpoints.

Email delivery supports SendGrid on Render:

```text
SENDGRID_API_KEY=your_sendgrid_api_key
MFA_FROM_EMAIL=no-reply@your-domain.com
```

If SendGrid is not configured in local development, the code is logged to the server console for testing. In production, configure SendGrid so users receive the code by email.
