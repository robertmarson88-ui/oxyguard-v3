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

## MQTT Telemetry Topic

Mosquitto topic:

```text
oxyguard/telemetry
```

Publish approved test payload:

```powershell
& "C:\Program Files\mosquitto\mosquitto_pub.exe" -h 127.0.0.1 -p 1883 -t "oxyguard/telemetry" -f ".\approved-telemetry-payload.json"
```

Run every simulator scenario against the local API. Duration-based scenarios use readings timestamped at 0, 5, 10, and 11 minutes, so the exact `> 10 minutes` rules can be verified immediately without waiting:

```powershell
python .\simulate_telemetry_publisher.py
```

Run one scenario:

```powershell
python .\simulate_telemetry_publisher.py --scenario residual_gas
python .\simulate_telemetry_publisher.py --scenario ghost_flow
python .\simulate_telemetry_publisher.py --scenario unauthorized_bed
```

The HTTP simulator checks the API response and exits with an error if the expected alert does not appear. Use a different API endpoint when required:

```powershell
python .\simulate_telemetry_publisher.py --api-url https://your-render-service.onrender.com/api/v1/telemetry
```

MQTT publish-only compatibility remains available, but it cannot verify the resulting alerts:

```powershell
python .\simulate_telemetry_publisher.py --transport mqtt --scenario all
```

Scenario triggers:

- `normal`: boundary-safe values; no alert expected.
- `residual_gas`: a 1,200 L cylinder is replaced after consuming 960 L (80% utilization).
- `ghost_flow`: 1.2 LPM with breathing variance 0.005 for 11 minutes.
- `unauthorized_bed`: an `EMPTY` bed consuming exactly 2.0 LPM for 11 minutes.

Subscribe and confirm receipt:

```powershell
& "C:\Program Files\mosquitto\mosquitto_sub.exe" -h 127.0.0.1 -p 1883 -t "oxyguard/telemetry" -C 1
```

## Login Roles

- `user1` is the administrator.
- `user2` is also an administrator.
- `vernon` is an administrator.
- `martin` is an administrator.
