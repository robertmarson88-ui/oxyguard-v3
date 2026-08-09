export const demoCreatedAt = "2026-06-09T08:00:00Z";

export async function createRelationalStore() {
  const demoAuditLogs = createDemoAuditLogs();
  const store = {
    source: "demo",
    roles: [
      { role_id: 1, role_name: "Administrator" },
      { role_id: 2, role_name: "CFO" },
      { role_id: 3, role_name: "Facilities Manager" },
      { role_id: 4, role_name: "Nurse Manager" },
      { role_id: 5, role_name: "Nurse" }
    ],
    permissions: [
      { permission_id: 1, permission_name: "resolve_alert" },
      { permission_id: 2, permission_name: "view_logs" }
    ],
    role_permissions: [
      { role_id: 1, permission_id: 2 },
      { role_id: 2, permission_id: 2 },
      { role_id: 3, permission_id: 2 },
      { role_id: 4, permission_id: 2 },
      { role_id: 4, permission_id: 1 },
      { role_id: 5, permission_id: 2 }
    ],
    users: [
      createUser("AA001", "martin", "martin1", "robinsonmartin187@gmail.com", 1, "demo-hash:martin-2026"),
      createUser("AA002", "robertm", "password2", "marsonrobert88@gmail.com", 1, "demo-hash:robertm-2026"),
      createUser("AA003", "vernon", "vernon1", "vernon.dacosta@gmail.com", 1, "demo-hash:vernon-2026"),
      createUser("AA004", "user1", "password1", "robertmarson88@gmail.com", 1, "demo-hash:user1-2026"),
      createUser("AA005", "user2", "password2", "robertmarson88@gmail.com", 1, "demo-hash:user2-2026"),
      createUser("AA006", "martinm", "martin1", "robinsonmartin187@gmail.com", 1, "demo-hash:martinm-2026"),
      createUser("AA007", "vernond", "vernon1", "vernon.dacosta@gmail.com", 1, "demo-hash:vernond-2026"),
      createUser("AA008", "admin", "admin1", "facilities.admin@monamercy.local", 1, "demo-hash:admin-2026"),
      createUser("AA009", "executive", "executive1", "executive@monamercy.local", 2, "demo-hash:executive-2026"),
      createUser("AA010", "supervisor", "nurse1", "nurse.supervisor@monamercy.local", 4, "demo-hash:supervisor-2026"),
      createUser("AA011", "facilities", "facilities1", "facilities.manager@monamercy.local", 3, "demo-hash:facilities-2026"),
      createUser("AA012", "nurse", "nurse1", "ward.nurse@monamercy.local", 5, "demo-hash:nurse-2026")
    ],
    wards: [
      { ward_id: "X001", ward_name: "Labour", location: "7a East Wing" },
      { ward_id: "X002", ward_name: "A&E", location: "12c North Wing" },
      { ward_id: "X003", ward_name: "Maternity", location: "3a South Wing" },
      { ward_id: "X004", ward_name: "Nurse Station", location: "11b West Wing" },
      { ward_id: "X005", ward_name: "Paediatric Ward", location: "11c West Wing" }
    ],
    devices: [
      { device_id: "TK001", ward_id: "X001", created_at: demoCreatedAt },
      { device_id: "TK002", ward_id: "X001", created_at: demoCreatedAt },
      { device_id: "TK003", ward_id: "X001", created_at: demoCreatedAt },
      { device_id: "TK004", ward_id: "X003", created_at: demoCreatedAt },
      { device_id: "TK005", ward_id: "X003", created_at: demoCreatedAt },
      { device_id: "TK006", ward_id: "X003", created_at: demoCreatedAt },
      { device_id: "TK007", ward_id: "X002", created_at: demoCreatedAt },
      { device_id: "TK008", ward_id: "X002", created_at: demoCreatedAt }
    ],
    telemetry_logs: [],
    alerts: [],
    audit_logs: demoAuditLogs,
    nextLogId: 1,
    nextAlertId: 1,
    nextAuditId: nextId(demoAuditLogs, "audit_id")
  };

  const connectionInfo = getDatabaseConnectionInfo();
  const connectionString = connectionInfo.connectionString;
  store.database_connection_env = connectionInfo.envName;
  store.database_project_url_configured = connectionInfo.projectUrlConfigured;
  if (!connectionString) return store;

  try {
    const { Pool } = await import("pg");
    const pool = await connectPostgres(Pool, connectionString);
    await ensureOperationalSchema(pool);

    let remote = await loadSupabaseTables(pool);
    await runOptionalSeed("users", () => seedSupabaseDemoUsers(pool));
    remote = await loadSupabaseTables(pool);
    await runOptionalSeed("alerts", () => seedSupabaseDemoAlerts(pool, remote));
    await runOptionalSeed("audit logs", () => seedSupabaseDemoAuditLogs(pool));
    remote = await loadSupabaseTables(pool);
    Object.assign(store, remote, {
      source: "supabase",
      pgPool: pool,
      nextLogId: nextId(remote.telemetry_logs, "log_id"),
      nextAlertId: nextId(remote.alerts, "alert_id"),
      nextAuditId: nextId(remote.audit_logs, "audit_id")
    });
    return store;
  } catch (error) {
    store.connection_error = sanitizeDatabaseError(error);
    console.warn(`OxyGuard Supabase connection failed; using demo data. ${store.connection_error}`);
    return store;
  }
}

