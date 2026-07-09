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
      tank("Tank C1", "C1-OXY-3017", "Station 1", 47, 2, { volumeRemaining: 900 }),
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
      tank("Tank R1", "R1-OXY-4106", "Bay 1", 48, 4, { volumeRemaining: 840 }),
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
const depletionVolumeFloors = {};
const analyticsMonths = ["Jan", "Feb", "Mar", "Apr", "May"];
const analyticsData = [
  { ward: "A&E Ward", accent: colors.ae, usage: [18, 21, 24, 27, 30], leakage: [2, 3, 4, 3, 5] },
  { ward: "Labour Ward", accent: colors.labour, usage: [14, 16, 17, 18, 20], leakage: [1, 2, 2, 3, 2] },
  { ward: "Paediatric Ward", accent: colors.paediatric, usage: [20, 22, 26, 29, 34], leakage: [3, 4, 5, 7, 8] },
  { ward: "Recovery Bay", accent: colors.recovery, usage: [10, 12, 13, 15, 16], leakage: [1, 1, 2, 2, 3] },
  { ward: "Nurse Station", accent: colors.nurse, usage: [4, 5, 5, 6, 7], leakage: [0, 0, 1, 1, 1] }
];
const dashboardBaselineAlertsByWard = {
  ae: { activeAlerts: 0, critical: 0, warning: 0 },
  nurse: { activeAlerts: 0, critical: 0, warning: 0 },
  paediatric: { activeAlerts: 0, critical: 0, warning: 0 },
  recovery: { activeAlerts: 0, critical: 0, warning: 0 },
  labour: { activeAlerts: 0, critical: 0, warning: 0 }
};
const ACTIVE_PATIENT_TARGET = 35;
const patientAlertScenarios = [
  { ward: "Paediatric Ward / Station 1", setValue: 2, liveReading: 2.7, alertType: "Ghost Flow" },
  { ward: "Recovery Bay / Bay 1", setValue: 3, liveReading: 2.4, alertType: "Residual Gas" },
  { ward: "Labour Ward / Station 3", setValue: 4, liveReading: 4.2, alertType: "Unauthorized Usage" },
  { ward: "A&E Ward / Station 1", setValue: 3, liveReading: 4.1, alertType: "Leak" },
  { ward: "Nurse Station", setValue: 2, liveReading: 2, alertType: "Residual Gas" }
];
const dashboardBaselinePatientRows = Array.from({ length: ACTIVE_PATIENT_TARGET }, (_, index) => {
  const scenario = patientAlertScenarios[index % patientAlertScenarios.length];
  const status = evaluatePatientFlowStatus(scenario.setValue, scenario.setValue);
  return [
    `PT-${String(index + 1).padStart(4, "0")}`,
    scenario.ward,
    formatFlow(scenario.setValue),
    formatFlow(scenario.setValue),
    formatVariance(status.variance),
    status.badge,
    badge("Clear", "good")
  ];
});
const dashboardBaselineDepletionRows = {
  all: [
    ["Paediatric Ward", "Tank C1", "C1-OXY-3017", "900 L (75%)", "Stable", badge("Full", "good")],
    ["Recovery Bay", "Tank R1", "R1-OXY-4106", "840 L (70%)", "Stable", badge("Full", "good")],
    ["Labour Ward", "Tank B3", "B3-OXY-2390", "780 L (65%)", "Stable", badge("Full", "good")],
    ["A&E Ward", "Tank A2", "A2-OXY-1186", "834 L (70%)", "12h 40m", badge("Full", "good")]
  ],
  critical: [],
  warning: [],
  normal: [
    ["A&E Ward", "Tank A2", "A2-OXY-1186", "834 L (70%)", "12h 40m", badge("Full", "good")],
    ["Labour Ward", "Tank B1", "B1-OXY-2108", "756 L (63%)", "8h 15m", badge("Full", "good")]
  ]
};
const reportHistoricalData = [
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

randomizeHistoricalReportData();

function randomizeHistoricalReportData() {
  reportHistoricalData.forEach((month, monthIndex) => {
    const wardIds = Object.keys(month.wards);
    const monthlyAlertTarget = 42 + ((monthIndex * 5 + Math.floor(Math.random() * 6)) % 9);
    let remainingAlerts = monthlyAlertTarget;
    wardIds.forEach((wardId, index) => {
      const ward = month.wards[wardId];
      const slotsLeft = wardIds.length - index;
      const base = Math.max(4, Math.floor(remainingAlerts / slotsLeft));
      const variance = Math.floor(Math.random() * 5) - 2;
      const alerts = index === wardIds.length - 1
        ? remainingAlerts
        : Math.max(3, base + variance);
      ward.alerts = alerts;
      ward.critical = Math.max(0, Math.round(alerts * (0.08 + Math.random() * 0.08)));
      remainingAlerts -= alerts;
    });
    month.offlineDevices = (monthIndex + Math.floor(Math.random() * 4)) % 5;
  });
}

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
let adminGovernanceSettings = [
  { key: "patientAnonymization", title: "Patient Anonymization", description: "Hide patient identifiers in all modules", value: "Enabled", type: "toggle", enabled: true },
  { key: "dataRetention", title: "Data Retention Period", description: "Automatic data deletion after period", value: "365 Days", options: ["180 Days", "365 Days", "730 Days"] },
  { key: "auditLogging", title: "Audit Logging", description: "Record all system and data access", value: "Enabled", type: "toggle", enabled: true },
  { key: "dataExport", title: "Data Export Restrictions", description: "Restrict data export to authorized roles", value: "Facilities Admin Only", options: ["Facilities Admin Only", "Executive User", "Disabled"] }
];
let adminAlertRules = [
  { key: "ghostFlow", title: "Ghost Flow Threshold", description: "Minimum flow when flag is OFF", value: "0.5 Litre/Min", options: ["0.3 Litre/Min", "0.5 Litre/Min", "0.8 Litre/Min"] },
  { key: "criticalTank", title: "Critical Tank Level", description: "Alert when tank level below", value: "10%", options: ["5%", "10%", "15%"] },
  { key: "lowPressure", title: "Low Pressure Threshold", description: "Alert when pressure below", value: "40 PSI", options: ["35 PSI", "40 PSI", "45 PSI"] },
  { key: "flowVariance", title: "Flow Variance (Patient ON)", description: "Allowed variance from prescribed flow", value: "+/-10%", options: ["+/-10%", "+/-15%", "+/-20%"] },
  { key: "escalation", title: "Notification Escalation Time", description: "Time before auto escalation", value: "15 Minutes", options: ["10 Minutes", "15 Minutes", "30 Minutes"] }
];
let adminDeviceRows = [
  { device: "ESP32-A01", location: "A&E Ward", status: "Online", seen: "19 Jun 2026 02:14 PM" },
  { device: "ESP32-B01", location: "Paediatrics Ward", status: "Online", seen: "19 Jun 2026 02:14 PM" },
  { device: "ESP32-C01", location: "Recovery Bay", status: "Online", seen: "19 Jun 2026 02:13 PM" },
  { device: "ESP32-D01", location: "Labour Ward", status: "Online", seen: "19 Jun 2026 02:15 PM" },
  { device: "ESP32-E01", location: "Maternity Ward", status: "Offline", seen: "19 Jun 2026 01:40 PM" }
];

const permissionViews = {
  admin: {
    label: "Facilities Admin",
    allowedViews: ["report", "dashboard", "alert", "analytics", "order", "administration"]
  },
  "nurse-supervisor": {
    label: "Nurse Supervisor",
    allowedViews: ["report"]
  },
  maintenance: {
    label: "Executive User",
    allowedViews: ["report", "analytics"]
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
    alertType: "",
    alertMessage: ""
  };
}

function cloneWards() {
  return structuredClone(initialWards);
}

function start() {
  resetState();
  setupLogin();
  document.getElementById("resetData").addEventListener("click", resetState);
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
  document.getElementById("adminAddDeviceButton")?.addEventListener("click", openAddDeviceDialog);
  document.getElementById("closeDialog").addEventListener("click", () => document.getElementById("wardDialog").close());
  document.getElementById("closeUserDialog")?.addEventListener("click", () => document.getElementById("userDialog")?.close());
  document.getElementById("closeDeviceDialog")?.addEventListener("click", () => document.getElementById("deviceDialog")?.close());
  document.getElementById("createUserForm")?.addEventListener("submit", createUser);
  document.getElementById("updateUserForm")?.addEventListener("submit", updateUserPermission);
  document.getElementById("addDeviceForm")?.addEventListener("submit", addAdminDevice);
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
  setupAdministrationActions();
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
  const todayMonth = toMonthInputValue(today);
  const startDate = document.getElementById("reportStartDate");
  const endDate = document.getElementById("reportEndDate");
  const endMonth = document.getElementById("reportEndMonth");
  if (startDate && endDate) {
    startDate.min = "2026-01-01";
    startDate.max = toDateInputValue(today);
    endDate.min = "2026-01-01";
    endDate.max = toDateInputValue(today);
    startDate.value = "2026-01-01";
    endDate.value = toDateInputValue(today);
  }
  reportMonth.min = "2026-01";
  reportMonth.max = todayMonth;
  reportMonth.value = todayMonth;
  if (endMonth) {
    endMonth.min = "2026-01";
    endMonth.max = todayMonth;
    endMonth.value = todayMonth;
  }
  syncReportDatesFromMonths();

  reportMonth.addEventListener("change", () => {
    selectedReportPeriod = "";
    syncReportDatesFromMonths();
    renderGeneratedReport();
    renderReportLiveInsights();
    renderMonthlyUsageComparison();
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
  document.getElementById("exportGeneratedReport")?.addEventListener("click", exportGeneratedReport);
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

function exportGeneratedReport() {
  renderGeneratedReport();
  renderReportLiveInsights();
  renderMonthlyUsageComparison();
  const format = document.getElementById("reportExportFormat")?.value || "pdf";
  if (format === "csv") {
    downloadGeneratedReportCsv();
    return;
  }
  window.print();
}

function downloadGeneratedReportCsv() {
  const report = buildGeneratedReport(selectedReportType);
  const rows = [
    ["Report", report.title],
    ["Range", report.range],
    ["Generated", report.generatedAt],
    ["Description", cleanCsvValue(report.description)],
    [],
    ["Key Metrics"],
    ...report.kpis.map(item => [item.label, cleanCsvValue(item.value)]),
    [],
    report.headers,
    ...report.rows.map(row => row.map(cleanCsvValue)),
    [],
    ["Brief Analysis"],
    ...report.brief.map(item => [cleanCsvValue(item)])
  ];
  const csv = rows.map(row => row.map(toCsvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `oxyguard-${selectedReportType}-report-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function cleanCsvValue(value) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = String(value ?? "");
  return (wrapper.textContent || wrapper.innerText || "").replace(/\s+/g, " ").trim();
}

function toCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
              <button type="button" data-permission-view="admin">Facilities Admin</button>
              <button type="button" data-permission-view="nurse-supervisor">Nurse Supervisor</button>
              <button type="button" data-permission-view="maintenance">Executive User</button>
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
  return permissionViews[getActivePermissionKey()] || permissionViews.viewer;
}

function getActivePermissionKey() {
  if (currentUser?.role === "admin") return permissionPreview;
  return normalizePermissionRole(currentUser?.role || currentUser?.label);
}

function normalizePermissionRole(role = "") {
  const value = String(role).trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (value.includes("nurse") && value.includes("supervisor")) return "nurse-supervisor";
  if (value.includes("executive")) return "maintenance";
  if (value.includes("maintenance")) return "maintenance";
  if (value === "admin" || value.includes("administrator") || value.includes("facilities-admin")) return "admin";
  return "viewer";
}

function isNurseSupervisorDashboard() {
  return getActivePermissionKey() === "nurse-supervisor";
}

function isMaintenanceExecutiveDashboard() {
  return getActivePermissionKey() === "maintenance";
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
  scheduleSimulation();
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
  const timedRows = wards.flatMap(ward => ward.tanks
    .filter(t => t.active && (t.leakageAlert || t.highFlowAlert))
    .map(t => ({
      time: formatActivityTime(new Date().toISOString()),
      ward: ward.name,
      type: t.alertType || (t.highFlowAlert ? "Ghost Flow" : "Leak Detection"),
      priority: t.alertType === "Ghost Flow" ? "Critical" : t.alertType === "Unauthorized Bed Usage" ? "High" : "Medium",
      asset: t.occupied ? t.station : t.station.replace("Station", "Bed"),
      status: "Awaiting Response",
      assigned: t.alertType === "Residual Gas" ? "Nurse Station" : "Facilities"
    })));
  return timedRows.slice(0, 6);
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

function scheduleSimulation() {
  timeout(90000, () => {
    const c3 = getTank("Tank C3");
    c3.active = true;
    c3.occupied = false;
    c3.flowRate = 5;
    c3.stationFlowRate = 5;
    c3.leakageAlert = false;
    c3.highFlowAlert = true;
    c3.alertType = "Ghost Flow";
    c3.alertMessage = "Ghost Flow";
    wastage = Math.max(wastage, 8);
    renderAll();
  });

  timeout(300000, () => {
    const a3 = getTank("Tank A3");
    a3.active = true;
    a3.occupied = false;
    a3.flowRate = 4;
    a3.stationFlowRate = 4;
    a3.leakageAlert = true;
    a3.highFlowAlert = false;
    a3.alertType = "Unauthorized Bed Usage";
    a3.alertMessage = "Unauthorized Bed Usage";
    wastage = Math.max(wastage, 12);
    renderAll();
  });

  timeout(600000, () => {
    const r1 = getTank("Tank R1");
    r1.active = true;
    r1.occupied = true;
    r1.flowRate = 1;
    r1.stationFlowRate = 1;
    r1.leakageAlert = true;
    r1.highFlowAlert = false;
    r1.alertType = "Residual Gas";
    r1.alertMessage = "Residual Gas";
    wastage = Math.max(wastage, 14);
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

  const nurseDashboard = isNurseSupervisorDashboard();
  const maintenanceDashboard = isMaintenanceExecutiveDashboard();
  document.getElementById("operationsDashboardGrid")?.toggleAttribute("hidden", nurseDashboard || maintenanceDashboard);
  document.getElementById("nurseSupervisorDashboard")?.toggleAttribute("hidden", !nurseDashboard);
  document.getElementById("executiveMaintenanceDashboard")?.toggleAttribute("hidden", !maintenanceDashboard);

  if (nurseDashboard) {
    renderNurseSupervisorDashboard(allTanks, activeTanks, alertRows);
    return;
  }

  if (maintenanceDashboard) {
    renderMaintenanceExecutiveDashboard({
      totalFlowValue,
      todayConsumptionLitres,
      yesterdayConsumptionLitres,
      wastageTodayLitres,
      wastageCost,
      alertRows,
      activeTanks
    });
    return;
  }

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
    : dashboardBaselineDepletionRows[depletionStatusFilter] || dashboardBaselineDepletionRows.all;
  if (depletionTarget) depletionTarget.innerHTML = tableHtml(
    ["Ward", "Tank", "Serial #", "Volume", "Est. Depletion", "Status"],
    depletionTableRows
  );
}

function renderNurseSupervisorDashboard(allTanks, activeTanks, alertRows) {
  const assignedWard = wards.find(ward => ward.id === "nurse") || wards[0];
  const assignedTanks = allTanks.filter(t => t.wardId === assignedWard.id);
  const activeAssignedTanks = assignedTanks.filter(t => t.active);
  const assignedAlerts = alertRows.filter(t => t.wardId === assignedWard.id);
  const occupiedBeds = assignedTanks.filter(t => t.occupied).length;
  const assignedFlow = activeAssignedTanks.reduce((sum, t) => sum + t.flowRate, 0);
  const avgPressure = Math.round(activeAssignedTanks.reduce((sum, t) => sum + t.pressure, 0) / Math.max(1, activeAssignedTanks.length));
  const lowVolumeCount = activeAssignedTanks.filter(t => getReportVolumePercent(t) < 30).length;

  renderNurseAssignedWard(assignedWard, assignedTanks, activeAssignedTanks, occupiedBeds, assignedAlerts.length);
  renderNurseActiveAlerts(assignedAlerts, lowVolumeCount);
  renderNurseCurrentUsage(assignedFlow, avgPressure, activeAssignedTanks, occupiedBeds);
  renderNurseBedStatus(assignedTanks);
}

function renderNurseAssignedWard(ward, assignedTanks, activeTanks, occupiedBeds, alertCount) {
  const target = document.getElementById("nurseAssignedWard");
  if (!target) return;
  target.innerHTML = `
    <div class="nurse-ward-hero" style="--ward-accent:${ward.accent}">
      <span>Primary assignment</span>
      <strong>${ward.name}</strong>
      <small>${activeTanks.length} active oxygen points | ${occupiedBeds} beds occupied</small>
    </div>
    <div class="nurse-ward-metrics">
      <span><strong>${assignedTanks.length}</strong> monitored beds</span>
      <span><strong>${alertCount}</strong> active alerts</span>
      <span><strong>${ward.location || "Nurse Station"}</strong> location</span>
    </div>
  `;
  const shift = document.getElementById("nurseAssignedShift");
  if (shift) shift.textContent = "Live ward view";
}

function renderNurseActiveAlerts(alertRows, lowVolumeCount) {
  const target = document.getElementById("nurseActiveAlerts");
  const count = document.getElementById("nurseActiveAlertCount");
  if (!target) return;
  const rows = alertRows.map(t => [
    t.station,
    t.leakageAlert ? "Leak Detection" : "High Flow",
    t.leakageAlert ? badge("Critical", "bad") : badge("Warning", "warn"),
    t.alertMessage || "Review oxygen flow reading."
  ]);
  if (lowVolumeCount && !rows.length) {
    rows.push(["Ward supply", "Low Capacity", badge("Warning", "warn"), `${lowVolumeCount} bed point${lowVolumeCount === 1 ? "" : "s"} below 30% volume.`]);
  }
  target.innerHTML = rows.length
    ? tableHtml(["Bed", "Alert", "Priority", "Action"], rows)
    : `<div class="nurse-empty-state">No active alerts for the assigned ward.</div>`;
  if (count) count.textContent = `${rows.length} active`;
}

function renderNurseCurrentUsage(totalFlowValue, avgPressure, activeTanks, occupiedBeds) {
  const target = document.getElementById("nurseCurrentUsage");
  if (!target) return;
  const hourlyUsage = Math.round(totalFlowValue * 60);
  const bedCoverage = Math.round((activeTanks.length / Math.max(1, occupiedBeds)) * 100);
  target.innerHTML = `
    <div class="nurse-usage-grid">
      <span><strong>${Math.round(totalFlowValue)}</strong><small>Litre/Min</small>Total flow</span>
      <span><strong>${hourlyUsage.toLocaleString()}</strong><small>Litre/Hr</small>Estimated use</span>
      <span><strong>${avgPressure}</strong><small>PSI</small>Avg pressure</span>
      <span><strong>${bedCoverage}%</strong><small>Coverage</small>Active beds</span>
    </div>
  `;
  const updated = document.getElementById("nurseUsageUpdated");
  if (updated) updated.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderNurseBedStatus(assignedTanks) {
  const target = document.getElementById("nurseBedStatus");
  const count = document.getElementById("nurseBedStatusCount");
  if (!target) return;
  const rows = assignedTanks.map(t => {
    const flowStatus = evaluatePatientFlowStatus(Math.max(1, t.flowRate - 1), t.flowRate);
    return [
      t.station,
      t.occupied ? badge("Occupied", "good") : badge("Open", "warn"),
      t.active ? badge("Oxygen On", "good") : badge("Off", "warn"),
      formatFlow(t.flowRate),
      flowStatus.badge
    ];
  });
  target.innerHTML = tableHtml(["Bed", "Bed Status", "Oxygen", "Live Reading", "Flow Status"], rows);
  if (count) count.textContent = `${assignedTanks.length} beds`;
}

function renderMaintenanceExecutiveDashboard(summary) {
  const monthlyUsage = getExecutiveMonthlyUsage();
  const projectedLeakageCost = Math.round(summary.wastageCost * 30);
  const preventedLeakageCost = Math.round(projectedLeakageCost * 0.38);
  const savingsDelta = projectedLeakageCost ? formatSignedPercent(preventedLeakageCost / projectedLeakageCost) : "+0.0%";
  const usageDelta = formatSignedPercent((summary.todayConsumptionLitres - summary.yesterdayConsumptionLitres) / summary.yesterdayConsumptionLitres);

  renderExecutiveMetricPanel("executiveEstimatedSavings", {
    value: executiveMoney(preventedLeakageCost),
    label: "Estimated monthly savings",
    detail: `${savingsDelta} avoidable leakage exposure`,
    tone: "good",
    items: [
      ["Prevented wastage", `${Math.round(summary.wastageTodayLitres * 0.38).toLocaleString()} Litre/day`],
      ["Tank equivalent", formatTankEquivalent(preventedLeakageCost / TANK_COST)],
      ["Maintenance impact", "Flow correction + leak response"]
    ]
  });

  renderExecutiveMetricPanel("executiveLeakageCost", {
    value: executiveMoney(projectedLeakageCost),
    label: "Projected leakage cost",
    detail: `${summary.alertRows.length} active maintenance alert${summary.alertRows.length === 1 ? "" : "s"}`,
    tone: summary.alertRows.length ? "warn" : "good",
    items: [
      ["Today leakage", executiveMoney(summary.wastageCost)],
      ["Daily wastage", `${summary.wastageTodayLitres.toLocaleString()} Litre`],
      ["Cost per litre", executiveMoney(OXYGEN_COST_PER_LITRE)]
    ]
  });

  renderExecutiveMonthlyUsage(monthlyUsage);
  renderExecutiveTrendAnalysis(monthlyUsage, usageDelta, summary);
  renderExecutiveWardCostTable();
  renderExecutiveRoiActionTable(summary);
  renderExecutiveBudgetForecastTable(summary, projectedLeakageCost, preventedLeakageCost);
}

function renderExecutiveMetricPanel(targetId, metric) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = `
    <div class="executive-metric-hero ${metric.tone}">
      <span>${metric.label}</span>
      <strong>${metric.value}</strong>
      <small>${metric.detail}</small>
    </div>
    <div class="executive-metric-list">
      ${metric.items.map(([label, value]) => `
        <span><small>${label}</small><strong>${value}</strong></span>
      `).join("")}
    </div>
  `;
}

function getExecutiveMonthlyUsage() {
  return reportHistoricalData.map(month => {
    const usage = Object.values(month.wards).reduce((sum, ward) => sum + ward.usage, 0);
    const wastage = Object.values(month.wards).reduce((sum, ward) => sum + ward.wastage, 0);
    const alerts = Object.values(month.wards).reduce((sum, ward) => sum + ward.alerts + ward.critical, 0);
    const cost = Math.round(usage * TANK_VOLUME_LITRES * OXYGEN_COST_PER_LITRE);
    return {
      label: month.label,
      usage,
      cost,
      wastage: Math.round(wastage * 10) / 10,
      alerts
    };
  });
}

function renderExecutiveMonthlyUsage(monthlyUsage) {
  const target = document.getElementById("executiveMonthlyUsage");
  if (!target) return;
  const maxUsage = Math.max(1, ...monthlyUsage.map(item => item.usage));
  const totalTankUse = monthlyUsage.reduce((sum, item) => sum + item.usage, 0);
  const totalUsageCost = monthlyUsage.reduce((sum, item) => sum + item.cost, 0);
  const averageMonthlyUse = Math.round(totalTankUse / Math.max(1, monthlyUsage.length));
  target.innerHTML = `
    <div class="executive-usage-bars">
      ${monthlyUsage.map(item => `
        <div class="executive-usage-row">
          <span>${item.label}</span>
          <div><i style="width:${Math.max(8, (item.usage / maxUsage) * 100)}%"></i></div>
          <strong>${executiveMoney(item.cost)}</strong>
        </div>
      `).join("")}
    </div>
    <div class="executive-total-tank-card">
      <span>Total Tank Use</span>
      <strong>${totalTankUse}</strong>
      <small>${executiveMoney(totalUsageCost)} YTD oxygen usage cost | ${averageMonthlyUse} average per month</small>
    </div>
    <div class="executive-usage-summary">
      <span><strong>${monthlyUsage.at(-1)?.usage || 0}</strong><small>Latest usage index</small></span>
      <span><strong>${monthlyUsage.at(-1)?.wastage || 0}%</strong><small>Latest wastage</small></span>
      <span><strong>${monthlyUsage.at(-1)?.alerts || 0}</strong><small>Latest alerts</small></span>
    </div>
  `;
}

function renderExecutiveTrendAnalysis(monthlyUsage, usageDelta, summary) {
  const target = document.getElementById("executiveTrendAnalysis");
  if (!target) return;
  const first = monthlyUsage[0]?.usage || 1;
  const latest = monthlyUsage.at(-1)?.usage || first;
  const monthlyTrend = formatSignedPercent((latest - first) / first);
  const activeMaintenanceItems = summary.activeTanks.filter(t => t.leakageAlert || t.highFlowAlert || getReportVolumePercent(t) < 30).length;
  const rows = [
    ["Daily consumption", usageDelta, usageDelta.startsWith("+") ? "Rising" : "Improving"],
    ["Monthly usage trend", monthlyTrend, monthlyTrend.startsWith("+") ? "Demand up" : "Demand down"],
    ["Maintenance focus", `${activeMaintenanceItems} item${activeMaintenanceItems === 1 ? "" : "s"}`, "Leakage and capacity"],
    ["Recommended action", "Audit high-flow zones", "Reduce leakage cost"]
  ];
  target.innerHTML = tableHtml(["Metric", "Value", "Signal"], rows);
}

function renderExecutiveWardCostTable() {
  const target = document.getElementById("executiveWardCostTable");
  if (!target) return;
  const rows = wards.map(ward => {
    const history = reportHistoricalData.map(month => month.wards[ward.id] || {});
    const tankUsage = history.reduce((sum, item) => sum + (item.usage || 0), 0);
    const usageCost = Math.round(tankUsage * TANK_VOLUME_LITRES * OXYGEN_COST_PER_LITRE);
    const leakageCost = Math.round(history.reduce((sum, item) => {
      const monthlyUsageCost = (item.usage || 0) * TANK_VOLUME_LITRES * OXYGEN_COST_PER_LITRE;
      return sum + monthlyUsageCost * ((item.wastage || 0) / 100);
    }, 0));
    const wastagePercent = usageCost ? ((leakageCost / usageCost) * 100).toFixed(1) : "0.0";
    const riskScore = history.reduce((sum, item) => sum + (item.critical || 0) * 3 + (item.alerts || 0) * 2 + Math.round(item.wastage || 0), 0);
    return {
      row: [
        ward.name,
        tankUsage,
        executiveMoney(usageCost),
        executiveMoney(leakageCost),
        `${wastagePercent}%`,
        riskScore >= 55 ? badge("High", "bad") : riskScore >= 35 ? badge("Medium", "warn") : badge("Low", "good")
      ],
      sortValue: usageCost + leakageCost + riskScore * 10000
    };
  })
    .sort((a, b) => b.sortValue - a.sortValue)
    .map(item => item.row);
  target.innerHTML = tableHtml(["Ward", "Tank Use", "YTD Usage Cost", "YTD Leakage Cost", "Wastage", "Risk"], rows);
}

function renderExecutiveRoiActionTable(summary) {
  const target = document.getElementById("executiveRoiActionTable");
  if (!target) return;
  const activeIssues = summary.activeTanks.filter(t => t.leakageAlert || t.highFlowAlert || getReportVolumePercent(t) < 30);
  const leakageAuditSavings = Math.max(24000, Math.round(summary.wastageCost * 30 * 0.22));
  const calibrationSavings = Math.max(18000, Math.round(summary.todayConsumptionLitres * OXYGEN_COST_PER_LITRE * 0.05));
  const preventiveSavings = Math.max(12000, activeIssues.length * 8500);
  const rows = [
    ["Leak survey + valve correction", executiveMoney(18000), executiveMoney(leakageAuditSavings), formatPaybackDays(18000, leakageAuditSavings), badge("Approve", "good")],
    ["Sensor calibration round", executiveMoney(9500), executiveMoney(calibrationSavings), formatPaybackDays(9500, calibrationSavings), badge("Approve", "good")],
    ["Preventive replacement check", executiveMoney(12500), executiveMoney(preventiveSavings), formatPaybackDays(12500, preventiveSavings), activeIssues.length ? badge("Review", "warn") : badge("Schedule", "good")]
  ];
  target.innerHTML = tableHtml(["Action", "Cost", "30-Day Saving", "Payback", "Decision"], rows);
}

function renderExecutiveBudgetForecastTable(summary, projectedLeakageCost, preventedLeakageCost) {
  const target = document.getElementById("executiveBudgetForecastTable");
  if (!target) return;
  const oxygenSpend = Math.round(summary.todayConsumptionLitres * OXYGEN_COST_PER_LITRE * 30);
  const tankReplacementSpend = Math.round(summary.activeTanks.filter(t => getReportVolumePercent(t) < 30).length * TANK_COST);
  const netExposure = oxygenSpend + projectedLeakageCost + tankReplacementSpend - preventedLeakageCost;
  const rows = [
    ["Base oxygen usage", executiveMoney(oxygenSpend), "Recurring monthly demand"],
    ["Leakage exposure", executiveMoney(projectedLeakageCost), "Reduce with maintenance actions"],
    ["Tank replacement reserve", executiveMoney(tankReplacementSpend), "Low-capacity tank planning"],
    ["Estimated savings offset", executiveMoney(preventedLeakageCost, "-"), "Expected avoided cost"],
    ["Net 30-day exposure", executiveMoney(netExposure), "Budget planning figure"]
  ];
  target.innerHTML = tableHtml(["Budget Line", "Amount", "Decision Note"], rows);
}

function executiveMoney(value, prefix = "") {
  return `<span class="executive-money">${prefix}${currency(value)}</span>`;
}

function formatPaybackDays(cost, monthlySaving) {
  const days = Math.max(1, Math.round((cost / Math.max(1, monthlySaving)) * 30));
  return `${days} day${days === 1 ? "" : "s"}`;
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
  const liveLeaks = alertRows.filter(t => t.leakageAlert && !t.alertType).length;
  const liveGhostFlow = alertRows.filter(t => t.alertType === "Ghost Flow" || t.highFlowAlert).length;
  const unauthorized = alertRows.filter(t => t.alertType === "Unauthorized Bed Usage").length;
  const residualGas = alertRows.filter(t => t.alertType === "Residual Gas").length;
  const cards = [
    ["Leaks", liveLeaks, "LK"],
    ["Ghost Flow", liveGhostFlow, "GF"],
    ["Unauthorized", unauthorized, "ID"],
    ["Residual Gas", residualGas, "O2"]
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
    <article class="critical-mini-card ${value ? "active-alert" : "clear-alert"}">
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
    const liveReading = tankItem.alertType === "Ghost Flow"
      ? setValue * 1.35
      : tankItem.alertType === "Unauthorized Bed Usage"
        ? setValue * 1.32
        : tankItem.alertType === "Residual Gas"
          ? setValue * 0.74
          : tankItem.leakageAlert
        ? setValue * 0.8
        : index % 4 === 0
          ? setValue
          : setValue * 1.12;
    const status = evaluatePatientFlowStatus(setValue, liveReading);
    const alertType = getPatientAlertType(tankItem, status, index);
    return [
      `PT-${String(index + 1).padStart(4, "0")}`,
      `${tankItem.wardName} / ${tankItem.station}`,
      formatFlow(setValue),
      formatFlow(liveReading),
      formatVariance(status.variance),
      status.badge,
      patientAlertTypeBadge(alertType)
    ];
  });
  const rows = hasLiveAlerts ? liveRows : dashboardBaselinePatientRows;
  target.innerHTML = tableHtml(["Patient ID", "Ward / Bed", "SetValue", "Live Reading", "Variance", "Status", "Alert"], rows);
}

function getPatientAlertType(tankItem, status, index = 0) {
  if (tankItem.alertType) return tankItem.alertType;
  if (tankItem.leakageAlert) return "Leak";
  if (tankItem.highFlowAlert) return "Ghost Flow";
  if (status.badge.includes("Low Flow")) return "Residual Gas";
  if (status.badge.includes("High Flow")) return index % 2 === 0 ? "Unauthorized Usage" : "Ghost Flow";
  return "Clear";
}

function patientAlertTypeBadge(type) {
  const tone = type === "Leak" || type === "Ghost Flow" ? "bad" : type === "Unauthorized Usage" || type === "Unauthorized Bed Usage" ? "warn" : "good";
  return badge(type, tone);
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
    const baseline = dashboardBaselineAlertsByWard[ward.id] || { activeAlerts: 0, critical: 0, warning: 0 };
    const liveActiveAlerts = ward.tanks.filter(t => t.active && (t.leakageAlert || t.highFlowAlert)).length;
    const liveCritical = ward.tanks.filter(t => t.active && getReportVolumePercent(t) < 10).length;
    const liveWarning = ward.tanks.filter(t => t.active && getReportVolumePercent(t) >= 10 && getReportVolumePercent(t) < 30).length;
    const activeAlerts = Math.max(liveActiveAlerts, baseline.activeAlerts);
    const critical = Math.max(liveCritical, baseline.critical);
    const warning = Math.max(liveWarning, baseline.warning);
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
    ["danger", "First to Deplete", `${firstTank.name} | ${estimateDepletion(firstTank)}`, firstTank.wardName || "Refill priority"],
    ["danger", "Next Refill Route", formatDepletionQueue(depletionOrder.slice(1)), "Plan tank rounds"],
    ["blue", "Oxygen Demand", `${todayConsumptionLitres.toLocaleString()} L`, `${yesterdayDelta} vs yesterday`],
    ["warn", "Wastage Exposure", `${wastageTodayLitres.toLocaleString()} L`, "Review leaks and ghost flow"],
    ["good", "Avoidable Savings", currency((alertRows.length + 1) * 8200), "If alerts are resolved"]
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
  const queue = tanks.slice(0, 2).map(item => `${item.tank.name} ${estimateDepletion(item.tank)}`).join(" | ");
  return tanks.length > 2 ? `${queue} | +${tanks.length - 2} more` : queue;
}

function renderRecentActivity(alertRows) {
  const target = document.getElementById("recentActivityList");
  if (!target) return;
  const loginTime = currentUser?.loginAt || sessionStorage.getItem("oxyguardLoginAt") || new Date().toISOString();
  const username = currentUser?.username || "robertm";
  const notificationEmail = currentUser?.email || "robertmarson88@gmail.com";
  const entries = [[formatActivityTime(loginTime), "blue", `${username} logged in successfully`]];
  if (alertRows.length) {
    const activeAlert = alertRows[0];
    entries.push(
      [formatActivityTime(minutesFromNow(4)), "danger", `${activeAlert.name} ${activeAlert.alertType || "alert"} detected in ${activeAlert.wardName || activeAlert.ward || "Ward C"}`],
      [formatActivityTime(minutesFromNow(3)), "good", `Email notification sent to ${notificationEmail}`],
      [formatActivityTime(minutesFromNow(2)), "blue", `Alert reviewed by ${username}`],
      [formatActivityTime(minutesFromNow(1)), "good", "Maintenance ticket opened for oxygen team"]
    );
  } else {
    entries.push([formatActivityTime(minutesFromNow(1)), "good", "All oxygen wards are operating within normal limits"]);
  }
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
  applyReportTypeLayout(report);
}

const reportTypeLayouts = {
  operations: {
    titles: {
      reportExceptionTitle: "Exception Report",
      reportDepletionTitle: "Tank Depletion Report",
      reportResolutionTitle: "Alert Resolution Performance",
      reportSystemHealthTitle: "Device & System Health Report",
      reportAuditTrailTitle: "Audit Trail Summary",
      reportRecommendationsTitle: "Key Recommendations",
      operationsWasteTitle: "Oxygen Volume Used vs Wastage",
      highAbnormalFlowTitle: "High Abnormal Flow",
      highAbnormalPressureTitle: "High Abnormal Pressure",
      monthlyComparisonTitle: "Monthly Tank Usage Comparison",
      reportDepletionDetailTitle: "Depletion Detail"
    },
    show: { waste: true, flow: true, pressure: true, monthly: true, live: true, health: true }
  },
  critical: {
    titles: {
      reportExceptionTitle: "Critical Tank Events",
      reportDepletionTitle: "Critical Tank Inventory",
      reportResolutionTitle: "Replacement Exposure",
      reportSystemHealthTitle: "Capacity Risk Controls",
      reportAuditTrailTitle: "Critical Tank Audit Trail",
      reportRecommendationsTitle: "Critical Tank Actions",
      highAbnormalPressureTitle: "Critical Pressure Exceptions",
      reportDepletionDetailTitle: "Critical Depletion Detail"
    },
    show: { waste: false, flow: false, pressure: true, monthly: false, live: true, health: true }
  },
  wastage: {
    titles: {
      reportExceptionTitle: "Wastage & Leakage Events",
      reportDepletionTitle: "Leakage Cost Exposure",
      reportResolutionTitle: "Wastage Resolution Performance",
      reportSystemHealthTitle: "Leak Sensor Health",
      reportAuditTrailTitle: "Leakage Audit Trail",
      reportRecommendationsTitle: "Wastage Recommendations",
      operationsWasteTitle: "Wastage Cost & Leakage Trend",
      highAbnormalFlowTitle: "High Flow Leak Indicators"
    },
    show: { waste: true, flow: true, pressure: false, monthly: false, live: false, health: true }
  },
  ward: {
    titles: {
      reportExceptionTitle: "Ward Usage Ranking",
      reportDepletionTitle: "Ward Usage Cost",
      reportResolutionTitle: "Ward Performance",
      reportAuditTrailTitle: "Ward Usage Audit Trail",
      reportRecommendationsTitle: "Ward Usage Recommendations",
      monthlyComparisonTitle: "Monthly Ward Usage Comparison"
    },
    show: { waste: false, flow: false, pressure: false, monthly: true, live: false, health: false }
  }
};

function applyReportTypeLayout(report) {
  const layout = reportTypeLayouts[selectedReportType] || reportTypeLayouts.operations;
  Object.entries(layout.titles).forEach(([id, text]) => {
    const target = document.getElementById(id);
    if (target) target.textContent = text;
  });

  const alertTables = document.querySelector(".report-alert-tables");
  const flowCard = document.getElementById("highAbnormalFlowCard");
  const pressureCard = document.getElementById("highAbnormalPressureCard");
  const wasteCard = document.getElementById("operationsWasteComparisonCard");
  const monthlyCard = document.querySelector(".monthly-comparison-card");
  const depletionSection = document.querySelector(".report-live-grid");
  const healthCard = document.getElementById("reportSystemHealth")?.closest(".report-card");
  if (flowCard) flowCard.hidden = !layout.show.flow;
  if (pressureCard) pressureCard.hidden = !layout.show.pressure;
  if (alertTables) alertTables.hidden = !(layout.show.flow || layout.show.pressure);
  if (wasteCard) wasteCard.hidden = !layout.show.waste;
  if (monthlyCard) monthlyCard.hidden = !layout.show.monthly;
  if (depletionSection) depletionSection.hidden = !layout.show.live;
  if (healthCard) healthCard.hidden = !layout.show.health;

  if (selectedReportType !== "operations") {
    renderCustomReportCards(report);
  }
}

function renderCustomReportCards(report) {
  const primary = document.getElementById("reportExceptionTable");
  if (primary) primary.innerHTML = tableHtml(report.headers, report.rows);

  const secondary = document.getElementById("reportDepletionTable");
  if (secondary) {
    secondary.innerHTML = selectedReportType === "ward"
      ? renderWardUsageCostChart()
      : tableHtml(getReportSecondaryHeaders(), getReportSecondaryRows());
  }

  const performance = document.getElementById("reportResolutionPerformance");
  if (performance) {
    performance.innerHTML = `
      <div class="report-type-metrics">
        ${report.kpis.map((item, index) => `
          <article class="metric-tone-${index % 4}">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
          </article>
        `).join("")}
      </div>
    `;
  }

  const health = document.getElementById("reportSystemHealth");
  if (health) health.innerHTML = tableHtml(["Control", "Status", "Reason"], getReportControlRows());

  const audit = document.getElementById("reportAuditTrail");
  if (audit) {
    audit.innerHTML = tableHtml(
      ["Time", "Report Area", "Action"],
      report.brief.map((note, index) => [`${9 + index}:0${index}`, report.title.replace(" Report", ""), note])
    );
  }

  const recommendations = document.getElementById("reportRecommendations");
  if (recommendations) {
    recommendations.innerHTML = report.brief.map((note, index) => `
      <article>
        <strong>${index + 1}. ${getReportActionLabel()}</strong>
        <span>${note}</span>
        <em>${index === 0 ? "High" : index === 1 ? "Medium" : "Review"}</em>
      </article>
    `).join("");
  }
}

function getReportSecondaryHeaders() {
  if (selectedReportType === "critical") return ["Tank", "Ward", "Current Volume", "Est. Depletion", "Status"];
  if (selectedReportType === "wastage") return ["Ward", "Alert Load", "Avg Wastage", "Leakage Cost", "Priority"];
  return ["Ward", "Usage Cost"];
}

function getReportSecondaryRows() {
  const reportSummary = getReportHistoricalSummary();
  if (selectedReportType === "critical") {
    const activeTanks = wards.flatMap(ward => ward.tanks
      .filter(t => t.active)
      .map(t => ({ ...t, wardName: ward.name })));
    return [...activeTanks]
      .sort((a, b) => getReportVolumePercent(a) - getReportVolumePercent(b))
      .slice(0, 6)
      .map(t => {
        const status = tankDepletionStatus(t);
        return [t.name, t.wardName, `${getReportVolumeRemaining(t)} L (${getReportVolumePercent(t)}%)`, estimateDepletion(t), badge(status.label, status.tone)];
      });
  }
  if (selectedReportType === "wastage") {
    return [...reportSummary.wardRows]
      .sort((a, b) => b.wastage - a.wastage || b.alerts - a.alerts)
      .map(row => {
        const leakageCost = Math.round(row.usage * (row.wastage / 100) * TANK_COST);
        const priority = row.wastage >= 4 || row.alerts >= 15 ? badge("High", "bad") : row.wastage >= 2.5 ? badge("Medium", "warn") : badge("Low", "good");
        return [row.ward.name, row.alerts, `${row.wastage}%`, currency(leakageCost), priority];
      });
  }
  return [...reportSummary.wardRows]
    .sort((a, b) => b.usage - a.usage)
    .map(row => [row.ward.name, currency(row.usage * TANK_COST)]);
}

function renderWardUsageCostChart() {
  const rows = [...getReportHistoricalSummary().wardRows]
    .map(row => ({
      ward: row.ward.name,
      cost: row.usage * TANK_COST,
      accent: row.ward.accent
    }))
    .sort((a, b) => b.cost - a.cost);
  const maxCost = Math.max(1, ...rows.map(row => row.cost));
  return `
    <div class="ward-usage-cost-chart">
      ${rows.map(row => `
        <article>
          <span>${row.ward}</span>
          <div class="ward-cost-bar">
            <i style="width:${Math.max(8, (row.cost / maxCost) * 100)}%; background:${row.accent}"></i>
          </div>
          <strong>${currency(row.cost)}</strong>
        </article>
      `).join("")}
    </div>
  `;
}

function getReportControlRows() {
  const deviceStatus = getHistoricalDeviceStatus();
  if (selectedReportType === "critical") {
    return [
      ["Refill threshold", badge("Active", "good"), "Critical review uses tanks below 10% remaining."],
      ["Open depletion tickets", badge("Monitored", "warn"), "Facilities follow-up is prioritized by estimated depletion."],
      ["Device coverage", `${deviceStatus.online}/${deviceStatus.total}`, "Tank telemetry is included in review."]
    ];
  }
  if (selectedReportType === "wastage") {
    return [
      ["Leak detection", badge("Active", "good"), "Leakage and ghost-flow events are grouped for cost review."],
      ["High-flow checks", badge("Active", "warn"), "Abnormal flow readings are listed as leakage indicators."],
      ["Cost model", currency(TANK_COST), "Dollar exposure is calculated per tank equivalent."]
    ];
  }
  return [
    ["Ward telemetry", badge("Active", "good"), "Usage comparison uses ward-level historical telemetry."],
    ["Device coverage", `${deviceStatus.online}/${deviceStatus.total}`, "Online ESP32 devices are available for ward review."],
    ["Monthly trend", badge("Visible", "good"), "Monthly ward comparison is shown below."]
  ];
}

function getReportActionLabel() {
  if (selectedReportType === "critical") return "Prioritize refill";
  if (selectedReportType === "wastage") return "Investigate leakage";
  if (selectedReportType === "ward") return "Review ward demand";
  return "Recommendation";
}

function renderReportCenterSummary(report) {
  const target = document.getElementById("reportExecutiveSummary");
  const generated = document.getElementById("reportGeneratedSummary");
  if (!target || !generated) return;

  const reportSummary = getReportHistoricalSummary();
  const totalConsumption = reportSummary.totalUsage * TANK_VOLUME_LITRES;
  const wastageLitres = Math.round(totalConsumption * (reportSummary.avgWastage / 100));
  const ghostFlowIncidents = Math.max(2, Math.round(reportSummary.totalAlerts * 0.22));
  const leakageEvents = Math.max(2, Math.round(reportSummary.totalAlerts * 0.18));
  const historicalDeviceStatus = getHistoricalDeviceStatus();
  const rangeLabel = getReportRangeLabel().replace("Report period: ", "");
  const periodTarget = document.getElementById("reportGeneratedPeriod");
  if (periodTarget) periodTarget.textContent = `Report period: ${rangeLabel}`;
  const kpis = [
    ["Total Oxygen Consumed", `${totalConsumption.toLocaleString()} L`, rangeLabel, "good", "drop"],
    ["Estimated Wastage", `${reportSummary.avgWastage}%`, `${wastageLitres.toLocaleString()} Litre`, "good", "leak"],
    ["Critical Alerts", reportSummary.totalAlerts, "Selected month alerts", "bad", "alert"],
    ["Ghost Flow Incidents", ghostFlowIncidents, "Telemetry exceptions", "warn", "ghost"],
    ["Leakage Events", leakageEvents, "Leakage investigation", "bad", "tool"],
    ["Critical Tanks", reportSummary.totalCritical, "Below 10% threshold", "purple", "tank"],
    ["System Availability", `${historicalDeviceStatus.availability}%`, `${historicalDeviceStatus.online}/${historicalDeviceStatus.total} ESP32 online`, "good", "pulse"]
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
  const month = getSelectedReportMonth();
  const rows = wards
    .map(ward => {
      const data = month?.wards[ward.id] || {};
      const percent = data.critical ? 0 : data.depleted ? 8 + data.depleted : Math.max(18, 72 - (data.usage || 0));
      const status = percent < 10
        ? { label: "Empty", tone: "bad" }
        : percent < 30
          ? { label: "Moderate", tone: "warn" }
          : { label: "Full", tone: "good" };
      return [
        `${ward.name.replace(" Ward", "")} ${month?.label || ""}`,
        ward.name,
        `${Math.round((percent / 100) * TANK_VOLUME_LITRES)} L (${percent}%)`,
        data.depleted ? `${data.depleted} tanks used` : "Stable",
        badge(status.label, status.tone),
        data.critical ? "Priority refill" : "-"
      ];
    })
    .sort((a, b) => Number(a[2].match(/\((\d+)%\)/)?.[1] || 100) - Number(b[2].match(/\((\d+)%\)/)?.[1] || 100))
    .slice(0, 5);
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
  const historicalDeviceStatus = getHistoricalDeviceStatus();
  target.innerHTML = tableHtml(["Metric", "Value", "Status"], [
    ["ESP32 Devices Online", `${historicalDeviceStatus.online} / ${ESP32_DEVICE_TOTAL}`, badge("Excellent", "good")],
    ["MQTT Broker Uptime", "100%", badge("Excellent", "good")],
    ["API Server Uptime", "99.9%", badge("Excellent", "good")],
    ["Database Status", "Healthy", badge("Good", "good")],
    ["Offline Devices", historicalDeviceStatus.offline, historicalDeviceStatus.offline ? badge("Warning", "warn") : badge("Clear", "good")],
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

  renderHistoricalDepletionReport(depletionTarget);
  renderHistoricalReportExceptions(flowTarget, pressureTarget);

}

function renderHistoricalReportExceptions(flowTarget, pressureTarget) {
  const month = getSelectedReportMonth();
  const flowRows = wards
    .map(ward => {
      const data = month?.wards[ward.id] || {};
      return {
        ward: ward.name,
        tank: `${ward.name.replace(" Ward", "")} HF-${month?.label || "MON"}`,
        serial: `${(month?.label || "MON").toUpperCase()}-${ward.id.toUpperCase()}-FLOW`,
        value: data.avgFlow || 0,
        alerts: data.alerts || 0
      };
    })
    .filter(row => row.value >= 10 || row.alerts >= 8)
    .sort((a, b) => b.value - a.value)
    .map(row => [row.tank, row.serial, row.ward, `${row.value} Litre/Min`]);

  const pressureRows = wards
    .map(ward => {
      const data = month?.wards[ward.id] || {};
      return {
        ward: ward.name,
        tank: `${ward.name.replace(" Ward", "")} PR-${month?.label || "MON"}`,
        serial: `${(month?.label || "MON").toUpperCase()}-${ward.id.toUpperCase()}-PRESS`,
        value: data.avgPressure || 0,
        critical: data.critical || 0
      };
    })
    .filter(row => row.value >= 50 || row.critical > 0)
    .sort((a, b) => b.value - a.value)
    .map(row => [row.tank, row.serial, row.ward, `${row.value} PSI`]);

  flowTarget.innerHTML = tableHtml(
    ["Tank Name", "Serial Number", "Ward", "Flow"],
    flowRows.length ? flowRows : [["No high abnormal flow readings", "-", month?.label || "-", "-"]]
  );
  pressureTarget.innerHTML = tableHtml(
    ["Tank Name", "Serial Number", "Ward", "Pressure"],
    pressureRows.length ? pressureRows : [["No high abnormal pressure readings", "-", month?.label || "-", "-"]]
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

  if (!["operations", "wastage"].includes(selectedReportType)) {
    target.innerHTML = "";
    return;
  }

  const fullTankVolume = 1200;
  const selectedMonths = getSelectedHistoricalMonths();
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

  const selectedMonths = getSelectedHistoricalMonths();
  const monthSummaries = selectedMonths.map(month => {
    const wardEntries = wards.map(ward => ({
      ward: ward.name,
      usage: month.wards[ward.id]?.usage || 0
    }));
    const totalUsage = wardEntries.reduce((sum, row) => sum + row.usage, 0);
    const topWard = [...wardEntries].sort((a, b) => b.usage - a.usage)[0];
    const previousMonth = reportHistoricalData[reportHistoricalData.indexOf(month) - 1];
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
  const reportSummary = getReportHistoricalSummary();
  const reportWardRows = reportSummary.wardRows;
  const generatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const reports = {
    operations: () => {
      const highestDemand = [...reportWardRows].sort((a, b) => b.avgFlow - a.avgFlow)[0];
      const mostRisk = [...reportWardRows].sort((a, b) => (b.critical * 3 + b.depleted) - (a.critical * 3 + a.depleted))[0];

      return {
        title: "Operations Summary Report",
        description: "A ward-by-ward operating breakdown of oxygen service availability, active tank inventory, flow demand, pressure condition, and depletion history.",
        range,
        generatedAt,
        kpis: [
          { label: "Avg Flow", value: `${reportSummary.avgFlow} Litre/Min` },
          { label: "Avg Pressure", value: `${reportSummary.avgPressure} PSI` },
          { label: "Total Tank Used", value: reportSummary.totalDepleted }
        ],
        headers: ["Ward", "Avg Flow", "Avg Pressure", "Total Tank Used"],
        rows: reportWardRows.map(row => [
          row.ward.name,
          `${row.avgFlow} Litre/Min`,
          `${row.avgPressure} PSI`,
          row.depleted
        ]),
        brief: [
          `${highestDemand?.ward.name || "No ward"} had the highest average oxygen demand at ${highestDemand?.avgFlow || 0} Litre/Min across the selected range.`,
          mostRisk?.critical || mostRisk?.depleted ? `${mostRisk.ward.name} has the highest usage risk based on critical tank events and total tanks used.` : "No ward currently has critical tank or usage risk in this period.",
          `Across ${reportSummary.monthCount} month${reportSummary.monthCount === 1 ? "" : "s"}, the hospital averaged ${reportSummary.avgActiveTanks} active tanks, ${reportSummary.avgFlow} Litre/Min flow, and ${reportSummary.avgPressure} PSI pressure.`
        ]
      };
    },
    critical: () => {
      const criticalRows = reportWardRows
        .filter(row => row.critical > 0 || row.depleted > 0)
        .sort((a, b) => b.critical - a.critical || b.depleted - a.depleted);
      return {
        title: "Critical Tank Review Report",
        description: "A replacement planning report using stored monthly history for critical tank events, total tank use, and replacement exposure.",
        range,
        generatedAt,
        kpis: [
          { label: "Critical Events", value: reportSummary.totalCritical },
          { label: "Total Tank Used", value: reportSummary.totalDepleted },
          { label: "Replacement Cost", value: currency(reportSummary.totalCritical * TANK_COST) },
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
          reportSummary.totalCritical ? `${reportSummary.totalCritical} critical tank event${reportSummary.totalCritical === 1 ? "" : "s"} are represented in the selected period.` : "No critical tank events are recorded for this selected period.",
          `${reportSummary.totalDepleted} tank${reportSummary.totalDepleted === 1 ? "" : "s"} were used across the selected range.`,
          "Replacement planning should prioritize wards with repeated critical events and higher total tank use."
        ]
      };
    },
    wastage: () => ({
      title: "Wastage & Leakage Report",
      description: "An alert investigation report using stored monthly history for alert load, wastage percentage, and affected wards.",
      range,
      generatedAt,
      kpis: [
        { label: "Period Alerts", value: reportSummary.totalAlerts },
        { label: "Avg Wastage", value: `${reportSummary.avgWastage}%` },
        { label: "Critical Events", value: reportSummary.totalCritical },
        { label: "Affected Wards", value: reportWardRows.filter(row => row.alerts > 0).length }
      ],
      headers: ["Ward", "Avg Wastage", "Critical Events", "Investigation Priority"],
      rows: reportWardRows.map(row => [
        row.ward.name,
        `${row.wastage}%`,
        row.critical,
        row.alerts >= 15 || row.wastage >= 4 ? badge("High", "bad") : row.alerts >= 6 ? badge("Medium", "warn") : badge("Low", "good")
      ]),
      brief: [
        `${reportSummary.totalAlerts} alert event${reportSummary.totalAlerts === 1 ? "" : "s"} are shown in the selected period.`,
        `Average wastage for the selected period is ${reportSummary.avgWastage}%.`,
        "Investigation priority is based on alert count, average wastage, and repeated critical events."
      ]
    }),
    ward: () => {
      const wardRows = [...reportWardRows].sort((a, b) => b.usage - a.usage);
      return {
        title: "Ward Usage Comparison Report",
        description: "A ward-by-ward comparison using stored monthly history for oxygen usage, average flow, active tanks, and demand ranking.",
        range,
        generatedAt,
        kpis: [
          { label: "Highest Demand", value: wardRows[0]?.ward.name || "-" },
          { label: "Top Usage", value: wardRows[0]?.usage || 0 },
          { label: "Wards Online", value: wardRows.length },
          { label: "Avg Flow", value: `${reportSummary.avgFlow} Litre/Min` }
        ],
        headers: ["Ward", "Oxygen Usage", "Avg Flow"],
        rows: wardRows.map(row => [
          row.ward.name,
          row.usage,
          `${row.avgFlow} Litre/Min`
        ]),
        brief: [
          `${wardRows[0]?.ward.name || "No ward"} has the highest oxygen usage in the selected period.`,
          `Total oxygen usage across all wards is ${reportSummary.totalUsage} for the selected range.`,
          "Usage comparison helps prioritize rounds, tank replacement, and nurse station follow-up."
        ]
      };
    }
  };

  return (reports[type] || reports.operations)();
}

function getReportHistoricalSummary() {
  const selectedMonths = getSelectedHistoricalMonths();
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

function getSelectedHistoricalMonths() {
  const { start, end } = getReportDateRange();
  const startMonth = start.slice(0, 7);
  const endMonth = end.slice(0, 7);
  const selected = reportHistoricalData.filter(item => item.month >= startMonth && item.month <= endMonth);
  return selected.length ? selected : [reportHistoricalData[reportHistoricalData.length - 1]];
}

function getSelectedReportMonth() {
  const selectedValue = document.getElementById("reportStartMonth")?.value || "2026-06";
  return reportHistoricalData.find(item => item.month === selectedValue) || reportHistoricalData[reportHistoricalData.length - 1];
}

function getHistoricalDeviceStatus() {
  const month = getSelectedReportMonth();
  const offline = Math.max(0, Math.min(ESP32_DEVICE_TOTAL, month?.offlineDevices ?? 0));
  const online = ESP32_DEVICE_TOTAL - offline;
  return {
    total: ESP32_DEVICE_TOTAL,
    offline,
    online,
    availability: Math.round((online / ESP32_DEVICE_TOTAL) * 100)
  };
}

function isHistoricalReportMonth() {
  const selectedValue = document.getElementById("reportStartMonth")?.value || "2026-06";
  const currentMonth = reportHistoricalData[reportHistoricalData.length - 1]?.month || selectedValue;
  return selectedValue < currentMonth;
}

function getReportRangeLabel() {
  const { start, end } = getReportDateRange();
  return `Report period: ${formatReportDateLabel(start)} - ${formatReportDateLabel(end)}`;
}

function getReportToday() {
  const today = new Date();
  const maxHistoricalDate = new Date("2026-06-21T12:00:00");
  return today > maxHistoricalDate ? maxHistoricalDate : today;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getReportDateRange() {
  const todayValue = toDateInputValue(getReportToday());
  const startMonth = document.getElementById("reportStartMonth")?.value;
  const endMonth = startMonth;
  const startInput = startMonth ? `${startMonth}-01` : document.getElementById("reportStartDate")?.value || "2026-01-01";
  const endInput = endMonth ? getReportMonthEndDate(endMonth) : document.getElementById("reportEndDate")?.value || todayValue;
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

function normalizeReportMonthRange() {
  const startMonth = document.getElementById("reportStartMonth");
  const endMonth = document.getElementById("reportEndMonth");
  const maxMonth = toMonthInputValue(getReportToday());
  if (!startMonth) return;
  if (!startMonth.value || startMonth.value < "2026-01") startMonth.value = "2026-01";
  if (startMonth.value > maxMonth) startMonth.value = maxMonth;
  if (endMonth) {
    endMonth.value = startMonth.value;
    endMonth.min = startMonth.value;
    endMonth.max = maxMonth;
  }
}

function syncReportDatesFromMonths() {
  normalizeReportMonthRange();
  const startDate = document.getElementById("reportStartDate");
  const endDate = document.getElementById("reportEndDate");
  const startMonth = document.getElementById("reportStartMonth")?.value || "2026-01";
  if (startDate) startDate.value = `${startMonth}-01`;
  if (endDate) endDate.value = getReportMonthEndDate(startMonth);
}

function getReportMonthEndDate(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthValue}-${String(lastDay).padStart(2, "0")}`;
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
    ${adminGovernanceSettings.map(setting => adminSettingRow(setting, "governance")).join("")}
  `);

  setOrderHtml("adminAlertRulesList", `
    ${adminAlertRules.map(setting => adminSettingRow(setting, "alert")).join("")}
  `);

  setOrderHtml("adminDevicesTable", `
    <table class="admin-table">
      <thead><tr><th>Device ID</th><th>Location</th><th>Status</th><th>Last Seen</th><th>Actions</th></tr></thead>
      <tbody>
        ${adminDeviceRows.map(({ device, location, status, seen }) => `
          <tr>
            <td><strong>${device}</strong></td>
            <td>${location}</td>
            <td>${adminDeviceStatus(status)}</td>
            <td>${seen}</td>
            <td>
              <div class="admin-device-actions">
                <button class="admin-row-action" type="button" data-device-action="toggle" data-device-id="${device}">${status === "Online" ? "Disable" : "Enable"}</button>
                <button class="admin-row-action" type="button" data-device-action="ping" data-device-id="${device}">Ping</button>
              </div>
            </td>
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

function adminSettingRow(setting, group) {
  const valueHtml = setting.type === "toggle"
    ? `<button class="admin-toggle ${setting.enabled ? "on" : ""}" type="button" data-admin-setting-group="${group}" data-admin-setting-key="${setting.key}" aria-label="Toggle ${setting.title}"><i></i></button><strong>${setting.enabled ? "Enabled" : "Disabled"}</strong>`
    : `<select class="admin-setting-select" data-admin-setting-group="${group}" data-admin-setting-key="${setting.key}" aria-label="Update ${setting.title}">
        ${(setting.options || [setting.value]).map(option => `<option value="${option}" ${option === setting.value ? "selected" : ""}>${option}</option>`).join("")}
      </select>`;
  return `
    <div class="admin-setting-row">
      <span class="admin-setting-icon">${setting.title.slice(0, 1)}</span>
      <div>
        <strong>${setting.title}</strong>
        <small>${setting.description}</small>
      </div>
      <div class="admin-setting-value">${valueHtml}</div>
      <button class="admin-setting-arrow" type="button" data-admin-setting-group="${group}" data-admin-setting-key="${setting.key}" aria-label="Apply ${setting.title}">Save</button>
    </div>
  `;
}

function setupAdministrationActions() {
  document.addEventListener("click", event => {
    const toggle = event.target.closest?.(".admin-toggle[data-admin-setting-key]");
    const save = event.target.closest?.(".admin-setting-arrow[data-admin-setting-key]");
    const deviceAction = event.target.closest?.("[data-device-action]");

    if (toggle) {
      updateAdminSetting(toggle.dataset.adminSettingGroup, toggle.dataset.adminSettingKey, "toggle");
      return;
    }

    if (save) {
      updateAdminSetting(save.dataset.adminSettingGroup, save.dataset.adminSettingKey, "save");
      return;
    }

    if (deviceAction) {
      updateAdminDevice(deviceAction.dataset.deviceAction, deviceAction.dataset.deviceId);
    }
  });

  document.addEventListener("change", event => {
    const select = event.target.closest?.(".admin-setting-select[data-admin-setting-key]");
    if (!select) return;
    updateAdminSetting(select.dataset.adminSettingGroup, select.dataset.adminSettingKey, "select", select.value);
  });
}

function getAdminSettingCollection(group) {
  return group === "alert" ? adminAlertRules : adminGovernanceSettings;
}

function updateAdminSetting(group, key, action, selectedValue = "") {
  const collection = getAdminSettingCollection(group);
  const setting = collection.find(item => item.key === key);
  if (!setting) return;
  if (setting.type === "toggle" && action === "toggle") {
    setting.enabled = !setting.enabled;
    setting.value = setting.enabled ? "Enabled" : "Disabled";
  }
  if (selectedValue) {
    setting.value = selectedValue;
  }
  renderAdministration();
}

function updateAdminDevice(action, deviceId) {
  const device = adminDeviceRows.find(item => item.device === deviceId);
  if (!device) return;
  if (action === "toggle") {
    device.status = device.status === "Online" ? "Offline" : "Online";
  }
  if (action === "ping") {
    device.status = "Online";
  }
  device.seen = new Date().toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  renderAdministration();
}

function openAddDeviceDialog() {
  const form = document.getElementById("addDeviceForm");
  const message = document.getElementById("deviceMessage");
  form?.reset();
  if (message) message.textContent = "";
  document.getElementById("deviceDialog")?.showModal();
  document.getElementById("newDeviceId")?.focus();
}

function addAdminDevice(event) {
  event?.preventDefault();
  const deviceId = document.getElementById("newDeviceId")?.value.trim();
  const location = document.getElementById("newDeviceLocation")?.value.trim();
  const message = document.getElementById("deviceMessage");
  if (!deviceId || !location) {
    if (message) message.textContent = "Enter both device ID and location.";
    return;
  }
  if (adminDeviceRows.some(item => item.device.toLowerCase() === deviceId.toLowerCase())) {
    if (message) message.textContent = "Device ID already exists.";
    return;
  }
  adminDeviceRows.push({
    device: deviceId,
    location,
    status: "Online",
    seen: new Date().toLocaleString([], { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  });
  renderAdministration();
  document.getElementById("deviceDialog")?.close();
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
      <small>Based on Jan-May historical data at ${currency(TANK_COST)} per tank.</small>
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

  const zoneState = () => "normal";
  const mapRooms = [
    { label: "ICU", className: "icu", state: "normal", meta: "North intake" },
    { label: "Ward A", className: "ward-a", state: zoneState(wards[0]), meta: "A&E feed" },
    { label: "Ward B", className: "ward-b", state: zoneState(wards[1]), meta: "Labour line" },
    { label: "Ward C", className: "ward-c", state: zoneState(wards[3]), meta: "Recovery line" },
    { label: "Pediatrics", className: "pediatrics", state: zoneState(wards[2]), meta: "Paediatric feed" },
    { label: "Maternity", className: "maternity", state: zoneState(wards[4]), meta: "Nurse station" },
    { label: "Plant Room", className: "plant-room", state: "normal", meta: "Supply control" },
    { label: "", className: "south-service", state: "normal", meta: "Isolation room" }
  ];

  heatMap.innerHTML = `
    <div class="oxygen-floorplan-shell">
      <div class="floorplan-label main-entry">Main Entrance</div>
      <div class="floorplan-label plant-label">Oxygen Plant</div>
      <div class="floorplan-label ward-wing-label">Patient Ward Wing</div>
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
  const alerts = [];
  wards.forEach(ward => {
    ward.tanks
      .filter(t => t.active && (t.leakageAlert || t.highFlowAlert))
      .forEach(t => alerts.push(`${ward.name} ${t.alertType || "oxygen alert"} - ${t.name}`));
  });
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
