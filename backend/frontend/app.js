const colors = {
  ae: "#0066cc",
  labour: "#6f42c1",
  paediatric: "#00a0dc",
  recovery: "#0f9f86",
  nurse: "#f28c28",
  green: "#27ae60",
  yellow: "#e5a80f",
  red: "#dc3545",
  grey: "#98a0a8"
};

const initialWards = [
  {
    id: "ae",
    name: "A&E Ward",
    subtitle: "Ward oxygen cylinder cluster",
    accent: colors.ae,
    tanks: [
      tank("Tank A1", "A1-OXY-1042", "Station 1", 52, 4),
      tank("Tank A2", "A2-OXY-1186", "Station 2", 50, 3),
      tank("Tank A3", "A3-OXY-1221", "Station 3", 48, 0, { active: false, occupied: false })
    ]
  },
  {
    id: "nurse",
    name: "Nurse Station",
    subtitle: "Live reading from Desktop data.txt",
    accent: colors.nurse,
    fileBacked: true,
    tanks: [
      tank("Nurse Station", "NS-FLOW-001", "Nurse Station", 48, 7, { stationFlowRate: 7, readOnly: true, maxVolume: 1200, volumeRemaining: 960 })
    ]
  },
  {
    id: "paediatric",
    name: "Paediatric Ward",
    subtitle: "Ward oxygen cylinder cluster",
    accent: colors.paediatric,
    tanks: [
      tank("Tank C1", "C1-OXY-3017", "Station 1", 47, 2, { volumeRemaining: 60 }),
      tank("Tank C2", "C2-OXY-3164", "Station 2", 46, 3),
      tank("Tank C3", "C3-OXY-3298", "Station 3", 45, 6, { active: false, occupied: false })
    ]
  },
  {
    id: "recovery",
    name: "Recovery Bay",
    subtitle: "Post-care oxygen recovery area",
    accent: colors.recovery,
    tanks: [
      tank("Tank R1", "R1-OXY-4106", "Bay 1", 48, 4, { volumeRemaining: 96 }),
      tank("Tank R2", "R2-OXY-4250", "Bay 2", 47, 5)
    ]
  },
  {
    id: "labour",
    name: "Labour Ward",
    subtitle: "Ward oxygen cylinder cluster",
    accent: colors.labour,
    tanks: [
      tank("Tank B1", "B1-OXY-2108", "Station 1", 49, 5),
      tank("Tank B2", "B2-OXY-2254", "Station 2", 51, 4, { active: false }),
      tank("Tank B3", "B3-OXY-2390", "Station 3", 47, 12, { stationFlowRate: 4, fixedFlow: true })
    ]
  }
];

const TANK_VOLUME_LITRES = 31700;
const OXYGEN_COST_PER_LITRE = 1.51;
const TANK_COST = 48000;
const YESTERDAY_CONSUMPTION_LITRES = 69077;
const ESP32_DEVICE_TOTAL = 24;
const depletionVolumeFloors = {
  "Tank R1": 8,
  "Tank C1": 5
};
const analyticsMonths = ["Jan", "Feb", "Mar", "Apr", "May"];
const analyticsData = [
  { ward: "A&E Ward", accent: colors.ae, usage: [18, 21, 24, 27, 30], leakage: [2, 3, 4, 3, 5] },
  { ward: "Labour Ward", accent: colors.labour, usage: [14, 16, 17, 18, 20], leakage: [1, 2, 2, 3, 2] },
  { ward: "Paediatric Ward", accent: colors.paediatric, usage: [20, 22, 26, 29, 34], leakage: [3, 4, 5, 7, 8] },
  { ward: "Recovery Bay", accent: colors.recovery, usage: [10, 12, 13, 15, 16], leakage: [1, 1, 2, 2, 3] },
  { ward: "Nurse Station", accent: colors.nurse, usage: [4, 5, 5, 6, 7], leakage: [0, 0, 1, 1, 1] }
];
const dashboardDemoAlertsByWard = {
  ae: { activeAlerts: 1, critical: 1, warning: 2 },
  nurse: { activeAlerts: 0, critical: 0, warning: 1 },
  paediatric: { activeAlerts: 2, critical: 2, warning: 2 },
  recovery: { activeAlerts: 1, critical: 1, warning: 1 },
  labour: { activeAlerts: 1, critical: 1, warning: 2 }
};
const ACTIVE_PATIENT_TARGET = 35;
const patientAlertScenarios = [
  { ward: "Paediatric Ward / Station 1", setValue: 2, liveReading: 2.7 },
  { ward: "Recovery Bay / Bay 1", setValue: 3, liveReading: 2.4 },
  { ward: "Labour Ward / Station 3", setValue: 4, liveReading: 4.2 },
  { ward: "A&E Ward / Station 1", setValue: 3, liveReading: 4.1 },
  { ward: "Nurse Station", setValue: 2, liveReading: 2 }
];
const dashboardDemoPatientRows = Array.from({ length: ACTIVE_PATIENT_TARGET }, (_, index) => {
  const scenario = patientAlertScenarios[index % patientAlertScenarios.length];
  const status = evaluatePatientFlowStatus(scenario.setValue, scenario.liveReading);
  return [
    `PT-${String(index + 1).padStart(4, "0")}`,
    scenario.ward,
    formatFlow(scenario.setValue),
    formatFlow(scenario.liveReading),
    formatVariance(status.variance),
    status.badge,
    status.message
  ];
});
const dashboardDemoDepletionRows = {
  all: [
    ["Paediatric Ward", "Tank C1", "C1-OXY-3017", "60 L (5%)", "3h 10m", badge("Empty", "bad")],
    ["Recovery Bay", "Tank R1", "R1-OXY-4106", "96 L (8%)", "5h 15m", badge("Empty", "bad")],
    ["Labour Ward", "Tank B3", "B3-OXY-2390", "312 L (26%)", "9h 30m", badge("Moderate", "warn")],
    ["A&E Ward", "Tank A2", "A2-OXY-1186", "834 L (70%)", "12h 40m", badge("Full", "good")]
  ],
  critical: [
    ["Paediatric Ward", "Tank C1", "C1-OXY-3017", "60 L (5%)", "3h 10m", badge("Empty", "bad")],
    ["Recovery Bay", "Tank R1", "R1-OXY-4106", "96 L (8%)", "5h 15m", badge("Empty", "bad")]
  ],
  warning: [
    ["Labour Ward", "Tank B3", "B3-OXY-2390", "312 L (26%)", "9h 30m", badge("Moderate", "warn")],
    ["A&E Ward", "Tank A1", "A1-OXY-1042", "288 L (24%)", "7h 45m", badge("Moderate", "warn")]
  ],
  normal: [
    ["A&E Ward", "Tank A2", "A2-OXY-1186", "834 L (70%)", "12h 40m", badge("Full", "good")],
    ["Labour Ward", "Tank B1", "B1-OXY-2108", "756 L (63%)", "8h 15m", badge("Full", "good")]
  ]
};
const reportDemoData = [
  {
    month: "2026-01",
    label: "Jan",
    wards: {
      ae: { activeTanks: 3, avgFlow: 10, avgPressure: 49, alerts: 2, depleted: 7, critical: 1, wastage: 2.4, usage: 18 },
      nurse: { activeTanks: 1, avgFlow: 4, avgPressure: 48, alerts: 0, depleted: 2, critical: 0, wastage: 0.6, usage: 4 },
      paediatric: { activeTanks: 3, avgFlow: 12, avgPressure: 47, alerts: 3, depleted: 8, critical: 2, wastage: 3.1, usage: 20 },
      recovery: { activeTanks: 2, avgFlow: 8, avgPressure: 48, alerts: 1, depleted: 4, critical: 0, wastage: 1.3, usage: 10 },
      labour: { activeTanks: 2, avgFlow: 13, avgPressure: 49, alerts: 1, depleted: 5, critical: 1, wastage: 1.8, usage: 14 }
    }
  },
  {
    month: "2026-02",
    label: "Feb",
    wards: {
      ae: { activeTanks: 3, avgFlow: 11, avgPressure: 48, alerts: 3, depleted: 8, critical: 1, wastage: 2.8, usage: 21 },
      nurse: { activeTanks: 1, avgFlow: 4, avgPressure: 48, alerts: 0, depleted: 2, critical: 0, wastage: 0.7, usage: 5 },
      paediatric: { activeTanks: 3, avgFlow: 13, avgPressure: 46, alerts: 4, depleted: 9, critical: 2, wastage: 3.5, usage: 22 },
      recovery: { activeTanks: 2, avgFlow: 8, avgPressure: 48, alerts: 1, depleted: 5, critical: 0, wastage: 1.5, usage: 12 },
      labour: { activeTanks: 2, avgFlow: 14, avgPressure: 49, alerts: 2, depleted: 6, critical: 1, wastage: 2.0, usage: 16 }
    }
  },
  {
    month: "2026-03",
    label: "Mar",
    wards: {
      ae: { activeTanks: 3, avgFlow: 12, avgPressure: 48, alerts: 4, depleted: 9, critical: 2, wastage: 3.0, usage: 24 },
      nurse: { activeTanks: 1, avgFlow: 5, avgPressure: 47, alerts: 1, depleted: 2, critical: 0, wastage: 0.8, usage: 5 },
      paediatric: { activeTanks: 3, avgFlow: 14, avgPressure: 46, alerts: 5, depleted: 10, critical: 3, wastage: 4.1, usage: 26 },
      recovery: { activeTanks: 2, avgFlow: 9, avgPressure: 47, alerts: 2, depleted: 5, critical: 1, wastage: 1.7, usage: 13 },
      labour: { activeTanks: 2, avgFlow: 15, avgPressure: 48, alerts: 2, depleted: 7, critical: 1, wastage: 2.2, usage: 17 }
    }
  },
  {
    month: "2026-04",
    label: "Apr",
    wards: {
      ae: { activeTanks: 3, avgFlow: 13, avgPressure: 47, alerts: 3, depleted: 10, critical: 2, wastage: 3.2, usage: 27 },
      nurse: { activeTanks: 1, avgFlow: 5, avgPressure: 47, alerts: 1, depleted: 3, critical: 0, wastage: 0.9, usage: 6 },
      paediatric: { activeTanks: 3, avgFlow: 15, avgPressure: 45, alerts: 7, depleted: 12, critical: 4, wastage: 4.8, usage: 29 },
      recovery: { activeTanks: 2, avgFlow: 10, avgPressure: 47, alerts: 2, depleted: 6, critical: 1, wastage: 1.9, usage: 15 },
      labour: { activeTanks: 2, avgFlow: 16, avgPressure: 48, alerts: 3, depleted: 7, critical: 2, wastage: 2.4, usage: 18 }
    }
  },
  {
    month: "2026-05",
    label: "May",
    wards: {
      ae: { activeTanks: 3, avgFlow: 14, avgPressure: 47, alerts: 5, depleted: 11, critical: 3, wastage: 3.6, usage: 30 },
      nurse: { activeTanks: 1, avgFlow: 6, avgPressure: 46, alerts: 1, depleted: 3, critical: 0, wastage: 1.1, usage: 7 },
      paediatric: { activeTanks: 3, avgFlow: 16, avgPressure: 45, alerts: 8, depleted: 13, critical: 4, wastage: 5.2, usage: 34 },
      recovery: { activeTanks: 2, avgFlow: 10, avgPressure: 47, alerts: 3, depleted: 6, critical: 1, wastage: 2.2, usage: 16 },
      labour: { activeTanks: 2, avgFlow: 17, avgPressure: 48, alerts: 2, depleted: 8, critical: 2, wastage: 2.5, usage: 20 }
    }
  },
  {
    month: "2026-06",
    label: "Jun",
    wards: {
      ae: { activeTanks: 2, avgFlow: 12, avgPressure: 49, alerts: 3, depleted: 6, critical: 1, wastage: 2.6, usage: 19 },
      nurse: { activeTanks: 1, avgFlow: 4, avgPressure: 48, alerts: 1, depleted: 1, critical: 0, wastage: 0.7, usage: 4 },
      paediatric: { activeTanks: 2, avgFlow: 13, avgPressure: 46, alerts: 4, depleted: 7, critical: 2, wastage: 3.7, usage: 21 },
      recovery: { activeTanks: 2, avgFlow: 9, avgPressure: 48, alerts: 2, depleted: 4, critical: 1, wastage: 1.6, usage: 11 },
      labour: { activeTanks: 2, avgFlow: 18, avgPressure: 49, alerts: 3, depleted: 7, critical: 2, wastage: 2.9, usage: 18 }
    }
  }
];

let wards;
let wastage;
let flowIndex;
let flashRed;
let activeView = "report";
let timers = [];
let currentUser = null;
let pipelineFilter = "";
let depletionStatusFilter = "all";
let selectedReportType = "operations";
let selectedReportPeriod = "today";
let permissionPreview = "admin";
let esp32OfflineDevices = 1;
let esp32LastFluctuation = 0;
let acknowledgedAlertSignature = "";
let databaseAlertRows = [];
let databaseAlertsLoaded = false;

const permissionViews = {
  admin: {
    label: "Admin",
    allowedViews: ["report", "dashboard", "alert", "analytics", "order", "administration"]
  },
  "nurse-supervisor": {
    label: "Nurse Supervisor",
    allowedViews: ["report", "dashboard", "alert"]
  },
  maintenance: {
    label: "Maintenance User",
    allowedViews: ["report", "alert", "order"]
  },
  viewer: {
    label: "Viewer",
    allowedViews: ["report"]
  }
};

function tank(name, serial, station, pressure, flowRate, options = {}) {
  return {
    name,
    serial,
    station,
    pressure,
    flowRate,
    stationFlowRate: options.stationFlowRate ?? flowRate,
    maxVolume: options.maxVolume ?? 1200,
    volumeRemaining: options.volumeRemaining ?? 1200,
    active: options.active ?? true,
    occupied: options.occupied ?? true,
    leakageAlert: false,
    highFlowAlert: false,
    fixedFlow: options.fixedFlow ?? false,
    readOnly: options.readOnly ?? false,
    alertMessage: ""
  };
}

function cloneWards() {
  return structuredClone(initialWards);
}

function start() {
  resetState();
  setupLogin();
  document.getElementById("resetDemo").addEventListener("click", resetState);
  document.getElementById("refreshAnalytics").addEventListener("click", renderAnalytics);
  document.getElementById("protocolDetails")?.addEventListener("click", () => {
    window.alert("Protocol details: automated replenishment is triggered when projected depletion falls below the safety buffer.");
  });
  document.getElementById("downloadOrderSummary")?.addEventListener("click", () => {
    window.alert("Order summary downloaded.");
  });
  document.getElementById("rejectOrder")?.addEventListener("click", () => {
    window.alert("Automated order was rejected and marked for review.");
  });
  document.getElementById("confirmOrder")?.addEventListener("click", () => {
    window.alert("Order confirmed. Purchase order AUTO-PO-2026-0418-01 is pending supplier acknowledgement.");
  });
  document.getElementById("adminAddUserButton")?.addEventListener("click", openUserManagement);
  document.getElementById("manageUsersButton")?.addEventListener("click", openUserManagement);
  document.getElementById("adminAddDeviceButton")?.addEventListener("click", () => {
    window.alert("Demo action: open the device registration workflow.");
  });
  document.getElementById("closeDialog").addEventListener("click", () => document.getElementById("wardDialog").close());
  document.getElementById("closeUserDialog")?.addEventListener("click", () => document.getElementById("userDialog")?.close());
  document.getElementById("createUserForm")?.addEventListener("submit", createUser);
  document.getElementById("updateUserForm")?.addEventListener("submit", updateUserPermission);
  document.getElementById("closeHeatMapDialog")?.addEventListener("click", () => document.getElementById("heatMapDialog")?.close());
  document.getElementById("dashboardHeatMapCard")?.addEventListener("click", openHeatMapDialog);
  document.getElementById("dashboardHeatMapCard")?.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openHeatMapDialog();
    }
  });
  document.getElementById("logoutButton").addEventListener("click", logout);
  setupNotifications();
  setupPermissionPreview();
  setupDepletionFilters();
  setupReportGenerator();
  setupPipelineFilters();
  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

function setupDepletionFilters() {
  document.querySelectorAll("[data-depletion-filter]").forEach(button => {
    button.addEventListener("click", () => {
      depletionStatusFilter = button.dataset.depletionFilter;
      renderReport();
    });
  });
}

function setupReportGenerator() {
  const reportMonth = document.getElementById("reportStartMonth");
  if (!reportMonth) return;

  const today = getReportToday();
  const startDate = document.getElementById("reportStartDate");
  const endDate = document.getElementById("reportEndDate");
  if (startDate && endDate) {
    startDate.min = "2026-01-01";
    startDate.max = toDateInputValue(today);
    endDate.min = "2026-01-01";
    endDate.max = toDateInputValue(today);
    startDate.value = "2026-01-01";
    endDate.value = toDateInputValue(today);
  }
  syncReportMonthsFromDates();

  ["reportStartMonth", "reportEndMonth"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      selectedReportPeriod = "";
      document.getElementById("reportEndMonth").value = document.getElementById("reportStartMonth").value;
      renderGeneratedReport();
      renderReportLiveInsights();
      renderMonthlyUsageComparison();
    });
  });
  ["reportStartDate", "reportEndDate"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      selectedReportPeriod = "";
      normalizeReportDateRange();
      syncReportMonthsFromDates();
      renderGeneratedReport();
      renderReportLiveInsights();
      renderMonthlyUsageComparison();
    });
  });
  document.querySelectorAll("[data-report-type]").forEach(button => {
    button.addEventListener("click", () => {
      selectedReportType = button.dataset.reportType;
      const reportTypeSelect = document.getElementById("reportTypeSelect");
      if (reportTypeSelect) reportTypeSelect.value = selectedReportType;
      renderGeneratedReport();
    });
  });
  document.getElementById("reportTypeSelect")?.addEventListener("change", event => {
    selectedReportType = event.target.value;
    renderGeneratedReport();
  });
  document.getElementById("emailGeneratedReport")?.addEventListener("click", () => {
    renderGeneratedReport();
    renderReportLiveInsights();
    renderMonthlyUsageComparison();
  });
  document.getElementById("printGeneratedReport")?.addEventListener("click", () => window.print());
}