async function ensureOperationalSchema(pool) {
  await pool.query(
    `alter table public.audit_logs
       add column if not exists role varchar(80)`
  );
  await pool.query(
    `alter table public.telemetry_logs
       add column if not exists cylinder_capacity numeric(12,2),
       add column if not exists consumed_volume numeric(12,2),
       add column if not exists cylinder_status varchar(20),
       add column if not exists breathing_variance numeric(12,6),
       add column if not exists emr_status varchar(50)`
  );
  await pool.query(
    `alter table public.alerts
       add column if not exists remaining_volume numeric(12,2),
       add column if not exists unused_percentage numeric(7,6),
       add column if not exists estimated_oxygen_waste numeric(12,2),
       add column if not exists estimated_financial_loss numeric(14,2),
       add column if not exists potential_savings numeric(14,2),
       add column if not exists recommended_action varchar(255),
       add column if not exists timestamp timestamptz,
       add column if not exists ward_id varchar(50),
       add column if not exists bed_id varchar(80),
       add column if not exists status varchar(30) not null default 'active',
       add column if not exists acknowledged_at timestamptz,
       add column if not exists escalated_at timestamptz,
       add column if not exists supervisor_notified boolean not null default false,
       add column if not exists resolution_action varchar(50),
       add column if not exists resolution_note varchar(100)`
  );
  await pool.query(
    `create table if not exists public.ward_card_statuses (
       ward_key varchar(40) not null,
       asset_key varchar(40) not null,
       status varchar(30) not null check (status in ('Normal', 'Supply Failure', 'Ghost Flow', 'Flow Anomaly', 'Leakage')),
       updated_by varchar(50),
       updated_at timestamptz not null default now(),
       primary key (ward_key, asset_key)
     )`
  );
  await pool.query(
    `insert into public.ward_card_statuses (ward_key, asset_key, status) values
       ('ae', 'bed-05', 'Normal'),
       ('ae', 'bed-06', 'Normal'),
       ('ae', 'bed-07', 'Normal'),
       ('paediatrics', 'bed-10', 'Normal'),
       ('paediatrics', 'bed-11', 'Normal'),
       ('paediatrics', 'bed-12', 'Normal'),
       ('recovery', 'bed-15', 'Normal'),
       ('recovery', 'bed-16', 'Normal'),
       ('recovery', 'tank-r1', 'Normal'),
       ('labour', 'bed-20', 'Normal'),
       ('labour', 'bed-21', 'Normal'),
       ('labour', 'bed-22', 'Normal')
     on conflict (ward_key, asset_key) do nothing`
  );

  const roles = await queryRows(pool, "select role_id, lower(role_name) as role_name from public.roles");
  const adminRole = await ensureRole(pool, roles, ["administrator", "facilities admin"], "Administrator");
  const cfoRole = roles.find(role => role.role_name === "cfo")
    || await ensureRole(pool, roles, ["executive", "executive user"], "CFO");
  const facilitiesRole = await ensureRole(pool, roles, ["facilities manager"], "Facilities Manager");
  const nurseManagerRole = await ensureRole(pool, roles, ["nurse manager", "nurse supervisor"], "Nurse Manager");
  const nurseRole = await ensureRole(pool, roles, ["nurse"], "Nurse");

  if (cfoRole.role_name !== "cfo") {
    await pool.query("update public.roles set role_name = 'CFO' where role_id = $1", [cfoRole.role_id]);
    cfoRole.role_name = "cfo";
  }

  await ensureOperationalUser(pool, "admin", "admin1", "facilities.admin@monamercy.local", adminRole.role_id);
  await ensureOperationalUser(pool, "martin", "martin1", "robinsonmartin187@gmail.com", adminRole.role_id);
  await ensureOperationalUser(pool, "martinm", "martin1", "robinsonmartin187@gmail.com", adminRole.role_id);
  await ensureOperationalUser(pool, "vernon", "vernon1", "vernon.dacosta@gmail.com", adminRole.role_id);
  await ensureOperationalUser(pool, "vernond", "vernon1", "vernon.dacosta@gmail.com", adminRole.role_id);
  await ensureOperationalUser(pool, "executive", "executive1", "executive@monamercy.local", cfoRole.role_id);
  await ensureOperationalUser(pool, "facilities", "facilities1", "facilities.manager@monamercy.local", facilitiesRole.role_id);
  await ensureOperationalUser(pool, "supervisor", "nurse1", "nurse.supervisor@monamercy.local", nurseManagerRole.role_id);
  await ensureOperationalUser(pool, "nurse", "nurse1", "ward.nurse@monamercy.local", nurseRole.role_id);

  const permissions = await loadPermissions(pool);
  const viewPermission = permissions.find(permission => [
    "view_logs",
    "dashboard:view",
    "reports:view",
    "alerts:view",
    "view_dashboard"
  ].includes(String(permission.permission_name || "").toLowerCase()));
  if (viewPermission) {
    for (const role of [adminRole, cfoRole, facilitiesRole, nurseManagerRole, nurseRole]) {
      await pool.query(
        `insert into public.role_permissions (role_id, permission_id)
         values ($1, $2)
         on conflict do nothing`,
        [role.role_id, viewPermission.permission_id]
      );
    }
  }
  const resolveAlertPermission = permissions.find(permission => String(permission.permission_name || "").toLowerCase() === "resolve_alert");
  if (resolveAlertPermission) {
    for (const role of [nurseManagerRole]) {
      await pool.query(
        `insert into public.role_permissions (role_id, permission_id)
         values ($1, $2)
         on conflict do nothing`,
        [role.role_id, resolveAlertPermission.permission_id]
      );
    }
  }
}

