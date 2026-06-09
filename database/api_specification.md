\# API Specification  
\*\*Author:\*\* Martin Robinson (System Architect)    
\*\*Version:\*\* 1.1.0    
\*\*Base URL:\*\* \`/api/v1\`  

\#\# Purpose  
Defines the RESTful API endpoints supporting authentication, edge data ingestion, historical analytics reporting, and alert remediation management for the OxyGuard platform.

\#\# Dependencies  
\- Telemetry Data Contract v1.0.0  
\- Relational Database Schema v1.1.0  
\- RBAC Security Matrix v1.0.0

\---

\#\# 1\. Core Endpoints Summary

| Method | Endpoint             | Purpose                          | Auth Required |  
| :----- | :------------------- | :------------------------------- | :------------ |  
| \`POST\` | \`/login\`             | Authenticate user & issue tokens | No            |  
| \`POST\` | \`/telemetry\`         | Ingest edge hardware metrics     | No (ESP32)    |  
| \`GET\`  | \`/devices\`           | Retrieve active device inventory | Yes           |  
| \`GET\`  | \`/telemetry\`         | Query historical data telemetry  | Yes           |  
| \`GET\`  | \`/alerts\`            | Monitor platform alert states    | Yes           |  
| \`POST\` | \`/alerts/{id}/resolve\`| Execute alert remediation        | Yes           |  
| \`GET\`  | \`/reports\`           | Compile administrative analytics | Yes           |  
| \`GET\`  | \`/health\`            | Verify system uptime state       | No            |

\---

\#\# 2\. Endpoint Contracts

\#\#\# 2.1 Authenticate User  
\* \*\*Route:\*\* \`POST /login\`  
\* \*\*Purpose:\*\* Validates system user credentials and generates active operational session contexts.

\#\#\#\# Request Payload Model:  
\`\`\`json  
{  
  "username": "martin\_architect",  
  "password": "secure\_password\_hash"  
}  
\`\`\`

\#\#\#\# Backend Requirements:  
\- Verify credentials against the \`users\` table records.  
\- Issue a secure bearer token context upon validation success.

\#\#\#\# Expected Responses:  
\- \*\*200 OK:\*\* Authentication successful.  
  \`\`\`json  
  {  
    "access\_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  
    "token\_type": "bearer"  
  }  
  \`\`\`  
\- \*\*401 Unauthorized:\*\* Invalid username or password coordinates.

\---

\#\#\# 2.2 Edge Telemetry Ingestion  
\* \*\*Route:\*\* \`POST /telemetry\`  
\* \*\*Purpose:\*\* Processes incoming sensor data frames emitted from the edge computing layer.

\#\#\#\# Request Payload Model:  
\*Refer to Telemetry Data Contract v1.0.0 for explicit parameter regex patterns.\*  
\`\`\`json  
{  
  "device\_id": "ESP32-WARD1-ICU",  
  "ward\_id": "ICU-A",  
  "flow\_rate": 14.75,  
  "operational\_status": "normal",  
  "timestamp": "2026-06-08T21:45:00Z"  
}  
\`\`\`

\#\#\#\# Backend Requirements:  
\- Validate inbound request payload properties against Telemetry Data Contract v1.0.0 rules.  
\- Persist validated metric objects to the \`telemetry\_logs\` data table.  
\- Evaluate alert threshold conditions. If an anomaly is registered, auto-generate a record in the \`alerts\` table tied to the matching transaction \`log\_id\`.

\#\#\#\# Expected Responses:  
\- \*\*201 Created:\*\* Data validated and appended to relational storage engine.  
\- \*\*400 Bad Request:\*\* Payload parameters violated validation contract criteria.

\---

\#\#\# 2.3 Device Inventory Fleet List  
\* \*\*Route:\*\* \`GET /devices\`  
\* \*\*Purpose:\*\* Queries active tracking hardware hardware nodes currently online.

\#\#\#\# Expected Responses:  
\- \*\*200 OK:\*\* Returns rows compiled from the \`devices\` table records.  
  \`\`\`json  
  \[  
    {  
      "device\_id": "ESP32-WARD1-ICU",  
      "device\_name": "ICU Bed 4 Monitor",  
      "ward\_id": "ICU-A",  
      "device\_status": "active",  
      "last\_seen": "2026-06-08T23:30:00Z",  
      "created\_at": "2026-06-01T08:00:00Z"  
    }  
  \]  
  \`\`\`

\---

\#\#\# 2.4 Historical Telemetry Streams  
\* \*\*Route:\*\* \`GET /telemetry\`  
\* \*\*Purpose:\*\* Extracts time-series array fragments for analytics dashboard charts.  
\* \*\*Query Parameters:\*\* \`?device\_id=ESP32-WARD1-ICU\&limit=100\`

\#\#\#\# Expected Responses:  
\- \*\*200 OK:\*\* Returns ordered metric lines matching query criteria.

\---

\#\#\# 2.5 Active & Historical System Alerts  
\* \*\*Route:\*\* \`GET /alerts\`  
\* \*\*Purpose:\*\* Feeds real-time system failure events to monitoring views.

\#\#\#\# Expected Responses:  
\- \*\*200 OK:\*\* Returns unresolved or historical arrays matching the \`alerts\` storage format.

\---

\#\#\# 2.6 Reverse User Resolution Action  
\* \*\*Route:\*\* \`POST /alerts/{id}/resolve\`  
\* \*\*Purpose:\*\* Translates deliberate clinical user remediation requests back to backend states.

\#\#\#\# Backend Requirements:  
\- Enforce active role-based permission scopes against RBAC Security Matrix v1.0.0 rules.  
\- Mutate the target row tracking index within the \`alerts\` data model to true, flagging timestamps and operator IDs.  
\- Log an immutable transaction entry directly inside the \`audit\_logs\` table tracking the mutation parameters.

\#\#\#\# Expected Responses:  
\- \*\*200 OK:\*\* Alert status successfully updated and archived to immutable audit tables.  
\- \*\*403 Forbidden:\*\* Session context lacks appropriate authorization permission properties.  
\- \*\*404 Not Found:\*\* Referenced alert element identifier does not exist.

\---

\#\#\# 2.7 Analytical Aggregations & Reports  
\* \*\*Route:\*\* \`GET /reports\`  
\* \*\*Purpose:\*\* Synthesizes table items into high-level business analytics.

\#\#\#\# Expected Responses:  
\- \*\*200 OK:\*\* Returns aggregated infrastructure tracking integers.  
  \`\`\`json  
  {  
    "total\_monitored\_devices": 12,  
    "active\_unresolved\_alerts": 1,  
    "critical\_system\_incidents\_today": 3,  
    "uptime\_percentage": 99.45  
  }  
  \`\`\`

\---

\#\#\# 2.8 Health Check  
\* \*\*Route:\*\* \`GET /health\`  
\* \*\*Purpose:\*\* Diagnostics route to check backend application execution health instantly during live capstone reviews.

\#\#\#\# Expected Responses:  
\- \*\*200 OK:\*\* System heartbeat alive.  
  \`\`\`json  
  {  
    "status": "healthy"  
  }  
  \`\`\`

