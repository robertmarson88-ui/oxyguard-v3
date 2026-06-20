export const demoCreatedAt = "2026-06-09T08:00:00Z";

export function createRelationalStore() {
  return {
    roles: [
      { role_id: 1, role_name: "Administrator" },
      { role_id: 2, role_name: "Executive / CFO" },
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
      { role_id: 4, permission_id: 1 },
      { role_id: 4, permission_id: 2 },
      { role_id: 5, permission_id: 2 }
    ],
    users: [
      createUser("AA001", "martin", "martin1", "robinsonmartin187@gmail.com", 1, "demo-hash:martin-2026"),
      createUser("AA002", "robertm", "password1", "marsonrobert88@gmail.com", 1, "demo-hash:robertm-2026"),
      createUser("AA003", "vernon", "vernon1", "vernon.dacosta@gmail.com", 1, "demo-hash:vernon-2026"),
      createUser("AA004", "user1", "password1", "robertmarson88@gmail.com", 1, "demo-hash:user1-2026"),
      createUser("AA005", "user2", "password2", "robertmarson88@gmail.com", 1, "demo-hash:user2-2026"),
      createUser("AA006", "martinm", "martin1", "robinsonmartin187@gmail.com", 1, "demo-hash:martinm-2026"),
      createUser("AA007", "vernond", "vernon1", "vernon.dacosta@gmail.com", 1, "demo-hash:vernond-2026")
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