function emailGeneratedReport() {
  const report = buildGeneratedReport(selectedReportType);
  const lines = [
    report.title,
    report.range,
    report.description,
    "",
    "Key Metrics:",
    ...report.kpis.map(item => `${item.label}: ${item.value}`),
    "",
    "Brief Analysis:",
    ...report.brief.map(item => `- ${item}`)
  ];
  const subject = encodeURIComponent(`OxyGuard ${report.title}`);
  const body = encodeURIComponent(lines.join("\n"));
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function setupNotifications() {
  const button = document.getElementById("alertNotificationButton");
  const panel = document.getElementById("alertNotificationPanel");
  if (!button || !panel) return;
  button.addEventListener("click", () => {
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    button.setAttribute("aria-expanded", String(!isOpen));
    if (!isOpen) {
      acknowledgedAlertSignature = getAlertSignature(activeAlerts());
      button.classList.remove("has-alert");
    }
  });
  document.addEventListener("click", event => {
    if (panel.hidden || event.target.closest(".notification-wrap")) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  });
}

function setupPipelineFilters() {
  document.querySelectorAll("[data-pipeline-filter]").forEach(button => {
    button.addEventListener("click", () => {
      pipelineFilter = pipelineFilter === button.dataset.pipelineFilter ? "" : button.dataset.pipelineFilter;
      renderWards();
    });
  });
}

function setupLogin() {
  const form = document.getElementById("loginForm");
  const username = document.getElementById("loginUsername");
  const password = document.getElementById("loginPassword");
  const submit = document.getElementById("loginSubmit");
  const error = document.getElementById("loginError");

  const savedUser = readSavedUser();
  if (savedUser) {
    currentUser = savedUser;
    showApp();
  } else {
    username.focus();
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.classList.remove("visible");
    submit.disabled = true;

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.value.trim(), password: password.value })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Invalid username or password.");
      }

      currentUser = {
        ...result.user,
        accessToken: result.access_token,
        loginAt: new Date().toISOString()
      };
      sessionStorage.setItem("oxyguardUser", JSON.stringify(currentUser));
      password.value = "";
      error.classList.remove("visible");
      showApp();
    } catch (authError) {
      error.textContent = authError.message;
      error.classList.add("visible");
    } finally {
      submit.disabled = false;
    }
  });
}

function resetLoginStep() {
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginSubmit").textContent = "Login";
  document.getElementById("loginHint").textContent = "";
  document.getElementById("loginError").classList.remove("visible");
}

function showApp() {
  document.body.classList.remove("login-active");
  document.getElementById("appShell").removeAttribute("aria-hidden");
  applyRoleAccess();
  updateCurrentUserDisplay();
  updatePageTitle();
  loadDatabaseAlerts();
}

function logout() {
  if (!window.confirm("Are you sure you want to logout?")) return;
  currentUser = null;
  permissionPreview = "admin";
  sessionStorage.removeItem("oxyguardUser");
  document.body.classList.add("login-active");
  document.getElementById("appShell").setAttribute("aria-hidden", "true");
  resetLoginStep();
  document.getElementById("loginUsername").focus();
}

function readSavedUser() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("oxyguardUser") || "null");
    return saved && saved.username && saved.role ? saved : null;
  } catch {
    return null;
  }
}

async function loadDatabaseAlerts() {
  if (!currentUser?.accessToken) return;
  try {
    const response = await fetch("/api/alerts?is_resolved=false", {
      cache: "no-store",
      headers: { authorization: `Bearer ${currentUser.accessToken}` }
    });
    if (!response.ok) return;
    const alerts = await response.json();
    databaseAlertRows = Array.isArray(alerts) ? alerts.map(mapDatabaseAlertRow) : [];
    databaseAlertsLoaded = true;
    if (activeView === "alert") renderRealTimeAlert();
    updateNotifications(activeAlerts());
  } catch {
    databaseAlertsLoaded = false;
  }
}

function mapDatabaseAlertRow(alert, index) {
  const ward = getWardLabelFromDevice(alert.device_id);
  const priority = mapAlertPriority(alert.severity);
  return {
    time: formatActivityTime(alert.created_at || new Date().toISOString()),
    ward,
    type: formatAlertType(alert.alert_type),
    priority,
    asset: alert.device_id || `Sensor ${index + 1}`,
    status: priority === "Critical" ? "Awaiting Response" : "Investigating",
    assigned: priority === "Critical" ? "Facilities" : "Nurse Station",
    source: "database"
  };
}

function getWardLabelFromDevice(deviceId = "") {
  const value = String(deviceId).toLowerCase();
  if (value.includes("icu") || value.includes("ae") || value.includes("a&e")) return "A&E Ward";
  if (value.includes("paed") || value.includes("c1") || value.includes("c2") || value.includes("c3")) return "Paediatric Ward";
  if (value.includes("recovery") || value.includes("r1") || value.includes("r2")) return "Recovery Bay";
  if (value.includes("labour") || value.includes("b1") || value.includes("b2") || value.includes("b3")) return "Labour Ward";
  if (value.includes("nurse")) return "Nurse Station";
  return "Telemetry Ward";
}

function formatAlertType(type = "") {
  const labels = {
    critical_flow: "Critical Flow",
    high_flow: "High Abnormal Flow",
    hardware_fault: "Device Offline",
    warning: "Flow Warning",
    leakage: "Leakage Detected",
    ghost_flow: "Ghost Flow"
  };
  return labels[type] || String(type).replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase()) || "Telemetry Alert";
}

function mapAlertPriority(severity = "") {
  const value = String(severity).toLowerCase();
  if (value === "critical") return "Critical";
  if (value === "high") return "High";
  if (value === "medium") return "Medium";
  return "Low";
}

function applyRoleAccess() {
  const isAdmin = currentUser?.role === "admin";
  const access = getActivePermissionView();

  document.querySelectorAll(".side-button[data-view]").forEach(button => {
    button.hidden = !access.allowedViews.includes(button.dataset.view);
  });
  updateUserCount();
  document.getElementById("sidebarUser").innerHTML = currentUser
    ? `
      <div class="user-avatar">${currentUser.username.slice(0, 1).toUpperCase()}</div>
      <div class="user-meta">
        <strong>${currentUser.username}</strong>
        ${isAdmin ? `
          <div class="permission-preview" id="permissionPreviewWrap">
            <button class="permission-preview-button" id="permissionPreviewButton" type="button" aria-expanded="false" aria-controls="permissionPreviewMenu">
              <span>View</span>
              <strong id="permissionPreviewLabel">${access.label}</strong>
            </button>
            <div class="permission-preview-menu" id="permissionPreviewMenu" hidden>
              <button type="button" data-permission-view="admin">Admin</button>
              <button type="button" data-permission-view="nurse-supervisor">Nurse Supervisor</button>
              <button type="button" data-permission-view="maintenance">Maintenance User</button>
            </div>
          </div>
        ` : `<span class="user-role">${currentUser.label}</span>`}
      </div>
    `
    : "";
  if (!access.allowedViews.includes(activeView)) {
    setView(access.allowedViews[0] || "report");
  }
}

function setupPermissionPreview() {
  document.addEventListener("click", event => {
    const option = event.target.closest?.("[data-permission-view]");
    const button = event.target.closest?.("#permissionPreviewButton");
    const activeButton = document.getElementById("permissionPreviewButton");
    const menu = document.getElementById("permissionPreviewMenu");

    if (option) {
      permissionPreview = option.dataset.permissionView;
      if (activeButton) activeButton.setAttribute("aria-expanded", "false");
      if (menu) menu.hidden = true;
      applyRoleAccess();
      updateCurrentUserDisplay();
      updatePageTitle();
      return;
    }

    if (button && menu) {
      event.stopPropagation();
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      menu.hidden = expanded;
      return;
    }

    if (menu && activeButton && !menu.hidden && !menu.contains(event.target)) {
      activeButton.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    }
  });
}

function getActivePermissionView() {
  if (currentUser?.role !== "admin") return permissionViews.viewer;
  return permissionViews[permissionPreview] || permissionViews.admin;
}

function resetState() {
  timers.forEach(clearInterval);
  timers = [];
  wards = cloneWards();
  wastage = 3;
  flowIndex = 0;
  flashRed = false;
  pipelineFilter = "";
  esp32OfflineDevices = 1;
  esp32LastFluctuation = 0;

  renderAll();
  scheduleDemo();
  loadNurseStationData();
  timers.push(setInterval(updateClock, 1000));
  timers.push(setInterval(liveTick, 2000));
  timers.push(setInterval(loadNurseStationData, 2500));
  timers.push(setInterval(() => {
    flowIndex = (flowIndex + 1) % wards.length;
    updateMetrics();
  }, 3000));
  timers.push(setInterval(() => {
    flashRed = !flashRed;
    renderWards();
  }, 500));
  timers.push(setInterval(renderV5TrendAnalytics, 3000));
  timers.push(setInterval(loadDatabaseAlerts, 7000));
  updateClock();
}

function renderAll() {
  renderWards();
  updateMetrics();
  renderReport();
  renderGeneratedReport();
  renderReportLiveInsights();
  renderMonthlyUsageComparison();
  renderOrderSummary();
  renderAdministration();
  renderAnalytics();
  updateNotifications();
  updateFooter();
}

function setView(view) {
  const access = getActivePermissionView();
  if (!access.allowedViews.includes(view)) {
    view = access.allowedViews[0] || "report";
  }
  activeView = view;
  document.querySelectorAll(".view").forEach(section => {
    section.classList.toggle("active-view", section.id === `${view}View`);
  });
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  if (view === "report") renderReport();
  if (view === "alert") renderWards();
  if (view === "dashboard") {
    renderGeneratedReport();
    renderReportLiveInsights();
    renderMonthlyUsageComparison();
  }
  if (view === "order") renderOrderSummary();
  if (view === "administration") renderAdministration();
  if (view === "analytics") renderAnalytics();
  updatePageTitle();
}

function renderWards() {
  const grid = document.getElementById("wardGrid");
  const alertGrid = document.getElementById("alertKpiGrid");
  if (alertGrid) {
    renderRealTimeAlert();
  }
  if (!grid) return;
  updatePipelineFilterButtons();
  const visibleWards = wards
    .map(ward => ({ ward, tanks: getVisibleTanks(ward) }))
    .filter(item => item.tanks.length);

  if (!visibleWards.length) {
    grid.innerHTML = `
      <article class="ward-card empty-filter">
        <strong>No wards match this pipeline status</strong>
        <span>Click the active status line again to show all wards.</span>
      </article>
    `;
    return;
  }

  grid.innerHTML = visibleWards.map(({ ward, tanks }) => renderWardCard(ward, tanks)).join("");
  grid.querySelectorAll(".ward-card[data-ward]").forEach(card => {
    card.addEventListener("click", () => openWard(card.dataset.ward));
  });
}

