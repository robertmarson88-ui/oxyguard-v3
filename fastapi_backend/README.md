# OxyGuard FastAPI Backend

Priority endpoints implemented from the API specification:

- `GET /api/v1/health`
- `POST /api/v1/telemetry`
- `GET /api/v1/telemetry`

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