async function ensureRole(pool, roles, acceptedNames, roleName) {
  const existing = roles.find(role => acceptedNames.includes(role.role_name));
  if (existing) return existing;
  const role = {
    role_id: roles.reduce((max, item) => Math.max(max, Number(item.role_id) || 0), 0) + 1,
    role_name: roleName.toLowerCase()
  };
  await pool.query("insert into public.roles (role_id, role_name) values ($1, $2)", [role.role_id, roleName]);
  roles.push(role);
  return role;
}

async function ensureOperationalUser(pool, username, password, email, roleId) {
  const updated = await pool.query(
    `update public.users
     set role_id = $2, email = $3, email_verified = true
     where lower(username) = lower($1)`,
    [username, roleId, email]
  );
  if (updated.rowCount) return;

  const userIdType = await tableColumnDataType(pool, "users", "user_id");
  const userId = isIntegerDataType(userIdType)
    ? Number((await pool.query("select coalesce(max(user_id), 0) + 1 as user_id from public.users")).rows[0].user_id)
    : `OXY-${username.toUpperCase()}`;
  await pool.query(
    `insert into public.users
       (user_id, username, email, email_verified, password_hash, role_id, created_at)
     values ($1, $2, $3, true, $4, $5, now())`,
    [userId, username, email, `demo-plain:${password}`, roleId]
  );
}

