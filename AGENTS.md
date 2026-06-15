# OxyGuard AI Development Rules

These instructions apply to all AI-generated code in this repository.

## Architecture Priority

Always follow these files first:

1. documentation/contracts/telemetry_contract.yaml
2. documentation/database/database_schema.md
3. documentation/database/erd_schema.dbml
4. documentation/api/api_specification.md
5. documentation/security/rbac_matrix.md

## Rules

- Do not rename telemetry payload fields.
- Do not rename database tables or columns.
- Do not rename API endpoints.
- Do not add undocumented payload fields.
- Do not bypass RBAC permission checks.
- Do not remove audit logging.
- Keep backend code modular.
- Separate routers, schemas, models, services, and database logic.

If generated code conflicts with the architecture documents, the architecture documents win.