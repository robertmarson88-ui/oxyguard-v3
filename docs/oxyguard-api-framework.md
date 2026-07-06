# OxyGuard API Framework Recommendation

Analyzed site: https://oxyguard-v3.onrender.com/
Analysis date: 2026-06-28

## Executive Recommendation

OxyGuard should move from a mostly browser-demo dashboard into a modular, event-driven API platform. The current application already shows the right product modules: authentication, ward telemetry, tank depletion, real-time alerts, reporting, analytics, order automation, administration, and audit logs. The recommended API framework is a REST + WebSocket backend with a telemetry ingestion pipeline and a relational operational database.

Recommended backend stack:

- API framework: FastAPI or NestJS
- Database: PostgreSQL with TimescaleDB extension if high-frequency telemetry grows
- Realtime: WebSocket or Server-Sent Events for dashboard alerts
- Device ingest: HTTPS/MQTT gateway for ESP32 sensor payloads
- Auth: JWT access tokens, refresh tokens, role-based access control
- Background jobs: Celery/RQ, BullMQ, or Temporal-style workflows for forecasting, alert escalation, and purchase order automation
- Deployment: Render can work for prototype; production should use managed Postgres, monitored workers, secure secret storage, and health checks

## What The Current App Shows

The OxyGuard dashboard is a hospital oxygen monitoring system with these visible modules:

- Login and role-based navigation
- Dashboard summary and ward oxygen usage heat map
- Real-time alert monitoring
- Patient alerts with anonymized patient identifiers
- Tank depletion monitoring
- Trend analytics and predictive insights
- Report generation center
- Monthly usage and leakage analytics
- Automated order recommendation workflow
- Administration for users, privacy, alert rules, devices, and audit logs

The front end currently calls:

- `POST /api/login`
- `GET /api/alerts?is_resolved=false`

Most ward, tank, analytics, reports, and order data appears to be demo state in the browser. That is the biggest architectural gap: operationally critical oxygen data should live in a secure backend with traceability, not inside front-end JavaScript.

## Domain Model

Core entities:

- `User`: login identity, role, status, last login
- `Role`: administrator, nurse supervisor, maintenance, viewer
- `Ward`: hospital unit, map position, operational status
- `Device`: ESP32 or other sensor node, serial, ward, tank, last seen, firmware version
- `Tank`: oxygen tank or flow source, serial, max volume, current volume, pressure, location
- `TelemetryReading`: timestamped pressure, flow, volume, occupancy, valve state, battery, signal quality
- `AlertRule`: configurable thresholds such as critical tank level, ghost flow, low pressure, flow variance
- `Alert`: active/resolved operational event with severity, source, assignment, acknowledgement, resolution
- `PatientAssignment`: anonymized patient/bed relationship and prescribed flow
- `Report`: generated operational, exception, audit, wastage, and ward comparison outputs
- `Forecast`: depletion projections and capacity risk estimates
- `PurchaseOrder`: replacement tank recommendation, approval status, supplier details, audit trail
- `AuditLog`: immutable security and operational trail

## API Modules

### 1. Identity And Access

Purpose: secure dashboard and protect clinical/operational workflows.

Endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me`

Recommendation:

- Replace sessionStorage-only token handling with short-lived access tokens plus secure refresh flow.
- Enforce role permissions server-side, not only via hidden navigation buttons.
- Log login attempts and privileged actions.

### 2. Wards, Devices, And Tanks

Purpose: maintain the operational inventory that telemetry attaches to.

Endpoints:

- `GET /api/v1/wards`
- `GET /api/v1/wards/{wardId}`
- `GET /api/v1/devices`
- `POST /api/v1/devices`
- `PATCH /api/v1/devices/{deviceId}`
- `GET /api/v1/tanks`
- `PATCH /api/v1/tanks/{tankId}`

Recommendation:

- Treat ward/device/tank records as master data.
- Prevent telemetry payloads from creating unknown devices automatically unless routed through a quarantine table.

### 3. Telemetry Ingestion

Purpose: receive sensor readings from ESP32 devices and store them reliably.

Endpoints:

- `POST /api/v1/telemetry/readings`
- `POST /api/v1/telemetry/batch`
- `GET /api/v1/telemetry/latest`
- `GET /api/v1/telemetry/history`
- `GET /api/v1/telemetry/stream`

Recommendation:

- Use signed device tokens or mTLS for device ingestion.
- Accept both single and batch readings.
- Store raw telemetry separately from normalized dashboard state.
- Apply idempotency keys to avoid duplicate readings from retrying devices.

### 4. Alerts

Purpose: detect, display, acknowledge, escalate, and resolve oxygen safety events.

Endpoints:

- `GET /api/v1/alerts`
- `GET /api/v1/alerts/{alertId}`
- `POST /api/v1/alerts/{alertId}/acknowledge`
- `POST /api/v1/alerts/{alertId}/resolve`
- `GET /api/v1/alert-rules`
- `PATCH /api/v1/alert-rules/{ruleId}`

Recommendation:

- Generate alerts from rules in the backend.
- Support alert lifecycle states: `active`, `acknowledged`, `escalated`, `resolved`, `suppressed`.
- Keep alert rules versioned so past alerts remain explainable.

### 5. Active Patients

Purpose: track anonymized patients currently connected to oxygen monitoring.

Endpoints:

- `GET /api/v1/patients/active`
- `GET /api/v1/patients/active/count`
- `POST /api/v1/patient-assignments`
- `PATCH /api/v1/patient-assignments/{assignmentId}`
- `POST /api/v1/patient-assignments/{assignmentId}/discharge`

Recommendation:

- Update the active patient table target to 35 active patients.
- Keep the dashboard-facing patient table anonymized.
- Store prescribed flow as `SetValue`, live reading, variance, ward, bed/station, status, and alert state.
- Use pagination even when the current active count is 35, so the table can scale without changing the API.

Patient alert status rule:

- `prescribed_flow_lpm` is the configured `SetValue`.
- `flow_variance_percent = ((live_reading_lpm - prescribed_flow_lpm) / prescribed_flow_lpm) * 100`.
- If live reading is below the prescribed `SetValue`, set patient alert status to `low_flow`.
- If live reading is equal to the prescribed `SetValue`, set patient alert status to `normal`.
- If live reading is 1% to 28% above the prescribed `SetValue`, set patient alert status to `normal`.
- If live reading is 29% to 40% above the prescribed `SetValue`, set patient alert status to `high_flow`.
- If live reading is more than 40% above the prescribed `SetValue`, keep status as `high_flow` and mark severity as critical.

### 6. Dashboard And Analytics

Purpose: feed the current UI efficiently without forcing the front end to compute everything.

Endpoints:

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/heatmap`
- `GET /api/v1/analytics/usage`
- `GET /api/v1/analytics/wastage`
- `GET /api/v1/analytics/trends`
- `GET /api/v1/forecasts/depletion`