async function runOptionalSeed(label, seed) {
  try {
    await seed();
  } catch (error) {
    console.warn(`OxyGuard skipped optional ${label} seed. ${sanitizeDatabaseError(error)}`);
  }
}

function sanitizeDatabaseError(error) {
  return String(error?.message || "Unknown database connection error")
    .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***:***@")
    .replace(/password=[^&\s]+/gi, "password=***");
}

export function getDatabaseConnectionInfo() {
  const candidates = [
    "DATABASE_URL",
    "SUPABASE_DB_URL",
    "SUPABASE_DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING"
  ];
  const envName = candidates.find(name => Boolean(process.env[name]));
  return {
    connectionString: envName ? process.env[envName] : "",
    envName: envName || "",
    projectUrlConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)
  };
}

export function getDatabaseConnectionString() {
  return getDatabaseConnectionInfo().connectionString;
}

async function connectPostgres(Pool, connectionString) {
  const ssl = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };
  try {
    const pool = new Pool({ connectionString, ssl });
    await pool.query("select 1");
    return pool;
  } catch (error) {
    if (!String(error.message || "").toLowerCase().includes("ssl")) throw error;
    const pool = new Pool({ connectionString, ssl: false });
    await pool.query("select 1");
    return pool;
  }
}

async function loadSupabaseTables(pool) {
  const auditLogColumns = await tableColumns(pool, "audit_logs");
  const auditTargetSelect = auditLogColumns.has("target_resource")
    ? "target_resource"
    : auditLogColumns.has("target")
      ? "target as target_resource"
      : "null::text as target_resource";
  const auditIpSelect = auditLogColumns.has("ip_address")
    ? "ip_address::text as ip_address"
    : "null::text as ip_address";
  const auditRoleSelect = auditLogColumns.has("role")
    ? "role"
    : "null::text as role";
  const [
    roles,
    permissions,
    rolePermissions,
    users,
    wards,
    devices,
    telemetryResult,
    alertResult,
    auditLogs
  ] = await Promise.all([
    queryRows(pool, "select role_id, role_name from public.roles order by role_id"),
    loadPermissions(pool),
    queryRows(pool, "select role_id, permission_id from public.role_permissions"),
    queryRows(pool, "select user_id, username, email, email_verified, password_hash, role_id, created_at from public.users order by user_id"),
    queryRows(pool, "select ward_id, ward_name, location from public.wards order by ward_id"),
    queryRows(pool, "select device_id, ward_id, created_at, device_name, device_status, last_seen, bed_id from public.devices order by device_id"),
    loadTelemetryLogs(pool),
    loadAlerts(pool),
    queryRows(pool, `select audit_id, user_id, action, ${auditRoleSelect}, ${auditTargetSelect}, ${auditIpSelect}, performed_at from public.audit_logs order by audit_id`)
  ]);

  return {
    roles,
    permissions,
    role_permissions: rolePermissions,
    users: users.map(user => ({
      ...user,
      password: demoPasswordFor(user.username),
      password_aliases: demoPasswordAliasesFor(user.username)
    })),
    wards,
    devices,
    telemetry_logs: telemetryResult.rows,
    telemetry_has_cylinder_fields: telemetryResult.hasCylinderFields,
    telemetry_has_breathing_variance: telemetryResult.hasBreathingVariance,
    telemetry_has_emr_status: telemetryResult.hasEmrStatus,
    alerts: alertResult.rows,
    alerts_has_log_id: alertResult.hasLogId,
    alerts_has_residual_fields: alertResult.hasResidualFields,
    alerts_has_recommended_action: alertResult.hasRecommendedAction,
    alerts_has_required_fields: alertResult.hasRequiredFields,
    alerts_has_escalation_fields: alertResult.hasEscalationFields,
    alerts_has_resolution_fields: alertResult.hasResolutionFields,
    audit_logs: auditLogs,
    audit_log_columns: [...auditLogColumns]
  };
}

