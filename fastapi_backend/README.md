# OxyGuard FastAPI Backend

Priority endpoints implemented from the API specification:

- `GET /api/v1/health`
- `POST /api/v1/telemetry`
- `GET /api/v1/telemetry`
- `POST /api/v1/mfa/challenge`
- `POST /api/v1/mfa/resend`
- `POST /api/v1/mfa/verify`
- `GET /api/v1/mfa/status/{challenge_id}`

Supabase support:

- If `DATABASE_URL` or `SUPABASE_DATABASE_URL` is set, telemetry is saved to Supabase/Postgres.
- If no database URL is set, the API uses local in-memory demo storage.
- Run `database/supabase_setup.sql` in Supabase SQL Editor to create the OxyGuard tables and demo data.
- Store the Supabase database connection string in Render as `DATABASE_URL`; do not commit it to GitHub.

Run locally:

```powershell
cd fastapi_backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Health check:

```text
http://localhost:8000/api/v1/health
```

Expected response:

```json
{"status":"healthy"}
```

API documentation:

```text
http://localhost:8000/docs
```

Multi-factor authentication flow:

1. Create a challenge:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/api/v1/mfa/challenge" `
  -ContentType "application/json" `
  -Body '{"username":"robertm","channel":"email","purpose":"login"}'
```

2. Verify the code from the challenge response:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/api/v1/mfa/verify" `
  -ContentType "application/json" `
  -Body '{"challenge_id":"PASTE_CHALLENGE_ID","code":"PASTE_CODE"}'
```

Notes:

- Local/demo mode returns `demo_code` so the MFA flow can be tested without email or SMS.
- Set `MFA_EXPOSE_DEMO_CODE=false` in Render to hide the code in production responses.
- `MFA_CODE_TTL_MINUTES`, `MFA_TOKEN_TTL_MINUTES`, `MFA_MAX_ATTEMPTS`, and `MFA_SECRET` can be configured as environment variables.
