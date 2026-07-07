# OxyGuard FastAPI Backend

Priority endpoints implemented from the API specification:

- `GET /api/v1/health`
- `POST /api/v1/telemetry`
- `GET /api/v1/telemetry`

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