async function loadTelemetryLogs(pool) {
  const columns = await tableColumns(pool, "telemetry_logs");
  const cylinderColumns = ["cylinder_capacity", "consumed_volume", "cylinder_status"];
  const hasCylinderFields = cylinderColumns.every(column => columns.has(column));
  const hasBreathingVariance = columns.has("breathing_variance");
  const hasEmrStatus = columns.has("emr_status");
  const optionalColumns = [
    ...(hasCylinderFields ? cylinderColumns : []),
    ...(hasBreathingVariance ? ["breathing_variance"] : []),
    ...(hasEmrStatus ? ["emr_status"] : [])
  ];
  const optionalSelection = optionalColumns.length ? `, ${optionalColumns.join(", ")}` : "";
  const rows = await queryRows(
    pool,
    `select log_id, device_id, ward_id, flow_rate, operational_status, device_timestamp, received_at${optionalSelection}
     from public.telemetry_logs order by log_id`
  );
  return { rows, hasCylinderFields, hasBreathingVariance, hasEmrStatus };
}

async function loadAlerts(pool) {
  const columns = await tableColumns(pool, "alerts");
  const hasLogId = columns.has("log_id");
  const residualColumns = ["remaining_volume", "unused_percentage", "estimated_oxygen_waste", "estimated_financial_loss", "potential_savings"];
  const hasResidualFields = residualColumns.every(column => columns.has(column));
  const hasRecommendedAction = columns.has("recommended_action");
  const requiredFields = ["timestamp", "ward_id", "bed_id", "status"];
  const escalationFields = ["acknowledged_at", "escalated_at", "supervisor_notified"];
  const resolutionFields = ["resolution_action", "resolution_note"];
  const hasRequiredFields = requiredFields.every(column => columns.has(column));
  const hasEscalationFields = escalationFields.every(column => columns.has(column));
  const hasResolutionFields = resolutionFields.every(column => columns.has(column));
  const selections = [
    ...(hasLogId ? ["log_id"] : []),
    ...(hasResidualFields ? residualColumns : []),
    ...(hasRecommendedAction ? ["recommended_action"] : []),
    ...(hasRequiredFields ? requiredFields : []),
    ...(hasEscalationFields ? escalationFields : []),
    ...(hasResolutionFields ? resolutionFields : [])
  ];
  const optionalSelection = selections.length ? `, ${selections.join(", ")}` : "";
  const rows = await queryRows(
    pool,
    `select alert_id, device_id, alert_type, severity, is_resolved, resolved_by, resolved_at, created_at${optionalSelection}
     from public.alerts order by alert_id`
  );
  return { rows, hasLogId, hasResidualFields, hasRecommendedAction, hasRequiredFields, hasEscalationFields, hasResolutionFields };
}

