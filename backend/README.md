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

## Run FastAPI Backend

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Health check:

```text
http://localhost:8000/api/v1/health
```

## Login Roles

- `user1` is the administrator.
- `user2` is also an administrator.
- `vernon` is an administrator.
- `martin` is an administrator.
