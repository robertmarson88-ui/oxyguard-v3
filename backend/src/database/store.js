export const demoCreatedAt = "2026-06-09T08:00:00Z";

export async function createRelationalStore() {
  const store = {
    source: "demo",
    roles: [
      { role_id: 1, role_name: "Administrator" },
      { role_id: 2, role_name: "Executive" },
      { role_id: 3, role_name: "Facilities Manager" },
      { role_id: 4, role_name: "Nurse Manager" },
      { role_id: 5, role_name: "Nurse" }
    ],
    permissions: [
      { permission_id: 1, permission_name: "resolve_alert" },
      { permission_id: 2, permission_name: "view_logs" }
    ],
    role_permissions: [
      { role_id: 1, permission_id: 1 },
      { role_id: 1, permission_id: 2 },
      { role_id: 2, permission_id: 2 },
      { role_id: 3, permission_id: 2 },
      { role_id: 4, permission_id: 2 },
      { role_id: 5, permission_id: 2 }
    ],
    users: [
      createUser("AA001", "martin", "martin1", "robinsonmartin187@gmail.com", 1, "demo-hash:martin-2026"),
      createUser("AA002", "robertm", "password2", "marsonrobert88@gmail.com", 1, "demo-hash:robertm-2026"),
      createUser("AA003", "vernon", "vernon1", "vernon.dacosta@gmail.com", 2, "demo-hash:vernon-2026"),
      createUser("AA004", "user1", "password1", "robertmarson88@gmail.com", 1, "demo-hash:user1-2026"),
      createUser("AA005", "user2", "password2", "robertmarson88@gmail.com", 1, "demo-hash:user2-2026"),
      createUser("AA006", "martinm", "martin1", "robinsonmartin187@gmail.com", 1, "demo-hash:martinm-2026"),
      createUser("AA007", "vernond", "vernon1", "vernon.dacosta@gmail.com", 1, "demo-hash:vernond-2026"),
      createUser("AA008", "admin", "admin1", "facilities.admin@monamercy.local", 1, "demo-hash:admin-2026"),
      createUser("AA009", "executive", "executive1", "executive@monamercy.local", 2, "demo-hash:executive-2026"),
      createUser("AA010", "supervisor", "nurse1", "nurse.supervisor@monamercy.local", 4, "demo-hash:supervisor-2026")
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
    audit_logs: [],
    nextLogId: 1,
    nextAlertId: 1,
    nextAuditId: 1
  };

  if (!process.env.DATABASE_URL) return store;

  try {
    const { Pool } = await import("pg");
    const pool = await connectPostgres(Pool);

    const remote = await loadSupabaseTables(pool);
    await seedSupabaseDemoAlerts(pool, remote);
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

function sanitizeDatabaseError(error) {
  return String(error?.message || "Unknown database connection error")
    .replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***:***@")
    .replace(/password=[^&\s]+/gi, "password=***");
}

async function connectPostgres(Pool) {
  const ssl = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });
    await pool.query("select 1");
    return pool;
  } catch (error) {
    if (!String(error.message || "").toLowerCase().includes("ssl")) throw error;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
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
  const [
    roles,
    permissions,
    rolePermissions,
    users,
    wards,
    devices,
    telemetryLogs,
    alerts,
    auditLogs
  ] = await Promise.all([
    queryRows(pool, "select role_id, role_name from public.roles order by role_id"),
    loadPermissions(pool),
    queryRows(pool, "select role_id, permission_id from public.role_permissions"),
    queryRows(pool, "select user_id, username, email, email_verified, password_hash, role_id, created_at from public.users order by user_id"),
    queryRows(pool, "select ward_id, ward_name, location from public.wards order by ward_id"),
    queryRows(pool, "select device_id, ward_id, created_at, device_name, device_status, last_seen, bed_id from public.devices order by device_id"),
    queryRows(pool, "select log_id, device_id, ward_id, flow_rate, operational_status, device_timestamp, received_at from public.telemetry_logs order by log_id"),
    queryRows(pool, "select alert_id, log_id, device_id, alert_type, severity, is_resolved, resolved_by, resolved_at, created_at from public.alerts order by alert_id"),
    queryRows(pool, `select audit_id, user_id, action, ${auditTargetSelect}, ${auditIpSelect}, performed_at from public.audit_logs order by audit_id`)
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
    telemetry_logs: telemetryLogs,
    alerts,
    audit_logs: auditLogs,
    audit_log_columns: [...auditLogColumns]
  };
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

function nextId(rows, key) {
  return rows.reduce((max, row) => Math.max(max, Number(row[key]) || 0), 0) + 1;
}

function demoPasswordFor(username) {
  const passwords = {
    admin: "admin1",
    executive: "executive1",
    supervisor: "nurse1",
    robertm: "robert1",
    martinm: "martin1",
    martin: "martin1",
    vernond: "vernon1",
    vernon: "vernon1",
    nurse1: "nurse1",
    facilities: "facilities1",
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