function createDemoAuditLogs({ numericUserIds = false, userIds = [] } = {}) {
  const users = userIds.length
    ? userIds
    : numericUserIds
      ? [2, 11, 10, 9, 8, 12]
      : ["AA002", "AA011", "AA010", "AA009", "AA008", "AA012"];
  const actions = [
    "User Login",
    "Telemetry Review",
    "Alert Created",
    "Alert Acknowledged",
    "Report Generated",
    "Heat Map Review",
    "Device Status Review",
    "Audit Log Viewed"
  ];
  const targets = [
    "A&E Ward oxygen status checked",
    "Paediatric Ward ghost flow investigation",
    "Labour Ward high usage threshold reviewed",
    "Recovery Bay residual gas alert recorded",
    "Nurse Station device telemetry confirmed",
    "Plant Room supply status synchronized",
    "System health card refreshed",
    "Monthly oxygen report opened"
  ];
  const logs = [];
  let auditId = 1;
  const start = new Date("2026-01-01T08:15:00Z");
  const end = new Date();
  end.setUTCHours(17, 45, 0, 0);
  const addDayLogs = day => {
    const countForDay = 2 + (auditId % 3);
    for (let index = 0; index < countForDay; index += 1) {
      const performedAt = new Date(day);
      performedAt.setUTCHours(8 + ((auditId + index) % 10), (auditId * 7 + index * 11) % 60, 0, 0);
      logs.push({
        audit_id: auditId,
        user_id: users[auditId % users.length],
        action: actions[(auditId + index) % actions.length],
        target_resource: targets[(auditId + index * 2) % targets.length],
        ip_address: `10.20.${(auditId % 30) + 1}.${40 + (auditId % 180)}`,
        performed_at: performedAt.toISOString()
      });
      auditId += 1;
    }
  };

  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    addDayLogs(day);
  }

  return logs;
}