function renderRealTimeAlert() {
  const activeTanks = wards.flatMap(w => w.tanks).filter(t => t.active);
  const alertRows = getAlertIncidentRows();
  const criticalTanks = activeTanks.filter(t => getReportVolumePercent(t) < 10);
  const activeTankCount = activeTanks.length;
  const totalTankCount = 40;

  const kpiGrid = document.getElementById("alertKpiGrid");
  if (kpiGrid) {
    kpiGrid.innerHTML = [
      alertKpiCard("Critical Alerts", alertRows.filter(r => r.priority === "Critical").length, "Require immediate action", "danger", "View Alerts"),
      alertKpiCard("Active Alerts", alertRows.length, "Across all wards", "warning", "View All"),
      alertKpiCard("Total Tanks", `<span id="activePatients">${activeTankCount} / ${totalTankCount}</span>`, "Tanks in use", "blue"),
      alertKpiCard("System Status", `<span id="systemAlert">Monitoring</span>`, `<span id="alertText">All systems normal</span>`, "success"),
      alertKpiCard("Wastage Today", `<span id="wastage">${wastage}%</span>`, `<span id="wastageStatus">vs yesterday</span>`, "purple", "+ 8%"),
      alertKpiCard("Critical Tanks", criticalTanks.length, "Need attention", "danger", "View Tanks")
    ].join("");
  }

  const incidentCount = document.getElementById("activeIncidentCount");
  if (incidentCount) incidentCount.textContent = String(alertRows.length);

  const incidentTarget = document.getElementById("alertIncidentsTable");
  if (incidentTarget) {
    incidentTarget.innerHTML = `
      <table class="alert-data-table">
        <thead><tr><th>Time</th><th>Ward</th><th>Alert Type</th><th>Priority</th><th>Bed / Tank</th><th>Status</th><th>Assigned To</th></tr></thead>
        <tbody>${alertRows.map(row => `
          <tr>
            <td>${row.time}</td>
            <td>${row.ward}</td>
            <td>${row.type}</td>
            <td>${alertPill(row.priority)}</td>
            <td>${row.asset}</td>
            <td>${alertStatus(row.status)}</td>
            <td>${row.assigned}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    `;
  }

  const mapTarget = document.getElementById("alertPipelineMap");
  if (mapTarget) mapTarget.innerHTML = renderAlertPipelineMap();

  const feedTarget = document.getElementById("alertActivityFeed");
  if (feedTarget) {
    const feed = databaseAlertRows.length ? databaseAlertRows.slice(0, 5).map(row => [
      row.time,
      row.priority === "Critical" ? "danger" : row.priority === "High" ? "warning" : "info",
      `${row.type} at ${row.asset}, ${row.ward}`
    ]) : [
      ["11:42 AM", "danger", "Ghost flow detected at Bed 07, A&E Ward"],
      ["11:43 AM", "info", "Alert sent to Facilities Team"],
      ["11:44 AM", "success", "Facilities acknowledged the alert"],
      ["11:46 AM", "warning", "Investigation started at Bed 07"],
      ["11:47 AM", "success", "Pressure normal at Tank C1"]
    ];
    feedTarget.innerHTML = feed.map(item => `
      <div class="alert-feed-row">
        <time>${item[0]}</time>
        <i class="${item[1]}"></i>
        <span>${item[2]}</span>
      </div>
    `).join("");
  }

  const wardTarget = document.getElementById("alertWardCards");
  if (wardTarget) {
    wardTarget.innerHTML = getAlertWardCards().map(renderAlertWardCard).join("");
  }

  const assignmentTarget = document.getElementById("patientAssignmentPanel");
  if (assignmentTarget) {
    const rows = [
      ["Bed 07", "Off", "Flow detected", "Ghost Flow"],
      ["Bed 11", "On", "No Flow", "Supply Failure"],
      ["Bed 12", "On", "Abnormal Flow", "Flow Anomaly"],
      ["Bed 05", "On", "Normal Flow", "Normal"],
      ["Bed 16", "Off", "No Flow", "Normal"]
    ];
    assignmentTarget.innerHTML = `
      <table class="alert-data-table compact">
        <thead><tr><th>Bed</th><th>Patient Flag</th><th>Flow Status</th><th>Result</th></tr></thead>
        <tbody>${rows.map(row => `
          <tr>
            <td>${row[0]}</td>
            <td>${assignmentFlag(row[1])}</td>
            <td>${row[2]}</td>
            <td>${assignmentResult(row[3])}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    `;
  }
}

function alertKpiCard(label, value, detail, tone, action = "") {
  const iconLabels = { danger: "!", warning: "A", blue: "O2", success: "~", purple: "%"};
  return `
    <article class="alert-kpi ${tone}">
      <div class="alert-kpi-icon">${iconLabels[tone] || "O2"}</div>
      <div class="alert-kpi-copy">
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${detail}</small>
      </div>
      ${action ? `<button type="button">${action}</button>` : ""}
    </article>
  `;
}

function getAlertIncidentRows() {
  const demoRows = [
    { time: "11:42 AM", ward: "A&E Ward", type: "Ghost Flow", priority: "Critical", asset: "Bed 07", status: "Awaiting Response", assigned: "Facilities" },
    { time: "11:43 AM", ward: "Recovery Bay", type: "Leakage Detected", priority: "High", asset: "Tank R1", status: "Investigating", assigned: "Maintenance" },
    { time: "11:44 AM", ward: "Labour Ward", type: "Oxygen Supply Failure", priority: "High", asset: "Bed 03", status: "Acknowledged", assigned: "Nurse Station" },
    { time: "11:45 AM", ward: "Paediatric Ward", type: "Flow Anomaly", priority: "Medium", asset: "Bed 12", status: "Investigating", assigned: "Nurse Station" },
    { time: "11:47 AM", ward: "A&E Ward", type: "Critical Tank", priority: "Medium", asset: "Tank A2", status: "Awaiting Response", assigned: "Facilities" }
  ];
  const rows = databaseAlertRows.length
    ? [...databaseAlertRows, ...demoRows].slice(0, 6)
    : demoRows;
  activeAlerts().slice(0, 2).forEach((alert, index) => {
    rows[index].type = alert.includes("critical") ? "Critical Tank" : rows[index].type;
  });
  return rows;
}

function alertPill(priority) {
  const tone = priority === "Critical" ? "bad" : priority === "High" ? "warn" : "medium";
  return `<span class="alert-pill ${tone}">${priority}</span>`;
}

function alertStatus(status) {
  const tone = status === "Acknowledged" ? "info" : status === "Investigating" ? "warn" : "bad";
  return `<span class="alert-status ${tone}">${status}</span>`;
}

function assignmentFlag(value) {
  return `<span class="assignment-flag ${value === "On" ? "on" : "off"}">${value}</span>`;
}

function assignmentResult(value) {
  const tone = value === "Normal" ? "normal" : value === "Supply Failure" ? "failure" : value === "Flow Anomaly" ? "warning" : "danger";
  return `<span class="assignment-result ${tone}">${value}</span>`;
}

function getAlertWardCards() {
  return [
    { ward: "A&E Ward", pressure: 50, totalFlow: 6.8, rows: [["Bed 05", "PT-0005", "On", "4.0", "Normal"], ["Bed 06", "PT-0006", "On", "3.8", "Normal"], ["Bed 07", "PT-0007", "Off", "2.8", "Ghost Flow"]] },
    { ward: "Paediatrics Ward", pressure: 48, totalFlow: 7.7, rows: [["Bed 10", "PT-0010", "On", "2.5", "Normal"], ["Bed 11", "PT-0011", "On", "0.0", "Supply Failure"], ["Bed 12", "PT-0012", "On", "5.2", "Flow Anomaly"]] },
    { ward: "Recovery Bay", pressure: 45, totalFlow: 4.1, rows: [["Bed 15", "PT-0015", "On", "4.1", "Normal"], ["Bed 16", "PT-0016", "Off", "0.0", "Normal"], ["Tank R1", "TANK-R1", "-", "-", "Leakage"]] },
    { ward: "Labour Ward", pressure: 47, totalFlow: 3.8, rows: [["Bed 20", "PT-0020", "On", "3.9", "Normal"], ["Bed 21", "PT-0021", "On", "0.0", "Supply Failure"], ["Bed 22", "PT-0022", "Off", "0.0", "Normal"]] }
  ];
}

function renderAlertWardCard(card) {
  return `
    <article class="alert-panel alert-ward-panel">
      <div class="alert-panel-head">
        <h3>${card.ward}</h3>
        <span class="live-dot">Live</span>
      </div>
      <table class="alert-data-table compact">
        <thead><tr><th>Bed / Tank</th><th>Patient Flag</th><th>Flow</th><th>Status</th></tr></thead>
        <tbody>${card.rows.map(row => `
          <tr>
            <td><b>${row[0]}</b><small>${row[1]}</small></td>
            <td>${assignmentFlag(row[2])}</td>
            <td>${row[3]}</td>
            <td>${assignmentResult(row[4])}</td>
          </tr>
        `).join("")}</tbody>
      </table>
      <footer>Avg Pressure: ${card.pressure} PSI | Total Flow: ${card.totalFlow} Litre/Min</footer>
    </article>
  `;
}

function renderAlertPipelineMap() {
  const flowTotal = Math.round(wards.reduce((sum, ward) => sum + totalFlow(ward), 0));
  return `
    <div class="pipeline-canvas live-pipeline" style="--flow-speed:${Math.max(2.6, 7 - flowTotal / 10)}s">
      <div class="tank-farm">
        <strong>Main Tank Farm</strong>
        <span>4 Tanks</span>
        <div><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="pipe horizontal main"><b></b><b></b><b></b></div>
      <div class="pipe vertical center"><b></b><b></b></div>
      <div class="pipe horizontal top"><b></b><b></b></div>
      <div class="pipe horizontal bottom"><b></b><b></b></div>
      <div class="pipe vertical branch-left"><b></b></div>
      <div class="pipe vertical branch-right"><b></b></div>
      <span class="pipe-node"></span>
      <span class="flow-label main">${flowTotal} Litre/Min</span>
      <button class="map-ward ae" type="button">A&E Ward<small>${Math.round(totalFlow(wards.find(w => w.id === "ae")))} Litre/Min</small></button>
      <button class="map-ward paed" type="button">Paediatrics Ward<small>${Math.round(totalFlow(wards.find(w => w.id === "paediatric")))} Litre/Min</small></button>
      <button class="map-ward recovery" type="button">Recovery Bay<small>${Math.round(totalFlow(wards.find(w => w.id === "recovery")))} Litre/Min</small></button>
      <button class="map-ward labour" type="button">Labour Ward<small>${Math.round(totalFlow(wards.find(w => w.id === "labour")))} Litre/Min</small></button>
    </div>
  `;
}

function updatePipelineFilterButtons() {
  document.querySelectorAll("[data-pipeline-filter]").forEach(button => {
    const active = button.dataset.pipelineFilter === pipelineFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function getVisibleTanks(ward) {
  if (!pipelineFilter) return ward.tanks.filter(t => t.active);
  return ward.tanks.filter(t => tankPipelineStatus(t) === pipelineFilter);
}

function tankPipelineStatus(t) {
  if (!t.active || t.flowRate <= 0) return "inactive";
  if (t.leakageAlert || t.highFlowAlert) return "leak";
  if (isSuspiciousTank(t)) return "suspicious";
  return "normal";
}

function isSuspiciousTank(t) {
  const percent = Math.round((t.volumeRemaining * 100) / t.maxVolume);
  return t.pressure < 45 || percent < 30 || t.flowRate >= 8;
}

function renderWardCard(ward, visibleTanks = ward.tanks.filter(t => t.active)) {
  const alert = visibleTanks.some(t => t.active && (t.leakageAlert || t.highFlowAlert));
  const flow = visibleTanks.reduce((sum, t) => sum + t.flowRate, 0);
  const pressure = Math.round(visibleTanks.reduce((sum, t) => sum + t.pressure, 0) / Math.max(1, visibleTanks.length));

  return `
    <article class="ward-card ${alert ? "alert" : ""}" data-ward="${ward.id}" style="color:${ward.accent}">
      <header class="ward-head">
        <div class="ward-icon">O2</div>
        <div class="ward-title">
          <h3>${ward.name}</h3>
          <p>${ward.subtitle}</p>
        </div>
        <span class="live-badge">LIVE</span>
      </header>
      <div class="tank-list">
        ${visibleTanks.map(t => renderTankRow(t)).join("")}
      </div>
      <footer class="ward-summary">Average Pressure: ${pressure} PSI | Average Flow: ${flow} Litre/Min</footer>
    </article>
  `;
}

function renderTankRow(t) {
  const alert = t.leakageAlert || t.highFlowAlert;
  const pipelineStatus = tankPipelineStatus(t);
  const arrowColor = pipelineStatus === "inactive" ? colors.grey : pipelineStatus === "leak" ? colors.red : pipelineStatus === "suspicious" ? colors.yellow : colors.green;
  const status = t.alertMessage || (t.highFlowAlert ? "High Abnormal Flow Rate" : t.leakageAlert ? "Wastage Alert" : pipelineStatus === "inactive" ? "Inactive / Isolated" : pipelineStatus === "suspicious" ? "Suspicious" : t.occupied ? "Stable" : "Monitor");

  return `
    <div class="tank-row ${pipelineStatus} ${alert ? "alert" : ""} ${alert && flashRed ? "flash" : ""}">
      <div>
        <div class="tank-name">${t.name}</div>
        <div class="tank-meta">
          <span>Serial #: ${t.serial}</span>
          <span>Pressure: ${t.pressure} PSI</span>
          <span>Flow Rate: ${t.flowRate} Litre/Min</span>
          <span>Volume: ${t.volumeRemaining} / ${t.maxVolume} L</span>
        </div>
      </div>
      <div class="flow-arrow" style="--arrow-color:${arrowColor}">
        ${t.flowRate > 0 ? '<span class="pulse"></span>' : ""}
      </div>
      <div class="tank-detail">
        <span>${t.station}</span>
        <span>Pressure: ${t.pressure} PSI</span>
        <span>Flow Rate: ${t.stationFlowRate} Litre/Min</span>
        <span>${status}</span>
      </div>
    </div>
  `;
}

function updateMetrics() {
  const activePatientsEl = document.getElementById("activePatients");
  if (activePatientsEl) activePatientsEl.textContent = `${ACTIVE_PATIENT_TARGET}/${ACTIVE_PATIENT_TARGET}`;
  const wastageEl = document.getElementById("wastage");
  if (wastageEl) wastageEl.textContent = `${wastage}%`;
  const wastageStatusEl = document.getElementById("wastageStatus");
  if (wastageStatusEl) wastageStatusEl.textContent = "vs yesterday";

  const lowVolume = wards.flatMap(w => w.tanks)
    .map(t => ({ name: t.name, percent: Math.round((t.volumeRemaining * 100) / t.maxVolume) }))
    .filter(t => t.percent < 10);
  const lowVolumeEl = document.getElementById("lowVolume");
  if (lowVolumeEl) {
    lowVolumeEl.classList.toggle("low-volume-list", lowVolume.length > 0);
    lowVolumeEl.innerHTML = lowVolume.length ? renderLowVolumeList(lowVolume) : "None";
    lowVolumeEl.style.color = lowVolume.length ? colors.red : colors.green;
  }

  const flowWard = wards[flowIndex % wards.length];
  const rotatingWardEl = document.getElementById("rotatingWard");
  const rotatingFlowEl = document.getElementById("rotatingFlow");
  if (rotatingWardEl) {
    rotatingWardEl.textContent = flowWard.name;
    rotatingWardEl.style.color = flowWard.accent;
  }
  if (rotatingFlowEl) {
    rotatingFlowEl.textContent = `${totalFlow(flowWard)} Litre/Min`;
    rotatingFlowEl.style.color = flowWard.accent;
  }

  const alerts = activeAlerts();
  const systemAlert = document.getElementById("systemAlert");
  const alertText = document.getElementById("alertText");
  if (systemAlert && alertText) {
    if (alerts.length > 1) {
      systemAlert.innerHTML = "Monitoring";
      systemAlert.style.color = colors.green;
      alertText.innerHTML = "All systems normal";
    } else if (alerts.length === 1) {
      systemAlert.innerHTML = "Monitoring";
      systemAlert.style.color = colors.green;
      alertText.innerHTML = "All systems normal";
    } else {
      systemAlert.textContent = "Monitoring";
      systemAlert.style.color = colors.green;
      alertText.textContent = "All systems normal";
    }
  }
  updateNotifications(alerts);
}

async function openUserManagement() {
  await renderUsers();
  document.getElementById("userMessage").textContent = "";
  document.getElementById("userDialog").showModal();
}

async function createUser(event) {
  event.preventDefault();
  const message = document.getElementById("userMessage");
  const username = document.getElementById("newUsername").value.trim();
  const email = document.getElementById("newEmail").value.trim();
  const password = document.getElementById("newPassword").value;
  const roleId = Number(document.getElementById("newUserRole").value);

  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ username, email, password, role_id: roleId })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Unable to create user.");
    }

    event.target.reset();
    renderUserData(result.users);
    message.textContent = "User created successfully.";
  } catch (error) {
    message.textContent = error.message;
  }
}

async function updateUserPermission(event) {
  event.preventDefault();
  const message = document.getElementById("userMessage");
  const username = document.getElementById("existingUser").value;
  const roleId = Number(document.getElementById("existingUserRole").value);

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ role_id: roleId })
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Unable to update permission.");
    }

    renderUserData(result.users);
    syncCurrentUser(result.users);
    message.textContent = "User permission updated.";
  } catch (error) {
    message.textContent = error.message;
  }
}

async function renderUsers() {
  try {
    const response = await fetch("/api/users", { cache: "no-store", headers: authHeaders(false) });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Unable to load users.");
    }

    renderUserData(result.users);
  } catch (error) {
    document.getElementById("userMessage").textContent = error.message;
  }
}

async function updateUserCount() {
  const table = document.getElementById("adminUsersTable");
  if (!table || currentUser?.role !== "admin") return;

  try {
    const response = await fetch("/api/users", { cache: "no-store", headers: authHeaders(false) });
    const result = await response.json();
    if (result.ok) renderUserData(result.users);
  } catch {
    // The static admin table remains visible if the live user list cannot load.
  }
}