Recommendation:

- Provide dashboard-specific read models so the UI does not over-fetch raw telemetry.
- Cache summaries for 5-15 seconds; keep alert and critical tank streams realtime.

Dashboard summary should include `active_patients: 35`.

### 7. Reports

Purpose: produce operational, exception, audit, compliance, wastage, and ward comparison reports.

Endpoints:

- `POST /api/v1/reports`
- `GET /api/v1/reports/{reportId}`
- `GET /api/v1/reports/{reportId}/download`

Recommendation:

- Generate large reports asynchronously.
- Save report metadata, request parameters, creator, generated timestamp, and immutable output file reference.

### 8. Order Automation

Purpose: convert forecasted oxygen shortage into a controlled purchase workflow.

Endpoints:

- `GET /api/v1/orders/recommendation`
- `POST /api/v1/orders`
- `POST /api/v1/orders/{orderId}/approve`
- `POST /api/v1/orders/{orderId}/reject`
- `GET /api/v1/orders/{orderId}`

Recommendation:

- Require human approval for purchase orders until enough operational trust is established.
- Preserve the forecast snapshot used to justify each order.
- Add supplier acknowledgement and delivery confirmation states.

### 9. Administration And Audit

Purpose: configure users, privacy, rules, devices, and traceability.

Endpoints:

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/{userId}`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/governance-settings`
- `PATCH /api/v1/admin/governance-settings/{settingId}`

Recommendation:

- Store privacy and governance settings centrally.
- Anonymize patient identifiers before they reach broad dashboard views.
- Make audit logs append-only.

## Event And Alert Logic

Initial alert rules:

- Critical tank level: volume percentage below 10%
- Warning tank level: volume percentage below 25%
- Low pressure: pressure below 40 PSI
- Patient high flow: live patient reading is 29% or more above the prescribed `SetValue`
- Patient low flow: live patient reading is below the prescribed `SetValue`
- Patient normal flow: live patient reading equals `SetValue` or is 1% to 28% above `SetValue`
- Ghost flow: flow above 0.5 L/min when occupancy or valve state says oxygen should be off
- Offline device: no reading after configured heartbeat window

Processing flow:

1. Device sends telemetry.
2. API validates device token and payload.
3. Raw reading is stored.
4. Normalized tank/device/ward state is updated.
5. Alert evaluator checks active rules.
6. Dashboard summary, heat map, alert stream, and forecast jobs update.
7. Order recommendation job runs if projected capacity falls below safety buffer.

## Security And Compliance Priorities

- Use HTTPS only.
- Require device authentication for telemetry ingestion.
- Use role-based access control on every endpoint.
- Avoid storing direct patient identifiers in dashboard-facing tables.
- Encrypt secrets and rotate device credentials.
- Log every admin, report export, alert resolution, and order decision.
- Add rate limits for login and telemetry endpoints.
- Validate all telemetry ranges server-side.

## MVP Implementation Plan

Phase 1: Production API foundation

- Build `/auth`, `/wards`, `/devices`, `/tanks`, `/telemetry`, and `/alerts`
- Move demo data into database seed records
- Connect dashboard to live API responses
- Add JWT auth and role checks

Phase 2: Operational workflows

- Add alert acknowledgement and resolution
- Add alert rule management
- Add audit logs
- Add WebSocket/SSE realtime updates

Phase 3: Analytics, reports, and ordering

- Add aggregate analytics endpoints
- Add asynchronous report generation
- Add depletion forecast and order recommendation
- Add order approval/rejection workflow

Phase 4: Hardening

- Add device key rotation
- Add monitoring and logs
- Add backups and disaster recovery
- Add integration tests for high-risk oxygen workflows

## Recommended First Build

Start with this API slice:

- `POST /api/v1/auth/login`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/wards`
- `GET /api/v1/tanks`
- `POST /api/v1/telemetry/readings`
- `GET /api/v1/alerts?status=active`
- `POST /api/v1/alerts/{alertId}/acknowledge`
- `POST /api/v1/alerts/{alertId}/resolve`

This slice turns the current dashboard from a front-end prototype into a real operational monitoring product without trying to implement every report and procurement workflow at once.