async function queryRows(pool, sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function loadPermissions(pool) {
  const columnNames = await tableColumns(pool, "permissions");
  const labelColumn = columnNames.has("permission_key") ? "permission_key" : "permission_name";
  return queryRows(pool, `select permission_id, ${labelColumn} as permission_name from public.permissions order by permission_id`);
}

async function tableColumns(pool, tableName) {
  const columns = await queryRows(
    pool,
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [tableName]
  );
  return new Set(columns.map(column => column.column_name));
}

async function tableColumnDataType(pool, tableName, columnName) {
  const rows = await queryRows(
    pool,
    `select data_type
     from information_schema.columns
     where table_schema = 'public' and table_name = $1 and column_name = $2
     limit 1`,
    [tableName, columnName]
  );
  return rows[0]?.data_type || "";
}

function isIntegerDataType(dataType) {
  return ["integer", "bigint", "smallint"].includes(String(dataType || "").toLowerCase());
}

async function seedSupabaseDemoUsers(pool) {
  const roles = await queryRows(pool, "select role_id, lower(role_name) as role_name from public.roles");
  const adminRole = roles.find(role => ["administrator", "facilities admin"].includes(role.role_name));
  const facilitiesRole = roles.find(role => ["facilities manager", "facilities admin"].includes(role.role_name));
  const nurseRole = roles.find(role => role.role_name === "nurse");
  if (!adminRole || !facilitiesRole || !nurseRole) return;

  const users = [
    ["martin", "martin1", "robinsonmartin187@gmail.com", adminRole.role_id],
    ["martinm", "martin1", "robinsonmartin187@gmail.com", adminRole.role_id],
    ["vernon", "vernon1", "vernon.dacosta@gmail.com", adminRole.role_id],
    ["vernond", "vernon1", "vernon.dacosta@gmail.com", adminRole.role_id],
    ["facilities", "facilities1", "facilities.manager@monamercy.local", facilitiesRole.role_id],
    ["nurse", "nurse1", "ward.nurse@monamercy.local", nurseRole.role_id]
  ];

  for (const [username, password, email, roleId] of users) {
    await ensureOperationalUser(pool, username, password, email, roleId);
  }
}

async function seedSupabaseDemoAlerts(pool, remote) {
  if (remote.alerts.some(alert => !alert.is_resolved)) return;

  const demoEvents = [
    { device_id: "TK007", ward_id: "X002", flow_rate: 34.6, operational_status: "critical", alert_type: "critical_flow", severity: "critical" },
    { device_id: "TK004", ward_id: "X003", flow_rate: 31.2, operational_status: "warning", alert_type: "high_flow", severity: "high" },
    { device_id: "TK001", ward_id: "X001", flow_rate: 28.8, operational_status: "warning", alert_type: "warning", severity: "medium" },
    { device_id: "TK005", ward_id: "X003", flow_rate: 0, operational_status: "hardware_fault", alert_type: "hardware_fault", severity: "high" },
    { device_id: "TK008", ward_id: "X002", flow_rate: 15.4, operational_status: "warning", alert_type: "leakage", severity: "medium" }
  ];

  for (const [index, event] of demoEvents.entries()) {
    const createdAt = new Date(Date.now() - (demoEvents.length - index) * 120000).toISOString();
    const logResult = await pool.query(
      `insert into public.telemetry_logs
        (device_id, ward_id, flow_rate, operational_status, device_timestamp, received_at)
       values ($1, $2, $3, $4, $5, $5)
       returning log_id, device_id, ward_id, flow_rate, operational_status, device_timestamp, received_at`,
      [event.device_id, event.ward_id, event.flow_rate, event.operational_status, createdAt]
    );
    const log = logResult.rows[0];
    const alertResult = await pool.query(
      `insert into public.alerts
        (log_id, device_id, alert_type, severity, is_resolved, resolved_by, resolved_at, created_at)
       values ($1, $2, $3, $4, false, null, null, $5)
       returning alert_id, log_id, device_id, alert_type, severity, is_resolved, resolved_by, resolved_at, created_at`,
      [log.log_id, event.device_id, event.alert_type, event.severity, createdAt]
    );
    remote.telemetry_logs.push(log);
    remote.alerts.push(alertResult.rows[0]);
  }
}

async function seedSupabaseDemoAuditLogs(pool) {
  const auditLogColumns = await tableColumns(pool, "audit_logs");
  const userIdType = await tableColumnDataType(pool, "audit_logs", "user_id");
  const numericUserIds = isIntegerDataType(userIdType);
  const targetColumn = auditLogColumns.has("target_resource")
    ? "target_resource"
    : auditLogColumns.has("target")
      ? "target"
      : null;
  if (!targetColumn) return;

  const databaseUsers = await queryRows(pool, "select user_id from public.users order by user_id");
  if (!databaseUsers.length) return;
  const logs = createDemoAuditLogs({
    numericUserIds,
    userIds: databaseUsers.map(user => user.user_id)
  });
  const userIdSqlType = numericUserIds ? userIdType : "text";
  const values = [];
  const placeholders = logs.map((log, index) => {
    const base = index * 5;
    values.push(log.user_id, log.action, log.target_resource, log.ip_address, log.performed_at);
    return `($${base + 1}::${userIdSqlType}, $${base + 2}::text, $${base + 3}::text, $${base + 4}::text, $${base + 5}::timestamptz)`;
  }).join(",\n        ");

  await pool.query(
    `with demo_audit(user_id, action, target_resource, ip_address, performed_at) as (
       values
        ${placeholders}
     )
     insert into public.audit_logs (user_id, action, ${targetColumn}, ip_address, performed_at)
     select user_id, action, target_resource, ip_address::inet, performed_at
     from demo_audit demo
     where not exists (
       select 1
       from public.audit_logs existing
       where existing.user_id = demo.user_id
         and existing.action = demo.action
         and existing.${targetColumn} = demo.target_resource
         and existing.performed_at = demo.performed_at
     )`,
    values
  );
}

function nextId(rows, key) {
  return rows.reduce((max, row) => Math.max(max, Number(row[key]) || 0), 0) + 1;
}

function demoPasswordFor(username) {
  const passwords = {
    admin: "admin1",
    executive: "executive1",
    supervisor: "nurse1",
    facilities: "facilities1",
    nurse: "nurse1",
    robertm: "robert1",
    martinm: "martin1",
    martin: "martin1",
    vernond: "vernon1",
    vernon: "vernon1",
    nurse1: "nurse1",
    user1: "password1",
    user2: "password2"
  };
  return passwords[username] || "";
}

function demoPasswordAliasesFor(username) {
  const aliases = {
    robertm: ["password2"],
    martinm: ["martin1"],
    vernond: ["vernon1"]
  };
  return aliases[username] || [];
}

function createUser(user_id, username, password, email, role_id, password_hash) {
  return {
    user_id,
    username,
    email,
    email_verified: true,
    password,
    password_hash,
    role_id,
    created_at: demoCreatedAt
  };
}