function renderUserData(users) {
  const existingUser = document.getElementById("existingUser");
  const existingUserRole = document.getElementById("existingUserRole");
  const userList = document.getElementById("userList");
  const adminUsersTable = document.getElementById("adminUsersTable");

  if (existingUser && existingUserRole) {
    existingUser.innerHTML = users
      .map(user => `<option value="${escapeHtml(user.username)}">${escapeHtml(user.username)}</option>`)
      .join("");

    if (users.length) {
      existingUserRole.value = String(users[0].role_id);
    }

    existingUser.onchange = () => {
      const selectedUser = users.find(user => user.username === existingUser.value);
      if (selectedUser) existingUserRole.value = String(selectedUser.role_id);
    };
  }

  if (userList) {
    userList.innerHTML = users.map(user => `
      <article>
        <strong>${escapeHtml(user.username)}</strong>
        <span>${escapeHtml(user.label)}</span>
      </article>
    `).join("");
  }

  if (adminUsersTable) {
    adminUsersTable.innerHTML = `
      <table class="admin-table">
        <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td><strong>${escapeHtml(user.username)}</strong><br><small>${escapeHtml(user.email || "")}</small></td>
              <td>${adminRoleBadge(user.label)}</td>
              <td>${adminStatusBadge("Active")}</td>
              <td><button class="admin-row-action" type="button" aria-label="Manage ${escapeHtml(user.username)}">...</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
}

function authHeaders(includeContentType = true) {
  const headers = includeContentType ? { "content-type": "application/json" } : {};
  if (currentUser?.accessToken) {
    headers.authorization = `Bearer ${currentUser.accessToken}`;
  }
  return headers;
}

function syncCurrentUser(users) {
  const updatedUser = users.find(user => user.username === currentUser?.username);
  if (!updatedUser) return;

  currentUser = {
    ...currentUser,
    role: updatedUser.role,
    role_id: updatedUser.role_id,
    label: updatedUser.label
  };
  sessionStorage.setItem("oxyguardUser", JSON.stringify(currentUser));
  applyRoleAccess();
  updateCurrentUserDisplay();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLowVolumeList(lowVolume) {
  const visible = lowVolume.slice(0, 3);
  const extra = lowVolume.length - visible.length;
  return `
    ${visible.map(t => `
      <span class="low-row">
        <b>${t.name}</b>
        <i><em style="width:${Math.max(3, t.percent)}%"></em></i>
        <strong>${t.percent}%</strong>
      </span>
    `).join("")}
    ${extra > 0 ? `<span class="low-more">+${extra} more low tanks</span>` : ""}
  `;
}

function liveTick() {
  wards.forEach(ward => {
    ward.tanks.forEach(t => {
      if (!t.active || t.readOnly) return;
      t.pressure = clamp(t.pressure + rand(-1, 1), 38, 60);
      if (t.flowRate <= 0) return;
      const floorVolume = getTankVolumeFloor(t);
      t.volumeRemaining = Math.max(floorVolume, t.volumeRemaining - t.flowRate);
      if (floorVolume && t.volumeRemaining === floorVolume) {
        t.flowRate = 0;
        t.stationFlowRate = 0;
        return;
      }
      if (t.volumeRemaining === 0) {
        t.flowRate = 0;
        t.pressure = Math.max(0, t.pressure - 2);
        return;
      }
      if (t.leakageAlert || t.fixedFlow) return;
      t.flowRate = clamp(t.flowRate + rand(-1, 1), 1, 8);
      t.stationFlowRate = t.flowRate;
    });
  });
  renderAll();
}

async function loadNurseStationData() {
  try {
    const response = await fetch("/api/nurse-station", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to read nurse station data");
    const data = await response.json();
    const nurseTank = getTank("Nurse Station");
    if (!nurseTank) return;

    nurseTank.active = Boolean(data.active);
    nurseTank.occupied = Boolean(data.occupied);
    nurseTank.pressure = safeNumber(data.pressure, nurseTank.pressure);
    nurseTank.flowRate = safeNumber(data.flowRate, nurseTank.flowRate);
    nurseTank.stationFlowRate = safeNumber(data.stationFlowRate, nurseTank.flowRate);
    nurseTank.volumeRemaining = clamp(safeNumber(data.volumeRemaining, nurseTank.volumeRemaining), 0, nurseTank.maxVolume);
    nurseTank.leakageAlert = false;
    nurseTank.highFlowAlert = false;
    nurseTank.alertMessage = "";
    renderAll();
  } catch (error) {
    const nurseTank = getTank("Nurse Station");
    if (nurseTank) {
      nurseTank.active = false;
      nurseTank.flowRate = 0;
      nurseTank.stationFlowRate = 0;
      renderAll();
    }
  }
}

function scheduleDemo() {
  timeout(10000, () => {
    const c3 = getTank("Tank C3");
    c3.active = true;
    c3.occupied = false;
    c3.flowRate = 6;
    c3.stationFlowRate = 6;
    c3.leakageAlert = true;
    c3.alertMessage = "Wastage Alert";
    wastage = Math.max(wastage, 14);
    renderAll();
  });

  timeout(12000, () => {
    const a2 = getTank("Tank A2");
    a2.active = true;
    a2.flowRate = 3;
    a2.stationFlowRate = 3;
    a2.leakageAlert = true;
    a2.highFlowAlert = false;
    a2.alertMessage = "A&E Ward Alert - Flow Normal";
    wastage = Math.max(wastage, 18);
    renderAll();
  });

  timeout(20000, () => {
    const a3 = getTank("Tank A3");
    a3.active = true;
    a3.occupied = false;
    renderAll();
  });

  timeout(54000, () => {
    const b3 = getTank("Tank B3");
    b3.active = true;
    b3.occupied = false;
    b3.leakageAlert = true;
    b3.alertMessage = "Wastage Alert";
    wastage = Math.max(wastage, 12);
    renderAll();
  });

  timeout(60000, () => {
    getTank("Tank B2").active = true;
    renderAll();
  });

  timers.push(setInterval(() => {
    if (activeAlerts().length && wastage < 25) {
      wastage += 1;
      renderAll();
    }
  }, 20000));
}

function timeout(ms, fn) {
  const id = setTimeout(fn, ms);
  timers.push(id);
}

function openWard(id) {
  const ward = wards.find(w => w.id === id);
  document.getElementById("dialogTitle").textContent = `${ward.name} Oxygen Monitoring`;
  document.getElementById("dialogBody").innerHTML = `
    <div class="detail-row header">
      <span>Tank</span><span>Station</span><span>Pressure</span><span>Flow</span><span>Status</span>
    </div>
    ${ward.tanks.filter(t => t.active).map(t => {
      const status = t.alertMessage || (t.highFlowAlert ? "High Abnormal Flow Rate" : t.leakageAlert ? "Wastage Alert" : t.flowRate <= 0 ? "No oxygen" : t.occupied ? "Stable" : "Monitor");
      return `<div class="detail-row"><span>${t.name}<br><small>${t.serial}</small></span><span>${t.station}</span><span>${t.pressure} PSI</span><span>${t.flowRate} Litre/Min</span><span>${status}</span></div>`;
    }).join("")}
  `;
  document.getElementById("wardDialog").showModal();
}

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  document.getElementById("dateTime").innerHTML = `${time}<small>${date}</small>`;
  updateCurrentUserDisplay();

  const orderTimer = document.getElementById("orderTimeRemaining");
  if (orderTimer) {
    const remainingSeconds = Math.max(0, 527 - Math.floor((now.getSeconds() + now.getMinutes() * 60) % 527));
    const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
    const seconds = String(remainingSeconds % 60).padStart(2, "0");
    orderTimer.textContent = `${minutes}:${seconds}`;
  }
}

function updateCurrentUserDisplay() {
  const currentUserElement = document.getElementById("currentUser");
  if (!currentUserElement) return;
  const access = getActivePermissionView();
  currentUserElement.innerHTML = currentUser
    ? `<span>Logged in as</span><strong>${currentUser.username} - ${currentUser.role === "admin" ? access.label : currentUser.label}</strong>`
    : "";
}

function updatePageTitle() {
  const titles = {
    report: "OXYGUARD MONITORING DASHBOARD",
    dashboard: "OXYGEN REPORT CENTER",
    alert: "ALERT MONITORING",
    order: "ORDER SUMMARY",
    analytics: "CALL ANALYTICS",
    administration: "ADMINISTRATION"
  };
  document.querySelector(".topbar h1").textContent = titles[activeView] || titles.report;
}

function updateNotifications(alerts = activeAlerts()) {
  const button = document.getElementById("alertNotificationButton");
  const count = document.getElementById("alertNotificationCount");
  const list = document.getElementById("alertNotificationList");
  const panel = document.getElementById("alertNotificationPanel");
  if (!button || !count || !list || !panel) return;
  const alertSignature = getAlertSignature(alerts);
  const hasNewAlerts = alerts.length > 0 && alertSignature !== acknowledgedAlertSignature;

  count.textContent = String(alerts.length);
  button.classList.toggle("has-alert", hasNewAlerts);
  button.setAttribute("aria-label", alerts.length ? `${alerts.length} active alert notifications` : "No active alert notifications");

  list.innerHTML = alerts.length
    ? `<ul>${alerts.map(alert => `<li>${alert}</li>`).join("")}</ul>`
    : "No active alerts.";

  if (!alerts.length) {
    acknowledgedAlertSignature = "";
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
}

function getAlertSignature(alerts) {
  return alerts.slice().sort().join("|");
}

function renderReport() {
  const generated = document.getElementById("reportGenerated");

  const now = new Date();
  if (generated) {
    generated.textContent = `Generated: ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  }

  const allTanks = wards.flatMap(ward => ward.tanks.map(t => ({ ...t, wardName: ward.name, wardId: ward.id })));
  const activeTanks = allTanks.filter(t => t.active);
  const alertRows = activeTanks.filter(t => t.leakageAlert || t.highFlowAlert);
  const avgPressure = Math.round(activeTanks.reduce((sum, t) => sum + t.pressure, 0) / Math.max(1, activeTanks.length));
  const totalFlowValue = wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
  const avgFlowValue = Math.round(totalFlowValue / Math.max(1, wards.length));
  const lowestVolume = Math.min(...activeTanks.map(t => Math.round((t.volumeRemaining * 100) / t.maxVolume)));
  const criticalTanks = activeTanks.filter(t => Math.round((t.volumeRemaining * 100) / t.maxVolume) < 10);
  const inventoryTotal = 40;
  const depletedTanks = allTanks.filter(t => t.volumeRemaining <= 0).length;
  const todayConsumptionLitres = Math.round(totalFlowValue * 60 * 24);
  const yesterdayConsumptionLitres = YESTERDAY_CONSUMPTION_LITRES;
  const wastageTodayLitres = Math.round(todayConsumptionLitres * (wastage / 100));
  const wastageCost = Math.round(wastageTodayLitres * OXYGEN_COST_PER_LITRE);
  const wastageTankEquivalent = wastageCost / TANK_COST;
  const wastageTankLabel = formatTankEquivalent(wastageTankEquivalent);
  const wastageCostLabel = `${currency(wastageCost)}&nbsp;Est.&nbsp;Cost&nbsp;|&nbsp;${wastageTankLabel}`;
  const yesterdayDelta = formatSignedPercent((todayConsumptionLitres - yesterdayConsumptionLitres) / yesterdayConsumptionLitres);
  const esp32Status = getEsp32DeviceStatus();
  const criticalOverview = getCriticalAlertOverview(alertRows);

  document.getElementById("reportSummary").innerHTML = [
    reportSummaryCard("Average Flow", `${avgFlowValue}&nbsp;Litre/Min`, "Across active wards", colors.green, "spark"),
    reportSummaryCard("Today's Consumption", `${todayConsumptionLitres.toLocaleString()} Litre`, `vs Yesterday (${yesterdayConsumptionLitres.toLocaleString()} Litre)`, colors.blue, "up", { delta: yesterdayDelta, deltaTone: "bad" }),
    reportSummaryCard("Estimated Wastage (Today)", `${wastageTodayLitres.toLocaleString()}&nbsp;Litre`, wastageCostLabel, colors.yellow, "warn"),
    reportSummaryCard("Active Patients", ACTIVE_PATIENT_TARGET, "On Oxygen Support", colors.purple, "people"),
    reportSummaryCard("Critical Alerts", criticalOverview.total, "Matches overview active alerts", colors.red, "alert"),
    reportSummaryCard("Offline Devices", esp32Status.offline, `${esp32Status.online} / ${esp32Status.total} ESP32 Online`, colors.navy, "wifi")
  ].join("");

  renderCharts(activeTanks);
  renderHospitalHeatMap();
  renderSystemHealth(esp32Status);
  renderCriticalOverview(criticalOverview);
  renderPatientAlerts(activeTanks);
  renderPredictiveInsights(activeTanks, alertRows);
  renderRecentActivity(alertRows);
  renderV5TrendAnalytics();
  renderWardUsageChart();

  renderAlertsByWard();

  updateDepletionFilterButtons();
  const depletionRows = getTankDepletionMonitoringRows(activeTanks, depletionStatusFilter);

  const depletionTarget = document.getElementById("depletionTable");
  const depletionTableRows = depletionRows.length
    ? depletionRows.slice(0, 5).map(item => item.row)
    : dashboardDemoDepletionRows[depletionStatusFilter] || dashboardDemoDepletionRows.all;
  if (depletionTarget) depletionTarget.innerHTML = tableHtml(
    ["Ward", "Tank", "Serial #", "Volume", "Est. Depletion", "Status"],
    depletionTableRows
  );
}

function getTankDepletionMonitoringRows(activeTanks, statusFilter = "all") {
  return activeTanks
    .map(t => {
      const percent = Math.round((t.volumeRemaining * 100) / t.maxVolume);
      const status = tankDepletionStatus(t);
      return {
        tank: t,
        status,
        minutes: minutesUntilDepletion(t),
        row: [
          t.wardName,
          t.name,
          t.serial,
          `${t.volumeRemaining} L (${percent}%)`,
          estimateDepletion(t),
          badge(status.label, status.tone)
        ]
      };
    })
    .filter(item => statusFilter === "all" || item.status.key === statusFilter)
    .sort((a, b) => a.minutes - b.minutes);
}

function renderSystemHealth(status = getEsp32DeviceStatus()) {
  const target = document.getElementById("systemHealthPanel");
  if (!target) return;
  const espStatus = status.offline ? `${status.online} / ${status.total} Online` : `${status.total} / ${status.total} Online`;
  const items = [
    ["ESP32", espStatus, "device", status.offline ? "warn" : "good"],
    ["MQTT", "Connected", "network"],
    ["API Server", "Running", "server"],
    ["Database", "Healthy", "database"],
    ["Last Packet", "2 sec ago", "packet"]
  ];
  target.innerHTML = items.map(([label, value, icon, tone = "good"]) => `
    <div class="health-row ${tone}">
      <span class="health-icon ${icon}" aria-hidden="true"></span>
      <div>
        <strong>${label}</strong>
        <small>${value}</small>
      </div>
      <i></i>
    </div>
  `).join("");
}

function formatTankEquivalent(tankEquivalent) {
  if (tankEquivalent <= 0) return "0 tank";
  const rounded = Math.max(0.1, Math.round(tankEquivalent * 10) / 10);
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${display} ${rounded <= 1 ? "tank" : "tanks"}`;
}

function formatSignedPercent(ratio) {
  const value = ratio * 100;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatActivityTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesFromNow(minutes) {
  return new Date(Date.now() - minutes * 60000);
}

function getEsp32DeviceStatus() {
  const now = Date.now();
  if (!esp32LastFluctuation || now - esp32LastFluctuation > 9000) {
    const possibleOfflineCounts = [0, 1, 1, 2, 2, 3, 4].filter(value => value !== esp32OfflineDevices);
    esp32OfflineDevices = possibleOfflineCounts[Math.floor(Math.random() * possibleOfflineCounts.length)];
    esp32LastFluctuation = now;
  }
  const offline = Math.round(esp32OfflineDevices);
  return {
    total: ESP32_DEVICE_TOTAL,
    offline,
    online: ESP32_DEVICE_TOTAL - offline
  };
}

function getCriticalAlertOverview(alertRows) {
  const liveLeaks = alertRows.filter(t => t.leakageAlert).length;
  const liveGhostFlow = alertRows.filter(t => t.highFlowAlert).length;
  const cards = [
    ["Leaks", liveLeaks || 2, "LK"],
    ["Ghost Flow", liveGhostFlow || 1, "GF"],
    ["Unauthorized", 1, "ID"],
    ["Residual Gas", 0, "O2"]
  ];
  return {
    cards,
    total: cards.reduce((sum, [, value]) => sum + value, 0)
  };
}

function renderCriticalOverview(overview) {
  const target = document.getElementById("criticalOverviewCards");
  if (!target) return;
  target.innerHTML = overview.cards.map(([label, value, icon]) => `
    <article class="critical-mini-card">
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${value ? "Active" : "Clear"}</small>
      </div>
      <b>${icon}</b>
    </article>
  `).join("");
}

function renderPatientAlerts(activeTanks) {
  const target = document.getElementById("patientAlertsTable");
  if (!target) return;
  const hasLiveAlerts = activeTanks.some(t => t.leakageAlert || t.highFlowAlert || getReportVolumePercent(t) < 10);
  const liveRows = Array.from({ length: ACTIVE_PATIENT_TARGET }, (_, index) => {
    const tankItem = activeTanks[index % Math.max(1, activeTanks.length)];
    const setValue = Math.max(1, tankItem.flowRate - 1);
    const liveReading = tankItem.highFlowAlert
      ? setValue * 1.35
      : tankItem.leakageAlert
        ? setValue * 0.8
        : index % 4 === 0
          ? setValue
          : setValue * 1.12;
    const status = evaluatePatientFlowStatus(setValue, liveReading);
    return [
      `PT-${String(index + 1).padStart(4, "0")}`,
      `${tankItem.wardName} / ${tankItem.station}`,
      formatFlow(setValue),
      formatFlow(liveReading),
      formatVariance(status.variance),
      status.badge,
      status.message
    ];
  });
  const rows = hasLiveAlerts ? liveRows : dashboardDemoPatientRows;
  target.innerHTML = tableHtml(["Patient ID", "Ward / Bed", "SetValue", "Live Reading", "Variance", "Status", "Alert"], rows);
}

function renderLiveTankStatus(activeTanks) {
  const target = document.getElementById("liveTankStatusTable");
  if (!target) return;
  const rows = [...activeTanks]
    .sort((a, b) => getReportVolumePercent(a) - getReportVolumePercent(b))
    .slice(0, 6)
    .map(t => {
      const percent = getReportVolumePercent(t);
      const status = tankDepletionStatus(t);
      return [
        t.name,
        t.wardName,
        `${getReportVolumeRemaining(t)} L (${percent}%)`,
        estimateDepletion(t),
        badge(status.label, status.tone)
      ];
    });
  target.innerHTML = tableHtml(["Tank ID", "Location", "Volume", "Est. Depletion", "Status"], rows);
}

function renderAlertsByWard() {
  const target = document.getElementById("leakageTable");
  if (!target) return;
  const rows = wards.map(ward => {
    const demo = dashboardDemoAlertsByWard[ward.id] || { activeAlerts: 0, critical: 0, warning: 0 };
    const liveActiveAlerts = ward.tanks.filter(t => t.active && (t.leakageAlert || t.highFlowAlert)).length;
    const liveCritical = ward.tanks.filter(t => t.active && getReportVolumePercent(t) < 10).length;
    const liveWarning = ward.tanks.filter(t => t.active && getReportVolumePercent(t) >= 10 && getReportVolumePercent(t) < 30).length;
    const activeAlerts = Math.max(liveActiveAlerts, demo.activeAlerts);
    const critical = Math.max(liveCritical, demo.critical);
    const warning = Math.max(liveWarning, demo.warning);
    const total = activeAlerts + critical + warning;
    return {
      ward: ward.name.replace(" Ward", ""),
      total,
      activeAlerts,
      critical,
      warning,
      accent: ward.accent
    };
  });
  const maxTotal = Math.max(1, ...rows.map(row => row.total));
  target.innerHTML = `
    <div class="ward-alert-chart" aria-label="Alerts by ward graph">
      <div class="ward-alert-legend">
        <span><i class="critical"></i>Critical</span>
        <span><i class="warning"></i>Warning</span>
        <span><i class="active"></i>Active Alert</span>
      </div>
      ${rows.map(row => {
        const criticalWidth = row.total ? Math.max(4, (row.critical / maxTotal) * 100) : 0;
        const warningWidth = row.total ? Math.max(4, (row.warning / maxTotal) * 100) : 0;
        const activeWidth = row.total ? Math.max(4, (row.activeAlerts / maxTotal) * 100) : 0;
        return `
          <div class="ward-alert-row">
            <div class="ward-alert-label">
              <strong>${row.ward}</strong>
              <span>${row.total} total</span>
            </div>
            <div class="ward-alert-track">
              ${row.critical ? `<i class="critical" style="width:${criticalWidth}%"></i>` : ""}
              ${row.warning ? `<i class="warning" style="width:${warningWidth}%"></i>` : ""}
              ${row.activeAlerts ? `<i class="active" style="width:${activeWidth}%"></i>` : ""}
            </div>
            <b>${row.total}</b>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderV5TrendAnalytics() {
  const target = document.getElementById("v5TrendAnalytics");
  if (!target) return;

  const hours = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"];
  const totalFlowValue = wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
  const averageFlowValue = Math.max(10, Math.round(totalFlowValue / Math.max(1, wards.length)));
  const currentWasteLitres = Math.round(totalFlowValue * 60 * (wastage / 100));
  const phase = Math.floor(Date.now() / 3000);
  const flowPattern = [0.72, 0.82, 0.94, 1.03, 1.15, 1.08, 1.22, 1.14, 1.02, 0.91, 0.84, 0.76];
  const wastePattern = [0.52, 0.61, 0.7, 0.78, 0.92, 1.02, 1.15, 1.07, 0.95, 0.83, 0.72, 0.64];
  const flowPoints = flowPattern.map((multiplier, index) => {
    const wave = Math.sin((phase + index) / 2.2) * 5;
    return Math.round(clamp((averageFlowValue * 8 * multiplier) + wave, 12, 120));
  });
  const wastePoints = wastePattern.map((multiplier, index) => {
    const wave = Math.cos((phase + index) / 2) * 18;
    return Math.round(clamp((currentWasteLitres / 18) * multiplier + wave, 18, 450));
  });
  const width = 520;
  const height = 188;
  const left = 50;
  const right = 58;
  const top = 28;
  const bottom = 40;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xFor = index => left + (index / (flowPoints.length - 1)) * plotWidth;
  const yFlow = value => top + ((120 - value) / 120) * plotHeight;
  const yWaste = value => top + ((450 - value) / 450) * plotHeight;
  const flowPath = flowPoints.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFlow(value).toFixed(1)}`).join(" ");
  const wastePath = wastePoints.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yWaste(value).toFixed(1)}`).join(" ");

  target.innerHTML = `
    <div class="trend-legend">
      <span class="flow">Average Flow (Litre/Min)</span>
      <span class="waste">Wastage (Litre)</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" aria-label="Daily average flow and wastage trend">
      <text class="trend-axis-title left" x="${left}" y="16">Flow (Litre/Min)</text>
      <text class="trend-axis-title right" x="${width - right}" y="16">Wastage (Litre)</text>
      ${[0, 40, 80, 120].map(value => {
        const y = yFlow(value);
        return `
          <line class="trend-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
          <text class="trend-tick" x="${left - 14}" y="${y + 4}">${value}</text>
        `;
      }).join("")}
      ${[0, 150, 300, 450].map(value => {
        const y = yWaste(value);
        return `<text class="trend-tick right" x="${width - right + 14}" y="${y + 4}">${value}</text>`;
      }).join("")}
      <line class="trend-axis" x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}"></line>
      <line class="trend-axis" x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}"></line>
      <path class="trend-flow-line" d="${flowPath}"></path>
      <path class="trend-waste-line" d="${wastePath}"></path>
      ${hours.map((hour, index) => {
        const x = left + (index / (hours.length - 1)) * plotWidth;
        return `<text class="trend-time" x="${x}" y="${height - 8}">${hour}</text>`;
      }).join("")}
      <text class="trend-axis-title bottom" x="${left + plotWidth / 2}" y="${height - 22}">Time of Day</text>
    </svg>
  `;
}

function renderPredictiveInsights(activeTanks, alertRows) {
  const target = document.getElementById("predictiveInsights");
  if (!target) return;
  const depletionOrder = getTankDepletionMonitoringRows(activeTanks, "all")
    .filter(item => Number.isFinite(item.minutes))
    .slice(0, 3);
  const totalFlowValue = wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
  const todayConsumptionLitres = Math.round(totalFlowValue * 60 * 24);
  const yesterdayDelta = formatSignedPercent((todayConsumptionLitres - YESTERDAY_CONSUMPTION_LITRES) / YESTERDAY_CONSUMPTION_LITRES);
  const wastageTodayLitres = Math.round(todayConsumptionLitres * (wastage / 100));
  const firstTank = depletionOrder[0]?.tank || activeTanks[0] || { name: "Tank B3", wardName: "Labour Ward", volumeRemaining: 120, flowRate: 1 };
  const insights = [
    ["danger", "Depleting first", `${firstTank.name} - ${estimateDepletion(firstTank)}`, firstTank.wardName || "Highest refill priority"],
    ["danger", "Next queue", formatDepletionQueue(depletionOrder.slice(1)), "Refill route"],
    ["blue", "Today's oxygen demand", `${todayConsumptionLitres.toLocaleString()} Litre`, `${yesterdayDelta} vs Yesterday`],
    ["warn", "Estimated wastage today", `${wastageTodayLitres.toLocaleString()} Litre`, "Cost exposure"],
    ["good", "Potential savings", currency((alertRows.length + 1) * 8200), "If issues resolved"]
  ];
  target.innerHTML = insights.map(([tone, label, value, note]) => `
    <div class="insight-row ${tone}">
      <span></span>
      <div><small>${label}</small><strong>${value}</strong><em>${note}</em></div>
    </div>
  `).join("");
}

function minutesUntilDepletion(t) {
  return t.flowRate <= 0 ? Number.POSITIVE_INFINITY : Math.max(1, Math.floor(t.volumeRemaining / Math.max(1, t.flowRate)));
}

function formatDepletionQueue(tanks) {
  if (!tanks.length) return "No active tank queue";
  return tanks.map(item => `${item.tank.name} (${estimateDepletion(item.tank)})`).join(", ");
}

function renderRecentActivity(alertRows) {
  const target = document.getElementById("recentActivityList");
  if (!target) return;
  const activeAlert = alertRows[0] || { name: "Tank C1", ward: "Paediatric Ward", alertType: "Critical tank level" };
  const loginTime = currentUser?.loginAt || sessionStorage.getItem("oxyguardLoginAt") || new Date().toISOString();
  const username = currentUser?.username || "robertm";
  const notificationEmail = currentUser?.email || "robertmarson88@gmail.com";
  const entries = [
    [formatActivityTime(loginTime), "blue", `${username} logged in successfully`],
    [formatActivityTime(minutesFromNow(4)), "danger", `${activeAlert.name} ${activeAlert.alertType || "alert"} detected in ${activeAlert.ward || "Ward C"}`],
    [formatActivityTime(minutesFromNow(3)), "good", `Email notification sent to ${notificationEmail}`],
    [formatActivityTime(minutesFromNow(2)), "blue", `Alert reviewed by ${username}`],
    [formatActivityTime(minutesFromNow(1)), "good", "Maintenance ticket opened for oxygen team"]
  ];
  target.innerHTML = entries.map(([time, tone, text]) => `
    <div class="activity-row ${tone}">
      <time>${time}</time>
      <i></i>
      <span>${text}</span>
    </div>
  `).join("") + '<a href="#alertView">View All</a>';
}

function renderGeneratedReport() {
  const target = document.getElementById("generatedReport");
  if (!target) return;

  document.querySelectorAll("[data-report-type]").forEach(button => {
    button.classList.toggle("active", button.dataset.reportType === selectedReportType);
  });
  const reportTypeSelect = document.getElementById("reportTypeSelect");
  if (reportTypeSelect) reportTypeSelect.value = selectedReportType;
  updateOperationsReportPanels();
  renderOperationsWasteComparison();

  const report = buildGeneratedReport(selectedReportType);
  renderReportCenterSummary(report);
  renderReportCenterExceptionTable();
  renderReportCenterDepletionTable();
  renderReportResolutionPerformance();
  renderReportCenterSystemHealth();
  renderReportCenterAuditTrail();
  renderReportCenterRecommendations();
}

function renderReportCenterSummary(report) {
  const target = document.getElementById("reportExecutiveSummary");
  const generated = document.getElementById("reportGeneratedSummary");
  if (!target || !generated) return;

  const demoSummary = getReportDemoSummary();
  const allTanks = wards.flatMap(ward => ward.tanks.map(t => ({ ...t, wardName: ward.name })));
  const activeTanks = allTanks.filter(t => t.active);
  const criticalTanks = activeTanks.filter(t => getReportVolumePercent(t) < 10 || t.highFlowAlert);
  const totalConsumption = demoSummary.totalUsage * TANK_VOLUME_LITRES;
  const wastageLitres = Math.round(totalConsumption * (demoSummary.avgWastage / 100));
  const ghostFlowIncidents = Math.max(2, Math.round(demoSummary.totalAlerts * 0.22));
  const leakageEvents = Math.max(2, Math.round(demoSummary.totalAlerts * 0.18));
  const systemHealth = getEsp32DeviceStatus();
  const rangeLabel = getReportRangeLabel().replace("Report period: ", "");
  const periodTarget = document.getElementById("reportGeneratedPeriod");
  if (periodTarget) periodTarget.textContent = `Report period: ${rangeLabel}`;
  const kpis = [
    ["Total Oxygen Consumed", `${totalConsumption.toLocaleString()} L`, rangeLabel, "good", "drop"],
    ["Estimated Wastage", `${demoSummary.avgWastage}%`, `${wastageLitres.toLocaleString()} Litre`, "good", "leak"],
    ["Critical Alerts", demoSummary.totalAlerts, "Jan-to-date alerts", "bad", "alert"],
    ["Ghost Flow Incidents", ghostFlowIncidents, "Telemetry exceptions", "warn", "ghost"],
    ["Leakage Events", leakageEvents, "Leakage investigation", "bad", "tool"],
    ["Critical Tanks", criticalTanks.length, "Below 10% threshold", "purple", "tank"],
    ["System Availability", `${Math.round((systemHealth.online / systemHealth.total) * 100)}%`, `${systemHealth.online}/${systemHealth.total} ESP32 online`, "good", "pulse"]
  ];

  target.innerHTML = kpis.map(([label, value, note, tone, icon]) => `
    <article class="report-exec-card ${tone}">
      <span class="report-exec-icon">${icon.toString().slice(0, 2).toUpperCase()}</span>
      <div>
        <small>${label}</small>
        <strong>${value}</strong>
        <em>${note}</em>
      </div>
    </article>
  `).join("");

  generated.innerHTML = `
    <div class="generated-report-head compact">
      <div>
        <h3>${report.title}</h3>
        <p>${report.description}</p>
      </div>
    </div>
  `;
}

function renderReportCenterExceptionTable() {
  const target = document.getElementById("reportExceptionTable");
  if (!target) return;
  const rows = [
    ["12 Jun 09:32", "Ward A", "Tank A2", "Ghost Flow", badge("Closed", "good"), "Valve inspected"],
    ["15 Jun 11:15", "Paediatrics", "Tank C3", "Leakage", badge("Closed", "good"), "Cylinder replaced"],
    ["16 Jun 14:08", "Recovery Bay", "Tank R1", "Residual Gas", badge("Open", "warn"), "Facilities assigned"],
    ["18 Jun 08:45", "Labour", "Tank B1", "Unauthorized Use", badge("Closed", "good"), "Patient verified"],
    ["21 Jun 19:22", "Paediatrics", "Tank C2", "Ghost Flow", badge("Closed", "good"), "Line checked"]
  ];
  target.innerHTML = tableHtml(["Date / Time", "Ward", "Tank", "Event Type", "Status", "Action Taken"], rows);
}

function renderReportCenterDepletionTable() {
  const target = document.getElementById("reportDepletionTable");
  if (!target) return;
  const activeTanks = wards.flatMap(ward => ward.tanks
    .filter(t => t.active)
    .map(t => ({ ...t, wardName: ward.name })));
  const rows = [...activeTanks]
    .sort((a, b) => getReportVolumePercent(a) - getReportVolumePercent(b))
    .slice(0, 5)
    .map(t => {
      const percent = getReportVolumePercent(t);
      const status = tankDepletionStatus(t);
      return [
        t.name,
        t.wardName,
        `${getReportVolumeRemaining(t)} L (${percent}%)`,
        estimateDepletion(t),
        badge(status.label, status.tone),
        status.key === "critical" ? '<button class="inline-action">Refill Now</button>' : "-"
      ];
    });
  target.innerHTML = tableHtml(["Tank", "Ward", "Current Volume", "Est. Depletion", "Status", "Action"], rows);
}

function renderReportResolutionPerformance() {
  const target = document.getElementById("reportResolutionPerformance");
  if (!target) return;
  const metrics = [
    ["Total Alerts", "32"],
    ["Resolved", "30"],
    ["Open", "2"],
    ["Escalated", "3"],
    ["Ack Rate", "98%"],
    ["Resolution", "95%"]
  ];
  target.innerHTML = `
    <div class="resolution-metrics">
      ${metrics.map(([label, value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join("")}
    </div>
    <div class="resolution-times">
      <span><strong>4 min</strong> Avg response</span>
      <span><strong>11 min</strong> Avg resolution</span>
      <span><strong>38 min</strong> Longest open</span>
    </div>
    <div class="report-trend-lines" aria-label="Alert trend chart">
      <svg viewBox="0 0 360 110">
        <polyline points="8,78 38,52 68,58 98,42 128,57 158,68 188,44 218,57 248,62 278,51 308,58 352,64" fill="none" stroke="#2f80ed" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="8,88 38,67 68,70 98,60 128,73 158,80 188,68 218,76 248,82 278,70 308,78 352,82" fill="none" stroke="#19b36b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div><span class="blue-dot"></span>Generated <span class="green-dot"></span>Resolved</div>
    </div>
  `;
}

function renderReportCenterSystemHealth() {
  const target = document.getElementById("reportSystemHealth");
  if (!target) return;
  target.innerHTML = tableHtml(["Metric", "Value", "Status"], [
    ["ESP32 Devices Online", `${getEsp32DeviceStatus().online} / ${ESP32_DEVICE_TOTAL}`, badge("Excellent", "good")],
    ["MQTT Broker Uptime", "100%", badge("Excellent", "good")],
    ["API Server Uptime", "99.9%", badge("Excellent", "good")],
    ["Database Status", "Healthy", badge("Good", "good")],
    ["Offline Devices", getEsp32DeviceStatus().offline, badge("Warning", "warn")],
    ["Communication Failures", "2", badge("Warning", "warn")],
    ["Packet Loss Avg", "0.3%", badge("Good", "good")]
  ]);
}

function renderReportCenterAuditTrail() {
  const target = document.getElementById("reportAuditTrail");
  if (!target) return;
  target.innerHTML = tableHtml(["Date / Time", "User Role", "User ID", "Action", "Details"], [
    ["19 Jun 09:32", "Nurse", "NUR-07", "Alert Acknowledged", "Ghost Flow at Ward A / Tank A2"],
    ["19 Jun 09:40", "Facilities", "FAC-03", "Investigation Started", "Inspecting Tank B3"],
    ["19 Jun 09:44", "Facilities", "FAC-03", "Action Taken", "Valve tightened, flow stopped"],
    ["19 Jun 09:48", "Nurse", "NUR-07", "Alert Resolved", "Issue resolved"],
    ["19 Jun 09:50", "Admin", "ADM-01", "Incident Closed", "Closed by Admin"]
  ]);
}

function renderReportCenterRecommendations() {
  const target = document.getElementById("reportRecommendations");
  if (!target) return;
  const items = [
    ["Refill Tank B3 within the next 2 hours.", "Current volume is 15%; estimated depletion in 2h 05m.", "High"],
    ["Investigate recurring ghost flow in Paediatrics Ward.", "3 ghost flow incidents recorded this month.", "Medium"],
    ["Schedule maintenance for ESP32-07.", "Intermittent communication issues detected.", "Medium"],
    ["Review oxygen allocation in Ward C.", "Usage is 18% higher than monthly average.", "Low"]
  ];
  target.innerHTML = items.map(([title, note, priority]) => `
    <article class="recommendation-item ${priority.toLowerCase()}">
      <div><strong>${title}</strong><span>${note}</span></div>
      <b>${priority}</b>
    </article>
  `).join("");
}

function renderReportLiveInsights() {
  const depletionTarget = document.getElementById("reportDepletionDetailTable");
  const flowTarget = document.getElementById("highFlowReportCard");
  const pressureTarget = document.getElementById("highPressureReportCard");
  if (!depletionTarget || !flowTarget || !pressureTarget) return;

  if (isHistoricalReportMonth()) {
    renderHistoricalDepletionReport(depletionTarget);
  } else {
    renderLiveDepletionReport(depletionTarget);
  }

  const activeTanks = wards.flatMap(ward => ward.tanks
    .filter(t => t.active)
    .map(t => ({
      ...t,
      wardName: ward.name,
      percent: Math.round((t.volumeRemaining * 100) / t.maxVolume)
    })));

  const highFlowTanks = activeTanks
    .filter(t => t.highFlowAlert || t.flowRate >= 10)
    .sort((a, b) => b.flowRate - a.flowRate);
  const highPressureTanks = activeTanks
    .filter(t => t.pressure >= 52)
    .sort((a, b) => b.pressure - a.pressure);

  flowTarget.innerHTML = renderAlertReportTable(
    highFlowTanks,
    "Flow",
    t => `${t.flowRate} Litre/Min`,
    "No high abnormal flow readings."
  );
  pressureTarget.innerHTML = renderAlertReportTable(
    highPressureTanks,
    "Pressure",
    t => `${t.pressure} PSI`,
    "No high abnormal pressure readings."
  );

}

function renderLiveDepletionReport(target) {
  const activeTanks = wards.flatMap(ward => ward.tanks
    .filter(t => t.active)
    .map(t => ({
      ...t,
      wardName: ward.name,
      reportVolumeRemaining: getReportVolumeRemaining(t),
      percent: getReportVolumePercent(t)
    })));

  const depletionRows = [...activeTanks]
    .sort((a, b) => a.percent - b.percent)
    .map(t => {
      return [
        t.name,
        t.serial,
        t.wardName,
        `${t.reportVolumeRemaining} L (${t.percent}%)`
      ];
    });

  target.innerHTML = tableHtml(
    ["Tank Name", "Serial Number", "Ward", "Volume Remaining"],
    depletionRows.length ? depletionRows : [["No active tanks", "-", "-", "-"]]
  );
}

function renderHistoricalDepletionReport(target) {
  const month = getSelectedReportMonth();
  const rows = wards.flatMap(ward => {
    const wardData = month?.wards[ward.id] || {};
    const depletedCount = wardData.depleted || 0;
    return Array.from({ length: depletedCount }, (_, index) => {
      const wasCritical = index < (wardData.critical || 0);
      const remainingPercent = wasCritical ? 0 : 8 + ((index + ward.id.length) % 18);
      const tankName = `${ward.name.replace(" Ward", "").replace("Nurse Station", "Nurse")} HIST-${String(index + 1).padStart(2, "0")}`;
      return [
        tankName,
        `${month.label.toUpperCase()}-${ward.id.toUpperCase()}-${String(index + 1).padStart(3, "0")}`,
        ward.name,
        `${Math.round((remainingPercent / 100) * 1200)} L (${remainingPercent}%)`
      ];
    });
  });

  target.innerHTML = tableHtml(
    ["Tank Name", "Serial Number", "Ward", "Volume Remaining"],
    rows.length ? rows : [["No historical depletion records", "-", month?.label || "-", "-"]]
  );
}

function updateOperationsReportPanels() {
  const alertTables = document.querySelector(".report-alert-tables");
  const flowCard = document.getElementById("highAbnormalFlowCard");
  const pressureCard = document.getElementById("highAbnormalPressureCard");
  const wasteCard = document.getElementById("operationsWasteComparisonCard");
  const monthlyCard = document.querySelector(".monthly-comparison-card");
  const depletionSection = document.querySelector(".report-live-grid");
  if (alertTables) alertTables.hidden = true;
  if (flowCard) flowCard.hidden = true;
  if (pressureCard) pressureCard.hidden = true;
  if (wasteCard) wasteCard.hidden = true;
  if (monthlyCard) monthlyCard.hidden = true;
  if (depletionSection) depletionSection.hidden = true;
}

function renderOperationsWasteComparison() {
  const target = document.getElementById("operationsWasteComparison");
  if (!target) return;

  if (selectedReportType !== "operations") {
    target.innerHTML = "";
    return;
  }

  const fullTankVolume = 1200;
  const selectedMonths = getSelectedDemoMonths();
  const rows = selectedMonths.map(month => {
    const monthlyTotals = wards.reduce((sum, ward) => {
      const wardData = month.wards[ward.id] || {};
      const tankUsage = wardData.usage || 0;
      const usedVolume = tankUsage * fullTankVolume;
      return {
        tankUsage: sum.tankUsage + tankUsage,
        usedVolume: sum.usedVolume + usedVolume,
        wastedVolume: sum.wastedVolume + ((wardData.wastage || 0) / 100) * usedVolume
      };
    }, { tankUsage: 0, usedVolume: 0, wastedVolume: 0 });
    const usedVolume = Math.round(monthlyTotals.usedVolume);
    const wastedVolume = Math.round(monthlyTotals.wastedVolume);
    return {
      label: month.label,
      tankUsage: monthlyTotals.tankUsage,
      usedVolume,
      wastedVolume,
      wastageRate: usedVolume ? Number(((wastedVolume / usedVolume) * 100).toFixed(1)) : 0
    };
  });

  const maxVolume = Math.max(...rows.map(row => row.usedVolume), ...rows.map(row => row.wastedVolume), 1);
  const chartWidth = 420;
  const chartHeight = 132;
  const paddingX = 38;
  const paddingY = 18;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const groupWidth = plotWidth / Math.max(1, rows.length);
  const barWidth = Math.max(13, groupWidth * 0.22);
  const latest = rows[rows.length - 1] || { usedVolume: 0, wastedVolume: 0, wastageRate: 0 };

  target.innerHTML = `
    <div class="oxygen-waste-layout">
      <div class="oxygen-waste-chart">
        <div class="oxygen-waste-head">
          <span>Total tank volume used vs estimated wasted volume</span>
          <strong>${latest.wastedVolume} L wasted of ${latest.usedVolume} L</strong>
        </div>
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" aria-label="Monthly used tank volume versus wasted oxygen volume">
          <line class="monthly-axis" x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${chartHeight - paddingY}"></line>
          <line class="monthly-axis" x1="${paddingX}" y1="${chartHeight - paddingY}" x2="${chartWidth - paddingX}" y2="${chartHeight - paddingY}"></line>
          <line class="monthly-gridline" x1="${paddingX}" y1="${paddingY + plotHeight / 2}" x2="${chartWidth - paddingX}" y2="${paddingY + plotHeight / 2}"></line>
          ${rows.map((row, index) => {
            const groupStart = paddingX + index * groupWidth + groupWidth / 2;
            const fullHeight = Math.max(2, (row.usedVolume / maxVolume) * plotHeight);
            const wasteHeight = Math.max(2, (row.wastedVolume / maxVolume) * plotHeight);
            const baseY = chartHeight - paddingY;
            return `
              <rect class="oxygen-full-bar" x="${groupStart - barWidth - 2}" y="${baseY - fullHeight}" width="${barWidth}" height="${fullHeight}" rx="3">
                <title>${row.label} total tank volume used: ${row.usedVolume} L</title>
              </rect>
              <rect class="oxygen-waste-bar" x="${groupStart + 2}" y="${baseY - wasteHeight}" width="${barWidth}" height="${wasteHeight}" rx="3">
                <title>${row.label} wasted: ${row.wastedVolume} L</title>
              </rect>
              <text class="monthly-point-label" x="${groupStart}" y="${chartHeight - 5}">${row.label}</text>
            `;
          }).join("")}
        </svg>
        <div class="oxygen-waste-legend">
          <span><i class="full"></i>Total tank volume used</span>
          <span><i class="waste"></i>Estimated wasted volume</span>
        </div>
      </div>
      ${tableHtml(
        ["Month", "Tank Usage", "Total Volume Used", "Wasted Volume", "Wastage Rate"],
        rows.map(row => [
          row.label,
          row.tankUsage,
          `${row.usedVolume} L`,
          `${row.wastedVolume} L`,
          `${row.wastageRate}%`
        ])
      )}
    </div>
  `;
}

function renderAlertReportTable(items, valueHeader, valueFormatter, emptyText) {
  return tableHtml(
    ["Tank Name", "Serial Number", "Ward", valueHeader],
    items.length ? items.map(t => [
      t.name,
      t.serial,
      t.wardName,
      valueFormatter(t)
    ]) : [[emptyText, "-", "-", "-"]]
  );
}

function renderMonthlyUsageComparison() {
  const target = document.getElementById("monthlyUsageComparison");
  if (!target) return;

  const selectedMonths = getSelectedDemoMonths();
  const monthSummaries = selectedMonths.map(month => {
    const wardEntries = wards.map(ward => ({
      ward: ward.name,
      usage: month.wards[ward.id]?.usage || 0
    }));
    const totalUsage = wardEntries.reduce((sum, row) => sum + row.usage, 0);
    const topWard = [...wardEntries].sort((a, b) => b.usage - a.usage)[0];
    const previousMonth = reportDemoData[reportDemoData.indexOf(month) - 1];
    const previousTotal = previousMonth
      ? wards.reduce((sum, ward) => sum + (previousMonth.wards[ward.id]?.usage || 0), 0)
      : null;
    const change = previousTotal === null ? "Baseline" : `${totalUsage - previousTotal >= 0 ? "+" : ""}${totalUsage - previousTotal}`;
    return {
      label: month.label,
      totalUsage,
      topWard: topWard?.ward || "-",
      topWardUsage: topWard?.usage || 0,
      change
    };
  });
  const maxUsage = Math.max(1, ...monthSummaries.map(row => row.totalUsage));
  const chartWidth = 420;
  const chartHeight = 108;
  const paddingX = 34;
  const paddingY = 16;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const wardSeries = wards.map(ward => ({
    id: ward.id,
    name: ward.name.replace(" Ward", "").replace("Nurse Station", "Nurse"),
    accent: ward.accent,
    values: selectedMonths.map(month => month.wards[ward.id]?.usage || 0)
  }));
  const axisMax = Math.max(40, Math.ceil(Math.max(...wardSeries.flatMap(series => series.values)) / 5) * 5);
  const groupWidth = plotWidth / Math.max(1, monthSummaries.length);
  const barGap = 2;
  const barWidth = Math.max(5, (groupWidth - 18) / Math.max(1, wardSeries.length) - barGap);
  const groupedBars = monthSummaries.map((month, monthIndex) => {
    const groupStart = paddingX + monthIndex * groupWidth + 9;
    return wardSeries.map((series, seriesIndex) => {
      const usage = series.values[monthIndex] || 0;
      const height = Math.max(2, (usage / axisMax) * plotHeight);
      return {
        ...series,
        usage,
        x: groupStart + seriesIndex * (barWidth + barGap),
        y: chartHeight - paddingY - height,
        width: barWidth,
        height,
        month: month.label
      };
    });
  });
  const tableRows = monthSummaries.map(row => [
      row.label,
      row.totalUsage,
      row.topWard,
      row.topWardUsage,
      row.change
    ]);

  target.innerHTML = `
    <div class="monthly-usage-card">
      <div class="monthly-usage-line">
        <div class="monthly-line-head">
          <span>3-month ward bar comparison</span>
          <strong>${monthSummaries[monthSummaries.length - 1]?.totalUsage || 0}</strong>
        </div>
        <svg viewBox="0 0 ${chartWidth} ${chartHeight}" aria-label="Monthly oxygen usage by ward bar chart">
          <line class="monthly-axis" x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${chartHeight - paddingY}"></line>
          <line class="monthly-axis" x1="${paddingX}" y1="${chartHeight - paddingY}" x2="${chartWidth - paddingX}" y2="${chartHeight - paddingY}"></line>
          <line class="monthly-gridline" x1="${paddingX}" y1="${paddingY + plotHeight / 2}" x2="${chartWidth - paddingX}" y2="${paddingY + plotHeight / 2}"></line>
          ${groupedBars.flat().map(bar => `
            <rect class="monthly-bar" x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="2" style="fill:${bar.accent}">
              <title>${bar.month} ${bar.name}: ${bar.usage}</title>
            </rect>
          `).join("")}
          ${monthSummaries.map((row, index) => {
            const x = paddingX + index * groupWidth + groupWidth / 2;
            return `<text class="monthly-point-label" x="${x}" y="${chartHeight - 5}">${row.label}</text>`;
          }).join("")}
        </svg>
        <div class="monthly-ward-legend">
          ${wardSeries.map(series => `<span><i style="background:${series.accent}"></i>${series.name}</span>`).join("")}
        </div>
      </div>
      ${tableHtml(
        ["Month", "Tank Usage", "Top Ward", "Top Ward Usage", "MoM Change"],
        tableRows.length ? tableRows : [["No monthly data", "-", "-", "-", "-"]]
      )}
    </div>
  `;
}

function buildGeneratedReport(type) {
  const allTanks = wards.flatMap(ward => ward.tanks.map(t => ({ ...t, wardName: ward.name, wardId: ward.id, wardAccent: ward.accent })));
  const activeTanks = allTanks.filter(t => t.active);
  const alertTanks = activeTanks.filter(t => t.leakageAlert || t.highFlowAlert);
  const criticalTanks = activeTanks
    .map(t => ({ ...t, percent: Math.round((t.volumeRemaining * 100) / t.maxVolume) }))
    .filter(t => t.percent < 10)
    .sort((a, b) => a.percent - b.percent);
  const warningTanks = activeTanks
    .map(t => ({ ...t, percent: Math.round((t.volumeRemaining * 100) / t.maxVolume) }))
    .filter(t => t.percent >= 10 && t.percent < 30)
    .sort((a, b) => a.percent - b.percent);
  const totalFlowValue = wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
  const avgPressure = Math.round(activeTanks.reduce((sum, t) => sum + t.pressure, 0) / Math.max(1, activeTanks.length));
  const range = getReportRangeLabel();
  const demoSummary = getReportDemoSummary();
  const demoWardRows = demoSummary.wardRows;
  const generatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const reports = {
    operations: () => {
      const highestDemand = [...demoWardRows].sort((a, b) => b.avgFlow - a.avgFlow)[0];
      const mostRisk = [...demoWardRows].sort((a, b) => (b.critical * 3 + b.depleted) - (a.critical * 3 + a.depleted))[0];

      return {
        title: "Operations Summary Report",
        description: "A ward-by-ward operating breakdown of oxygen service availability, active tank inventory, flow demand, pressure condition, and depletion history.",
        range,
        generatedAt,
        kpis: [
          { label: "Avg Flow", value: `${demoSummary.avgFlow} Litre/Min` },
          { label: "Avg Pressure", value: `${demoSummary.avgPressure} PSI` },
          { label: "Total Tank Used", value: demoSummary.totalDepleted }
        ],
        headers: ["Ward", "Avg Flow", "Avg Pressure", "Total Tank Used"],
        rows: demoWardRows.map(row => [
          row.ward.name,
          `${row.avgFlow} Litre/Min`,
          `${row.avgPressure} PSI`,
          row.depleted
        ]),
        brief: [
          `${highestDemand?.ward.name || "No ward"} had the highest average oxygen demand at ${highestDemand?.avgFlow || 0} Litre/Min across the selected range.`,
          mostRisk?.critical || mostRisk?.depleted ? `${mostRisk.ward.name} has the highest usage risk based on critical tank events and total tanks used.` : "No ward currently has critical tank or usage risk in this period.",
          `Across ${demoSummary.monthCount} month${demoSummary.monthCount === 1 ? "" : "s"}, the hospital averaged ${demoSummary.avgActiveTanks} active tanks, ${demoSummary.avgFlow} Litre/Min flow, and ${demoSummary.avgPressure} PSI pressure.`
        ]
      };
    },
    critical: () => {
      const criticalRows = demoWardRows
        .filter(row => row.critical > 0 || row.depleted > 0)
        .sort((a, b) => b.critical - a.critical || b.depleted - a.depleted);
      return {
        title: "Critical Tank Review Report",
        description: "A replacement planning report using demo year-to-date history for critical tank events, total tank use, and replacement exposure.",
        range,
        generatedAt,
        kpis: [
          { label: "Critical Events", value: demoSummary.totalCritical },
          { label: "Total Tank Used", value: demoSummary.totalDepleted },
          { label: "Replacement Cost", value: currency(demoSummary.totalCritical * TANK_COST) },
          { label: "Threshold", value: "< 10%" }
        ],
        headers: ["Ward", "Critical Events", "Total Tank Used", "Replacement Exposure"],
        rows: criticalRows.length ? criticalRows.map(row => [
          row.ward.name,
          row.critical,
          row.depleted,
          currency(row.critical * TANK_COST)
        ]) : [["No tanks below review threshold", "-", "-", badge("Clear", "good")]],
        brief: [
          demoSummary.totalCritical ? `${demoSummary.totalCritical} critical tank event${demoSummary.totalCritical === 1 ? "" : "s"} are represented in the selected demo period.` : "No critical tank events are recorded for this selected period.",
          `${demoSummary.totalDepleted} tank${demoSummary.totalDepleted === 1 ? "" : "s"} were used across the selected range.`,
          "Replacement planning should prioritize wards with repeated critical events and higher total tank use."
        ]
      };
    },
    wastage: () => ({
      title: "Wastage & Leakage Report",
      description: "An alert investigation report using demo year-to-date history for alert load, wastage percentage, and affected wards.",
      range,
      generatedAt,
      kpis: [
        { label: "Period Alerts", value: demoSummary.totalAlerts },
        { label: "Avg Wastage", value: `${demoSummary.avgWastage}%` },
        { label: "Critical Events", value: demoSummary.totalCritical },
        { label: "Affected Wards", value: demoWardRows.filter(row => row.alerts > 0).length }
      ],
      headers: ["Ward", "Avg Wastage", "Critical Events", "Investigation Priority"],
      rows: demoWardRows.map(row => [
        row.ward.name,
        `${row.wastage}%`,
        row.critical,
        row.alerts >= 15 || row.wastage >= 4 ? badge("High", "bad") : row.alerts >= 6 ? badge("Medium", "warn") : badge("Low", "good")
      ]),
      brief: [
        `${demoSummary.totalAlerts} alert event${demoSummary.totalAlerts === 1 ? "" : "s"} are shown in the selected demo period.`,
        `Average wastage for the selected period is ${demoSummary.avgWastage}%.`,
        "Investigation priority is based on alert count, average wastage, and repeated critical events."
      ]
    }),
    ward: () => {
      const wardRows = [...demoWardRows].sort((a, b) => b.usage - a.usage);
      return {
        title: "Ward Usage Comparison Report",
        description: "A ward-by-ward comparison using demo year-to-date history for oxygen usage, average flow, active tanks, and demand ranking.",
        range,
        generatedAt,
        kpis: [
          { label: "Highest Demand", value: wardRows[0]?.ward.name || "-" },
          { label: "Top Usage", value: wardRows[0]?.usage || 0 },
          { label: "Wards Online", value: wardRows.length },
          { label: "Avg Flow", value: `${demoSummary.avgFlow} Litre/Min` }
        ],
        headers: ["Ward", "Oxygen Usage", "Avg Flow"],
        rows: wardRows.map(row => [
          row.ward.name,
          row.usage,
          `${row.avgFlow} Litre/Min`
        ]),
        brief: [
          `${wardRows[0]?.ward.name || "No ward"} has the highest oxygen usage in the selected demo period.`,
          `Total oxygen usage across all wards is ${demoSummary.totalUsage} for the selected range.`,
          "Usage comparison helps prioritize rounds, tank replacement, and nurse station follow-up."
        ]
      };
    }
  };

  return (reports[type] || reports.operations)();
}

function getReportDemoSummary() {
  const selectedMonths = getSelectedDemoMonths();
  const monthCount = Math.max(1, selectedMonths.length);
  const wardRows = wards.map(ward => {
    const totals = selectedMonths.reduce((sum, month) => {
      const data = month.wards[ward.id] || {};
      return {
        activeTanks: sum.activeTanks + (data.activeTanks || 0),
        avgFlow: sum.avgFlow + (data.avgFlow || 0),
        avgPressure: sum.avgPressure + (data.avgPressure || 0),
        alerts: sum.alerts + (data.alerts || 0),
        depleted: sum.depleted + (data.depleted || 0),
        critical: sum.critical + (data.critical || 0),
        wastage: sum.wastage + (data.wastage || 0),
        usage: sum.usage + (data.usage || 0)
      };
    }, { activeTanks: 0, avgFlow: 0, avgPressure: 0, alerts: 0, depleted: 0, critical: 0, wastage: 0, usage: 0 });

    return {
      ward,
      activeTanks: Math.round(totals.activeTanks / monthCount),
      avgFlow: Math.round(totals.avgFlow / monthCount),
      avgPressure: Math.round(totals.avgPressure / monthCount),
      alerts: totals.alerts,
      depleted: totals.depleted,
      critical: totals.critical,
      wastage: Number((totals.wastage / monthCount).toFixed(1)),
      usage: totals.usage
    };
  });

  const totals = wardRows.reduce((sum, row) => ({
    activeTanks: sum.activeTanks + row.activeTanks,
    flow: sum.flow + row.avgFlow,
    pressure: sum.pressure + row.avgPressure,
    alerts: sum.alerts + row.alerts,
    depleted: sum.depleted + row.depleted,
    critical: sum.critical + row.critical,
    wastage: sum.wastage + row.wastage,
    usage: sum.usage + row.usage
  }), { activeTanks: 0, flow: 0, pressure: 0, alerts: 0, depleted: 0, critical: 0, wastage: 0, usage: 0 });

  return {
    monthCount,
    months: selectedMonths,
    wardRows,
    avgActiveTanks: totals.activeTanks,
    avgFlow: totals.flow,
    avgPressure: Math.round(totals.pressure / Math.max(1, wardRows.length)),
    totalAlerts: totals.alerts,
    totalDepleted: totals.depleted,
    totalCritical: totals.critical,
    avgWastage: Number((totals.wastage / Math.max(1, wardRows.length)).toFixed(1)),
    totalUsage: totals.usage
  };
}

function getSelectedDemoMonths() {
  const { start, end } = getReportDateRange();
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  const selected = reportDemoData.filter(item => item.month >= startMonth && item.month <= endMonth);
  return selected.length ? selected : [reportDemoData[reportDemoData.length - 1]];
}

function getSelectedReportMonth() {
  const selectedValue = document.getElementById("reportStartMonth")?.value || "2026-06";
  return reportDemoData.find(item => item.month === selectedValue) || reportDemoData[reportDemoData.length - 1];
}

function isHistoricalReportMonth() {
  const selectedValue = document.getElementById("reportStartMonth")?.value || "2026-06";
  const currentMonth = reportDemoData[reportDemoData.length - 1]?.month || selectedValue;
  return selectedValue < currentMonth;
}

function getReportRangeLabel() {
  const { start, end } = getReportDateRange();
  return `Report period: ${formatReportDateLabel(start)} - ${formatReportDateLabel(end)}`;
}

function getReportToday() {
  const today = new Date();
  const maxDemoDate = new Date("2026-06-21T12:00:00");
  return today > maxDemoDate ? maxDemoDate : today;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReportDateRange() {
  const todayValue = toDateInputValue(getReportToday());
  const startInput = document.getElementById("reportStartDate")?.value || "2026-01-01";
  const endInput = document.getElementById("reportEndDate")?.value || todayValue;
  const start = startInput < "2026-01-01" ? "2026-01-01" : startInput > todayValue ? todayValue : startInput;
  const end = endInput > todayValue ? todayValue : endInput < start ? start : endInput;
  return { start, end };
}

function normalizeReportDateRange() {
  const startInput = document.getElementById("reportStartDate");
  const endInput = document.getElementById("reportEndDate");
  if (!startInput || !endInput) return;
  const { start, end } = getReportDateRange();
  startInput.value = start;
  endInput.value = end;
  endInput.min = start;
}

function syncReportMonthsFromDates() {
  const { start, end } = getReportDateRange();
  const startMonth = document.getElementById("reportStartMonth");
  const endMonth = document.getElementById("reportEndMonth");
  if (startMonth) startMonth.value = start.slice(0, 7);
  if (endMonth) endMonth.value = end.slice(0, 7);
}

function formatReportDateLabel(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function updateDepletionFilterButtons() {
  document.querySelectorAll("[data-depletion-filter]").forEach(button => {
    button.classList.toggle("active", button.dataset.depletionFilter === depletionStatusFilter);
  });
}

function getTankVolumeFloor(t) {
  const floorPercent = depletionVolumeFloors[t.name] || 0;
  return Math.round((floorPercent / 100) * t.maxVolume);
}

function getReportVolumeRemaining(t) {
  return Math.max(t.volumeRemaining, getTankVolumeFloor(t));
}

function getReportVolumePercent(t) {
  return Math.round((getReportVolumeRemaining(t) * 100) / t.maxVolume);
}

function tankDepletionStatus(t) {
  const percent = getReportVolumePercent(t);
  if (percent < 10 || t.highFlowAlert) return { key: "critical", label: "Empty", tone: "bad" };
  if (percent < 30 || t.leakageAlert) return { key: "warning", label: "Moderate", tone: "warn" };
  return { key: "normal", label: "Full", tone: "good" };
}

function renderCharts(activeTanks) {
  renderWardFlowChart();
  renderTankVolumeChart(activeTanks);
  renderAlertDistributionChart();
}

function renderWardFlowChart() {
  const target = document.getElementById("wardFlowChart");
  if (!target) return;
  const maxFlow = Math.max(1, ...wards.map(totalFlow));
  const axisMax = Math.max(10, Math.ceil(maxFlow / 5) * 5);
  target.innerHTML = `
    <div class="flow-graph" style="--axis-max:${axisMax}">
      <span class="axis-title y-axis">Y: Flow Rate (Litre/Min)</span>
      <div class="flow-axis">
        <span>${axisMax}</span>
        <span>${Math.round(axisMax / 2)}</span>
        <span>0</span>
      </div>
      <div class="flow-plot">
        ${wards.map(ward => {
          const flow = totalFlow(ward);
          const height = Math.max(6, Math.round((flow / axisMax) * 100));
          return `
            <div class="flow-bar" title="${ward.name}: ${flow} Litre/Min">
              <strong>${flow}</strong>
              <i style="height:${height}%; background:${ward.accent}"></i>
              <span>${ward.name.replace(" Ward", "").replace("Nurse Station", "Nurse")}</span>
            </div>
          `;
        }).join("")}
      </div>
      <span class="axis-title x-axis">X: Hospital Wards</span>
    </div>
  `;
}

function renderTankVolumeChart(activeTanks) {
  const target = document.getElementById("tankVolumeChart");
  if (!target) return;
  const criticalTanks = activeTanks
    .map(t => ({
      ...t,
      volumePercent: Math.round((t.volumeRemaining * 100) / t.maxVolume)
    }))
    .filter(t => t.volumePercent < 10)
    .sort((a, b) => a.volumePercent - b.volumePercent);

  target.innerHTML = criticalTanks.length
    ? `
      <div class="critical-tank-board">
        ${criticalTanks.map(t => `
          <article class="critical-tank-item">
            <div>
              <strong>${t.name}</strong>
              <span>${t.wardName} | ${t.station}</span>
            </div>
            <b>${t.volumePercent}%</b>
          </article>
        `).join("")}
      </div>
    `
    : `
      <div class="critical-tank-empty">
        <strong>No critical tanks</strong>
        <span>All active oxygen tanks are at or above the 10% volume threshold.</span>
      </div>
    `;
}

function renderWardUsageChart() {
  const target = document.getElementById("wardUsageTable");
  if (!target) return;
  const threshold = 10;
  const usageRows = wards.map(ward => ({
    name: ward.name.replace(" Ward", "").replace("Nurse Station", "Nurse"),
    usage: ward.tanks.filter(t => t.active || t.volumeRemaining < t.maxVolume).length,
    accent: ward.accent
  }));
  const chartWidth = 420;
  const chartHeight = 180;
  const paddingX = 42;
  const paddingY = 22;
  const plotWidth = chartWidth - paddingX * 2;
  const plotHeight = chartHeight - paddingY * 2;
  const axisMax = 15;
  const points = usageRows.map((row, index) => {
    const x = paddingX + (usageRows.length === 1 ? plotWidth / 2 : (index / (usageRows.length - 1)) * plotWidth);
    const plottedUsage = Math.min(row.usage, axisMax);
    const y = paddingY + ((axisMax - plottedUsage) / axisMax) * plotHeight;
    return { ...row, x, y };
  });
  const linePoints = points.map(point => `${point.x},${point.y}`).join(" ");
  const thresholdY = paddingY + ((axisMax - threshold) / axisMax) * plotHeight;
  const averageUsage = usageRows.reduce((sum, row) => sum + row.usage, 0) / Math.max(1, usageRows.length);

  target.innerHTML = `
    <div class="ward-usage-graph">
      <div class="ward-usage-note">
        <strong>Average: ${averageUsage.toFixed(1)}</strong>
        <span>Target threshold: below ${threshold}</span>
      </div>
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" aria-label="Total tank usage by ward line graph">
        <line class="chart-axis" x1="${paddingX}" y1="${paddingY}" x2="${paddingX}" y2="${chartHeight - paddingY}"></line>
        <line class="chart-axis" x1="${paddingX}" y1="${chartHeight - paddingY}" x2="${chartWidth - paddingX}" y2="${chartHeight - paddingY}"></line>
        <line class="chart-gridline" x1="${paddingX}" y1="${paddingY + plotHeight / 2}" x2="${chartWidth - paddingX}" y2="${paddingY + plotHeight / 2}"></line>
        <text class="usage-axis-label" x="${paddingX - 9}" y="${paddingY + 4}">15</text>
        <text class="usage-axis-label" x="${paddingX - 9}" y="${chartHeight - paddingY + 4}">0</text>
        <line class="threshold-line" x1="${paddingX}" y1="${thresholdY}" x2="${chartWidth - paddingX}" y2="${thresholdY}"></line>
        <text class="threshold-label" x="${chartWidth - paddingX}" y="${thresholdY - 5}">threshold 10</text>
        <polyline class="usage-line" points="${linePoints}"></polyline>
        ${points.map(point => `
          <g>
            <circle cx="${point.x}" cy="${point.y}" r="5" fill="${point.usage >= threshold ? colors.red : point.accent}">
              <title>${point.name}: ${point.usage} tanks used</title>
            </circle>
            <text class="usage-point-value" x="${point.x}" y="${point.y - 9}">${point.usage}</text>
          </g>
        `).join("")}
      </svg>
      <div class="ward-usage-axis">
        ${points.map(point => `<span>${point.name}</span>`).join("")}
      </div>
      <div class="ward-usage-labels">
        <span>Y: Total tank usage</span>
        <span>X: Ward</span>
      </div>
    </div>
  `;
}

function renderOrderSummary() {
  const replacementSummary = document.getElementById("replacementSummary");
  if (!replacementSummary) return;

  const activeTanks = wards.flatMap(w => w.tanks).filter(t => t.active);
  const replacementTanks = getOrderCriticalTanks(activeTanks);
  const replacementCount = 20;
  const replacementCost = replacementCount * TANK_COST;

  setOrderHtml("orderRecommendMetrics", `
    ${orderMetric("Reason", "3 tanks below 10% capacity", "R")}
    ${orderMetric("Predicted Shortage", "In 2 hours 05 min", "T", "bad")}
    ${orderMetric("Recommendation", "Order 20 replacement tanks", "O")}
    ${orderMetric("Confidence", "96%", "%", "good")}
  `);

  renderReplacementSummary(replacementTanks);
  setOrderHtml("capacityForecastChart", renderCapacityForecastChart());
  setOrderHtml("riskAssessmentPanel", renderRiskAssessment());
  setOrderHtml("orderTriggerSummary", orderMiniPanel("Order Trigger Summary", [
    ["Tanks below threshold", replacementTanks.length],
    ["Forecasted demand increase", "18%"],
    ["Current system capacity", "15%"],
    ["Threshold exceeded", "<b class=\"order-red\">Yes</b>"]
  ]));
  setOrderHtml("financialSummary", orderMiniPanel("Financial Summary", [
    ["Order Value (Est.)", currency(replacementCost)],
    ["Estimated Waste Prevented", "JMD 820,000"],
    ["Potential Downtime Avoided", "JMD 3,100,000"],
    ["Projected Monthly Savings", "JMD 1,200,000"]
  ], "money"));
  setOrderHtml("supplierInformation", orderMiniPanel("Supplier Information", [
    ["Supplier", "Caribbean Oxygen Ltd."],
    ["Expected Delivery", "Tomorrow, 08:00 AM"],
    ["Lead Time", "14 hours"],
    ["Past Orders", "23"],
    ["Reliability", "<b class=\"order-green\">99%</b>"]
  ]));
  setOrderHtml("orderDetails", orderMiniPanel("Order Details (Preview)", [
    ["Product", "Oxygen Tank (Medical)"],
    ["Quantity", `${replacementCount} Tanks`],
    ["Tank Type", "D-Type (6,800 L)"],
    ["PO Number (Auto)", "AUTO-PO-2026-0619-0018"],
    ["Order Status", "Pending Approval"]
  ]));
  setOrderHtml("orderProcessTimeline", renderOrderProcessTimeline());
}

function tanksUnderVolumePercent(threshold) {
  return wards.flatMap(ward => {
    return ward.tanks
      .filter(t => t.active)
      .map(t => {
        const percent = Math.round((t.volumeRemaining * 100) / t.maxVolume);
        return {
          ...t,
          wardName: ward.name,
          volumePercent: percent,
          replacementCost: TANK_COST
        };
      })
      .filter(t => t.volumePercent < threshold);
  });
}

function renderReplacementSummary(replacementTanks) {
  const summary = document.getElementById("replacementSummary");
  if (!summary) return;

  summary.innerHTML = `
    <table class="order-data-table">
      <thead><tr><th>Tank</th><th>Ward</th><th>Remaining</th><th>Est. Empty</th><th>Status</th></tr></thead>
      <tbody>
        ${replacementTanks.map(t => `
          <tr>
            <td><b>${t.name}</b></td>
            <td>${t.wardName}</td>
            <td>
              <span class="order-remaining"><b>${t.volumePercent}%</b><i><em style="width:${Math.max(4, t.volumePercent)}%"></em></i></span>
            </td>
            <td class="${t.volumePercent < 8 ? "order-red" : "order-orange"}">${t.emptyIn}</td>
            <td>${orderBadge(t.volumePercent < 10 ? "Critical" : "Low", t.volumePercent < 10 ? "bad" : "warn")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <a class="order-card-link" href="#replacementSummary">View all tanks</a>
  `;
}

function getOrderCriticalTanks(activeTanks) {
  const rows = tanksUnderVolumePercent(30).map(t => ({
    ...t,
    emptyIn: t.name === "Tank B3" ? "2h 05m" : t.name === "Tank C1" ? "2h 40m" : "3h 10m"
  }));
  const existing = new Set(rows.map(t => t.name));
  const fallback = [
    { name: "Tank B3", wardName: "Recovery Bay", volumePercent: 6, emptyIn: "2h 05m" },
    { name: "Tank C1", wardName: "Labour Ward", volumePercent: 8, emptyIn: "2h 40m" },
    { name: "Tank A2", wardName: "A&E Ward", volumePercent: 9, emptyIn: "3h 10m" }
  ].filter(t => !existing.has(t.name));
  return [...rows, ...fallback].slice(0, 3);
}

function setOrderHtml(id, html) {
  const target = document.getElementById(id);
  if (target) target.innerHTML = html;
}

function orderMetric(label, value, icon, tone = "") {
  return `
    <div class="order-rec-metric ${tone}">
      <i>${icon}</i>
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function orderMiniPanel(title, rows, tone = "") {
  return `
    <h3>${title}</h3>
    <div class="order-mini-list ${tone}">
      ${rows.map(([label, value]) => `
        <div class="order-mini-row">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function orderBadge(text, tone) {
  return `<span class="order-badge ${tone}">${text}</span>`;
}

function renderRiskAssessment() {
  return `
    <div class="risk-callout">
      <i>!</i>
      <div>
        <strong>Operational Risk: High</strong>
        <span>Delay in ordering may cause ward disruption and impact patient care.</span>
      </div>
    </div>
    <div class="risk-list">
      ${orderMiniRow("Affected Wards", "Recovery Bay, Labour Ward")}
      ${orderMiniRow("Estimated Impact", "Service interruption, patient care delay")}
      ${orderMiniRow("Time Until Shortage", "<b class=\"order-red\">2 hours 05 minutes</b>")}
    </div>
  `;
}

function orderMiniRow(label, value) {
  return `<div class="order-mini-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderCapacityForecastChart() {
  const points = [
    { x: 70, y: 42, label: "8,500 L", color: "#2563eb" },
    { x: 210, y: 105, label: "4,200 L", color: "#2563eb" },
    { x: 350, y: 154, label: "1,100 L", color: "#ef4444" },
    { x: 490, y: 28, label: "10,300 L", color: "#16a34a" }
  ];
  return `
    <svg viewBox="0 0 560 230" role="img" aria-label="Capacity forecast chart">
      <defs>
        <linearGradient id="orderCapacityFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7db6ff" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#7db6ff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <g class="order-chart-axis">
        <line x1="42" y1="184" x2="530" y2="184"/>
        <text x="18" y="185">0</text>
        <text x="10" y="132">3,000</text>
        <text x="10" y="79">6,000</text>
        <text x="10" y="26">9,000</text>
      </g>
      <path d="M70 42 C120 55 160 90 210 105 S305 140 350 154" fill="none" stroke="#6aa5ff" stroke-width="4"/>
      <path d="M70 42 C120 55 160 90 210 105 S305 140 350 154 L350 184 L70 184 Z" fill="url(#orderCapacityFill)"/>
      <path d="M350 154 C395 120 440 70 490 28" fill="none" stroke="#16a34a" stroke-width="4" stroke-dasharray="7 8"/>
      ${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="7" fill="${p.color}" stroke="#fff" stroke-width="3"/><text x="${p.x - 20}" y="${p.y - 15}" fill="${p.color}">${p.label}</text>`).join("")}
      <g class="order-chart-labels">
        <text x="60" y="208">Now</text><text x="192" y="208">12 Hours</text><text x="328" y="208">24 Hours</text><text x="456" y="208">After Delivery</text>
      </g>
    </svg>
    <div class="order-chart-legend"><span><i></i>Without Delivery</span><span><i class="green"></i>With Recommended Order</span></div>
  `;
}

function renderOrderProcessTimeline() {
  const steps = [
    ["Forecast", "Demand predicted", "done"],
    ["Recommendation", "Order recommended", "done"],
    ["Manager Approval", "Awaiting approval", "active"],
    ["Purchase Order", "To be generated", ""],
    ["Supplier", "Processing", ""],
    ["Delivery", "Pending", ""],
    ["Inventory Update", "After delivery", ""]
  ];
  return `<div class="order-timeline">${steps.map((step, index) => `
    <div class="order-step ${step[2]}">
      <i>${index + 1}</i>
      <strong>${step[0]}</strong>
      <span>${step[1]}</span>
    </div>
  `).join("")}</div>`;
}

function renderAdministration() {
  const adminUsers = [
    ["JA", "John Admin", "john.admin@hospital.com", "Administrator", "Active", "19 Jun 2026<br>01:58 PM"],
    ["NM", "Nurse Manager", "nurse.manager@hospital.com", "Nurse Manager", "Active", "19 Jun 2026<br>12:40 PM"],
    ["NS", "Nurse Station", "nurse.station@hospital.com", "Nurse", "Active", "19 Jun 2026<br>11:32 AM"],
    ["FS", "Facilities Team", "facilities@hospital.com", "Facilities", "Active", "19 Jun 2026<br>10:15 AM"],
    ["CF", "CFO", "cfo@hospital.com", "CFO", "Active", "19 Jun 2026<br>09:05 AM"]
  ];
  const adminDevices = [
    ["ESP32-A01", "A&E Ward", "Online", "19 Jun 2026 02:14 PM"],
    ["ESP32-B01", "Paediatrics Ward", "Online", "19 Jun 2026 02:14 PM"],
    ["ESP32-C01", "Recovery Bay", "Online", "19 Jun 2026 02:13 PM"],
    ["ESP32-D01", "Labour Ward", "Online", "19 Jun 2026 02:15 PM"],
    ["ESP32-E01", "Maternity Ward", "Offline", "19 Jun 2026 01:40 PM"]
  ];
  const auditRows = [
    ["19 Jun 2026 02:12 PM", "John Admin", "Updated Alert Rule", "Ghost Flow Threshold changed to 0.5 Litre/Min"],
    ["19 Jun 2026 02:05 PM", "John Admin", "User Role Updated", "Nurse Station role changed to Nurse"],
    ["19 Jun 2026 01:58 PM", "Nurse Manager", "User Login", "Successful login"],
    ["19 Jun 2026 01:45 PM", "John Admin", "Privacy Setting Changed", "Data Retention Period set to 365 days"],
    ["19 Jun 2026 01:30 PM", "Facilities Team", "Device Registered", "ESP32-E01 registered to Maternity Ward"]
  ];

  setOrderHtml("adminUsersTable", `
    <table class="admin-table">
      <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
      <tbody>
        ${adminUsers.map(([initials, name, email, role, status, login]) => `
          <tr>
            <td><div class="admin-user-cell"><span>${initials}</span><div><strong>${name}</strong><small>${email}</small></div></div></td>
            <td>${adminRoleBadge(role)}</td>
            <td>${adminStatusBadge(status)}</td>
            <td>${login}</td>
            <td><button class="admin-row-action" type="button" aria-label="Open actions for ${name}">...</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `);

  setOrderHtml("adminGovernanceList", `
    ${adminSettingRow("Patient Anonymization", "Hide patient identifiers in all modules", "Enabled", "toggle")}
    ${adminSettingRow("Data Retention Period", "Automatic data deletion after period", "365 Days")}
    ${adminSettingRow("Audit Logging", "Record all system and data access", "Enabled")}
    ${adminSettingRow("Data Export Restrictions", "Restrict data export to authorized roles", "Administrator Only")}
  `);

  setOrderHtml("adminAlertRulesList", `
    ${adminSettingRow("Ghost Flow Threshold", "Minimum flow when flag is OFF", "0.5 Litre/Min")}
    ${adminSettingRow("Critical Tank Level", "Alert when tank level below", "10%")}
    ${adminSettingRow("Low Pressure Threshold", "Alert when pressure below", "40 PSI")}
    ${adminSettingRow("Flow Variance (Patient ON)", "Allowed variance from prescribed flow", "+/-10%")}
    ${adminSettingRow("Notification Escalation Time", "Time before auto escalation", "15 Minutes")}
  `);

  setOrderHtml("adminDevicesTable", `
    <table class="admin-table">
      <thead><tr><th>Device ID</th><th>Location</th><th>Status</th><th>Last Seen</th><th>Action</th></tr></thead>
      <tbody>
        ${adminDevices.map(([device, location, status, seen]) => `
          <tr>
            <td><strong>${device}</strong></td>
            <td>${location}</td>
            <td>${adminDeviceStatus(status)}</td>
            <td>${seen}</td>
            <td><button class="admin-row-action" type="button" aria-label="Open actions for ${device}">...</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `);

  setOrderHtml("adminAuditTable", `
    <table class="admin-table">
      <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>
        ${auditRows.map(row => `
          <tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `);
}

function adminRoleBadge(role) {
  const tone = role === "Administrator" ? "blue" : role === "Nurse Manager" ? "purple" : role === "Nurse" ? "green" : role === "Facilities" ? "orange" : "red";
  return `<span class="admin-role-badge ${tone}">${role}</span>`;
}

function adminStatusBadge(status) {
  const tone = status === "Active" ? "good" : "bad";
  return `<span class="admin-status-badge ${tone}">${status}</span>`;
}

function adminDeviceStatus(status) {
  const tone = status === "Online" ? "good" : "bad";
  return `<span class="admin-device-status ${tone}"><i></i>${status}</span>`;
}

function adminSettingRow(title, description, value, type = "") {
  const valueHtml = type === "toggle"
    ? `<span class="admin-toggle on"><i></i></span><strong>${value}</strong>`
    : `<strong>${value}</strong>`;
  return `
    <div class="admin-setting-row">
      <span class="admin-setting-icon">${title.slice(0, 1)}</span>
      <div>
        <strong>${title}</strong>
        <small>${description}</small>
      </div>
      <div class="admin-setting-value">${valueHtml}</div>
      <button class="admin-setting-arrow" type="button" aria-label="Edit ${title}">&gt;</button>
    </div>
  `;
}

function orderDetailRows(rows) {
  return rows.map(([label, value]) => `
    <div class="order-detail-row">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderAnalytics() {
  const summary = document.getElementById("analyticsSummary");
  if (!summary) return;

  const wardTotals = analyticsData.map(ward => {
    const totalTanks = sumValues(ward.usage);
    const leakageTanks = sumValues(ward.leakage);
    return {
      ...ward,
      totalTanks,
      leakageTanks,
      usageCost: totalTanks * TANK_COST,
      leakageCost: leakageTanks * TANK_COST
    };
  });

  const totalTanks = sumValues(wardTotals.map(item => item.totalTanks));
  const totalUsageCost = sumValues(wardTotals.map(item => item.usageCost));
  const totalLeakageTanks = sumValues(wardTotals.map(item => item.leakageTanks));
  const totalLeakageCost = sumValues(wardTotals.map(item => item.leakageCost));
  const topConsumption = [...wardTotals].sort((a, b) => b.totalTanks - a.totalTanks)[0];
  const topWastage = [...wardTotals].sort((a, b) => b.leakageCost - a.leakageCost)[0];

  summary.innerHTML = [
    reportSummaryCard("Total Tanks Used", totalTanks, "Jan-May ward consumption", colors.ae),
    reportSummaryCard("Usage Dollar Value", currency(totalUsageCost), "Tank cost applied monthly", colors.green),
    reportSummaryCard("Leakage Tanks", totalLeakageTanks, "Estimated wasted tanks", colors.red),
    reportSummaryCard("Leakage Dollar Value", currency(totalLeakageCost), "Estimated wastage cost", colors.red),
    reportSummaryCard("Top Consumption", topConsumption.ward, currency(topConsumption.usageCost), topConsumption.accent),
    reportSummaryCard("Top Wastage", topWastage.ward, currency(topWastage.leakageCost), colors.red)
  ].join("");

  renderMonthlyUsageChart(wardTotals);
  renderMonthlyWastageChart(wardTotals);
  renderTopInsight("topConsumption", topConsumption, "consumption", topConsumption.totalTanks, topConsumption.usageCost);
  renderTopInsight("topWastage", topWastage, "leakage wastage", topWastage.leakageTanks, topWastage.leakageCost);

  document.getElementById("analyticsTable").innerHTML = tableHtml(
    ["Ward", "Jan", "Feb", "Mar", "Apr", "May", "Total Tanks", "Usage Value", "Leakage Tanks", "Wastage Value"],
    wardTotals.map(item => [
      item.ward,
      ...item.usage,
      item.totalTanks,
      currency(item.usageCost),
      item.leakageTanks,
      currency(item.leakageCost)
    ])
  );
}

function renderMonthlyUsageChart(wardTotals) {
  const maxMonthTotal = Math.max(1, ...analyticsMonths.map((_, index) => {
    return sumValues(wardTotals.map(item => item.usage[index]));
  }));

  document.getElementById("monthlyUsageChart").innerHTML = analyticsMonths.map((month, index) => {
    const monthTotal = sumValues(wardTotals.map(item => item.usage[index]));
    return `
      <div class="month-group">
        <div class="month-head">
          <strong>${month}</strong>
          <span>${monthTotal} tanks | ${currency(monthTotal * TANK_COST)}</span>
        </div>
        <div class="stacked-bar" title="${month}: ${monthTotal} tanks used">
          ${wardTotals.map(item => {
            const width = Math.max(3, Math.round((item.usage[index] / maxMonthTotal) * 100));
            return `<i style="width:${width}%; background:${item.accent}" title="${item.ward}: ${item.usage[index]} tanks"></i>`;
          }).join("")}
        </div>
      </div>
    `;
  }).join("") + analyticsLegend(wardTotals);
}

function renderMonthlyWastageChart(wardTotals) {
  const maxLeakage = Math.max(1, ...wardTotals.flatMap(item => item.leakage));

  document.getElementById("monthlyWastageChart").innerHTML = analyticsMonths.map((month, index) => {
    const monthLeakage = sumValues(wardTotals.map(item => item.leakage[index]));
    return `
      <div class="month-group">
        <div class="month-head">
          <strong>${month}</strong>
          <span>${monthLeakage} tanks wasted | ${currency(monthLeakage * TANK_COST)}</span>
        </div>
        <div class="wastage-bars">
          ${wardTotals.map(item => {
            const height = Math.max(8, Math.round((item.leakage[index] / maxLeakage) * 72));
            return `
              <span title="${item.ward}: ${item.leakage[index]} wasted tanks (${currency(item.leakage[index] * TANK_COST)})">
                <i style="height:${height}px; background:${item.accent}"></i>
              </span>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }).join("") + analyticsLegend(wardTotals);
}

function renderTopInsight(id, item, label, tanks, value) {
  document.getElementById(id).innerHTML = `
    <div class="top-ring" style="--accent:${item.accent}">
      <strong>${item.ward}</strong>
      <span>${tanks} tanks</span>
    </div>
    <div class="top-detail">
      <span>Top ward ${label}</span>
      <strong>${currency(value)}</strong>
      <small>Based on Jan-May demo data at ${currency(TANK_COST)} per tank.</small>
    </div>
  `;
}

function analyticsLegend(wardTotals) {
  return `
    <div class="analytics-legend">
      ${wardTotals.map(item => `<span><i style="background:${item.accent}"></i>${item.ward}</span>`).join("")}
    </div>
  `;
}

function sumValues(values) {
  return values.reduce((sum, value) => sum + value, 0);
}

function currency(value) {
  return `JMD ${value.toLocaleString()}`;
}

function renderAlertDistributionChart() {
  const target = document.getElementById("alertChart");
  if (!target) return;
  const alertCounts = wards
    .map(ward => ({
      name: ward.name,
      accent: ward.accent,
      count: ward.tanks.filter(t => t.active && (t.leakageAlert || t.highFlowAlert)).length
    }))
    .filter(item => item.count > 0);
  const totalAlerts = alertCounts.reduce((sum, item) => sum + item.count, 0);
  const maxAlerts = Math.max(1, ...alertCounts.map(item => item.count));
  target.innerHTML = `
    <div class="alert-total ${totalAlerts ? "bad" : "good"}">
      <strong>${totalAlerts}</strong>
      <span>${totalAlerts === 1 ? "active alert" : "active alerts"}</span>
    </div>
    <div class="alert-bars">
      ${alertCounts.length ? alertCounts.map(item => {
        const height = Math.max(8, Math.round((item.count / maxAlerts) * 92));
        return `
          <div class="alert-bar">
            <div class="alert-column"><i style="height:${height}px; background:${colors.red}"></i></div>
            <b>${item.count}</b>
            <span>${item.name.replace(" Ward", "")}</span>
          </div>
        `;
      }).join("") : '<div class="alert-empty">No active alert distribution.</div>'}
    </div>
  `;
}

function renderHospitalHeatMap() {
  const heatMap = document.getElementById("hospitalHeatMap");
  if (!heatMap) return;

  if (wards.length < 5) {
    heatMap.innerHTML = `
      <div class="heat-zone support entrance">
        <strong>Heat Map Loading</strong>
        <small>Waiting for ward telemetry</small>
      </div>
    `;
    return;
  }

  const maxFlow = Math.max(1, ...wards.map(totalFlow));
  const zoneState = ward => {
    const flow = totalFlow(ward);
    const ratio = flow / maxFlow;
    const alerts = ward.tanks.filter(t => t.active && (t.leakageAlert || t.highFlowAlert)).length;
    if (alerts) return "ghost";
    if (ratio >= 0.55) return "high";
    return "normal";
  };
  const mapRooms = [
    { label: "ICU", className: "icu", state: "normal", meta: "North intake" },
    { label: "Ward A", className: "ward-a", state: zoneState(wards[0]), meta: "A&E feed" },
    { label: "Ward B", className: "ward-b", state: zoneState(wards[1]), meta: "Labour line" },
    { label: "Ward C", className: "ward-c", state: zoneState(wards[3]), meta: "Recovery line" },
    { label: "Pediatrics", className: "pediatrics", state: zoneState(wards[2]), meta: "Paediatric feed" },
    { label: "Maternity", className: "maternity", state: zoneState(wards[4]), meta: "Nurse station" },
    { label: "Plant Room", className: "plant-room", state: "offline", meta: "Supply control" },
    { label: "", className: "south-service", state: "ghost", meta: "Isolation room" }
  ];

  heatMap.innerHTML = `
    <div class="oxygen-floorplan-shell">
      <div class="floorplan-label main-entry">Main Entrance</div>
      <div class="floorplan-label plant-label">Oxygen Plant</div>
      <div class="floorplan-label ward-wing-label">Patient Ward Wing</div>
      <div class="floorplan-maintenance-dot"></div>
      <div class="floorplan-pipeline main"></div>
      <div class="floorplan-pipeline lower"></div>
      <div class="floorplan-corridor">Central Corridor</div>
      ${mapRooms.map(room => `
        <div class="oxygen-room ${room.className} ${room.state}">
          <b class="room-status ${room.state}"></b>
          <strong>${room.label}</strong>
          <small>${room.meta}</small>
        </div>
      `).join("")}
      <div class="floorplan-wall wall-a"></div>
      <div class="floorplan-wall wall-b"></div>
      <div class="floorplan-wall wall-c"></div>
      <div class="floorplan-wall wall-d"></div>
      <div class="floorplan-door door-a"></div>
      <div class="floorplan-door door-b"></div>
      <div class="floorplan-offline-dot"></div>
    </div>
  `;
}

function openHeatMapDialog() {
  const dialog = document.getElementById("heatMapDialog");
  const body = document.getElementById("heatMapDialogBody");
  const heatMap = document.getElementById("hospitalHeatMap");
  const legend = document.querySelector(".v5-map-card .v5-map-legend");
  if (!dialog || !body || !heatMap) return;

  body.innerHTML = `
    <div class="heatmap-popout-map">${heatMap.innerHTML}</div>
    ${legend ? `<div class="v5-map-legend heatmap-popout-legend">${legend.innerHTML}</div>` : ""}
  `;
  dialog.showModal();
}

function reportSummaryCard(title, value, status, color, icon = "dot", options = {}) {
  const delta = options.delta
    ? `<em class="kpi-delta ${options.deltaTone || ""}">${options.delta}</em>`
    : "";
  return `
    <article class="summary-card v5-kpi-card ${icon}">
      <div class="kpi-copy">
        <span>${title}</span>
        <strong style="color:${color}">${value}</strong>
        <small>${status}${delta}</small>
      </div>
      <b class="kpi-icon ${icon}"></b>
    </article>
  `;
}

function tableHtml(headers, rows) {
  return `
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

function badge(text, tone) {
  return `<span class="badge ${tone}">${text}</span>`;
}

function formatFlow(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} Litre/Min`;
}

function formatVariance(value) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function evaluatePatientFlowStatus(setValue, liveReading) {
  const variance = setValue > 0 ? ((liveReading - setValue) / setValue) * 100 : 0;
  if (liveReading < setValue) {
    return {
      variance,
      badge: badge("Low Flow", "warn"),
      message: "Live reading is below prescribed SetValue."
    };
  }
  if (variance >= 29) {
    return {
      variance,
      badge: badge("High Flow", variance > 40 ? "bad" : "warn"),
      message: variance > 40
        ? "Critical high flow: live reading is more than 40% above SetValue."
        : "High flow: live reading is 29% to 40% above SetValue."
    };
  }
  return {
    variance,
    badge: badge("Normal", "good"),
    message: "Live reading is equal to SetValue or within 1% to 28% above SetValue."
  };
}

function estimateDepletion(t) {
  if (t.flowRate <= 0) return "No flow";
  const minutes = Math.max(1, Math.floor(t.volumeRemaining / Math.max(1, t.flowRate)));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function updateFooter() {
  const now = new Date();
  document.getElementById("lastUpdated").textContent = `Last Updated: ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

function activeAlerts() {
  const alerts = databaseAlertRows.map(row => `${row.ward} ${row.type} - ${row.asset}`);
  if (getTank("Tank A2").leakageAlert || getTank("Tank A2").highFlowAlert) alerts.push("A&E Ward alert - flow normal");
  if (getTank("Tank B3").leakageAlert) alerts.push("Labour Ward wastage");
  if (getTank("Tank C3").leakageAlert) alerts.push("Paediatric C3 wastage");
  wards.forEach(ward => {
    ward.tanks
      .filter(t => t.active && Math.round((t.volumeRemaining * 100) / t.maxVolume) < 10)
      .forEach(t => {
        const percent = Math.round((t.volumeRemaining * 100) / t.maxVolume);
        alerts.push(`${ward.name} critical tank level - ${t.name} at ${percent}%`);
      });
  });
  return alerts;
}

function getTank(name) {
  return wards.flatMap(w => w.tanks).find(t => t.name === name);
}

function totalFlow(ward) {
  return ward.tanks.reduce((sum, t) => sum + t.flowRate, 0);
}

function averagePressure(ward) {
  return Math.round(ward.tanks.reduce((sum, t) => sum + t.pressure, 0) / ward.tanks.length);
}

function rand(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

start();
