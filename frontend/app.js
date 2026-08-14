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
const CYLINDER_REFILL_COST = 7500;
const NEW_CYLINDER_COST = 48000;
const TANK_COST = CYLINDER_REFILL_COST;
const YESTERDAY_CONSUMPTION_LITRES = 69077;
const ESP32_DEVICE_TOTAL = 24;
const depletionVolumeFloors = {};
let analyticsMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
let analyticsRangeEnd = analyticsMonths.length - 1;
let analyticsData = [
  { ward: "A&E Ward", accent: colors.ae, usage: [18, 21, 24, 27, 30, 32, 35], leakage: [2, 3, 4, 3, 5, 5, 6] },
  { ward: "Labour Ward", accent: colors.labour, usage: [14, 16, 17, 18, 20, 21, 23], leakage: [1, 2, 2, 3, 2, 3, 3] },
  { ward: "Paediatric Ward", accent: colors.paediatric, usage: [20, 22, 26, 29, 34, 36, 39], leakage: [3, 4, 5, 7, 8, 8, 9] },
  { ward: "Recovery Bay", accent: colors.recovery, usage: [10, 12, 13, 15, 16, 17, 18], leakage: [1, 1, 2, 2, 3, 3, 3] },
  { ward: "Nurse Station", accent: colors.nurse, usage: [4, 5, 5, 6, 7, 8, 9], leakage: [0, 0, 1, 1, 1, 1, 1] }
];
let analyticsRulePerformance = buildAnalyticsRuleHistory();

function buildAnalyticsRuleHistory() {
  const periods = [
    ["2026-01-31", [8, 7, 11], [31, 27, 42], [128, 119, 495], [28800, 26600, 107800]],
    ["2026-02-28", [17, 15, 23], [31, 27, 42], [272, 255, 1035], [61200, 57000, 225400]],
    ["2026-03-31", [27, 24, 36], [31, 28, 41], [432, 408, 1620], [97200, 91200, 352800]],
    ["2026-04-30", [38, 32, 50], [32, 27, 42], [608, 544, 2250], [136800, 121600, 490000]],
    ["2026-05-31", [50, 39, 62], [33, 26, 41], [800, 663, 2790], [180000, 148200, 607600]],
    ["2026-06-30", [60, 48, 75], [33, 26, 41], [960, 816, 3375], [216000, 182400, 735000]],
    ["2026-07-28", [69, 56, 86], [33, 27, 41], [1104, 952, 3870], [248400, 212800, 842800]]
  ];
  const keys = ["ghost_flow", "unauthorized_bed_usage", "residual_gas"];
  return periods.flatMap(([asOfDate, detections, shares, oxygenRisk, exposure]) => keys.map((ruleKey, index) => ({
    rule_key: ruleKey,
    active_detections: detections[index],
    detection_share: shares[index],
    oxygen_at_risk_litres: oxygenRisk[index],
    cost_exposure_jmd: exposure[index],
    recoverable_value_jmd: Math.round(exposure[index] * 0.7),
    as_of_date: asOfDate
  })));
}
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
const incidentResponseDrafts = new Map();
const incidentActionDrafts = new Map();
const simulatorAlertTargets = new Map();
let activeIncidentResponseEditorId = "";
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
let databaseConnectionStatus = {
  label: "Checking...",
  tone: "warn"
};
let adminGovernanceSettings = [
  { key: "patientAnonymization", title: "Patient Anonymization", description: "Hide patient identifiers in all modules", value: "Enabled", type: "toggle", enabled: true },
  { key: "dataRetention", title: "Data Retention Period", description: "Automatic data deletion after period", value: "365 Days", options: ["180 Days", "365 Days", "730 Days"] },
  { key: "auditLogging", title: "Audit Logging", description: "Record all system and data access", value: "Enabled", type: "toggle", enabled: true },
  { key: "dataExport", title: "Data Export Restrictions", description: "Restrict data export to authorized roles", value: "Administrator Only", options: ["Administrator Only", "CFO", "Disabled"] }
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
let simulatorEvents = [];
let simulatorDeviceSequence = Math.floor(Date.now() / 1000) % 1000;
let simulatorPresetInitialized = false;
let auditCaptureInitialized = false;
let lastCapturedAudit = { signature: "", at: 0 };
let auditLogDialogRows = [];
let auditLogDialogRequestId = 0;
let adminAuditRequestId = 0;
let adminAuditLoading = false;
let lastAdminAuditFetchAt = 0;
let selectedAuditLogDay = "";
let wardCardStatusOverrides = new Map();
let activeWardAlertKey = "";
let orderSummaryRequestId = 0;
let lastOrderSummaryFetchAt = 0;
let pendingMfaChallenge = null;

const WARD_STATUS_EDITOR_ROLES = new Set(["admin", "nurse-supervisor", "nurse"]);
const WARD_STATUS_OPTIONS = ["Normal", "Supply Failure", "Ghost Flow", "Flow Anomaly", "Leakage"];

const permissionViews = {
  admin: {
    label: "Administrator",
    allowedViews: ["report", "dashboard", "alert", "analytics", "simulator", "order", "administration"]
  },
  "facilities-manager": {
    label: "Facilities Manager",
    allowedViews: ["report"]
  },
  "nurse-supervisor": {
    label: "Nurse Manager",
    allowedViews: ["report"]
  },
  nurse: {
    label: "Nurse",
    allowedViews: ["report", "alert"]
  },
  maintenance: {
    label: "CFO",
    allowedViews: ["report", "analytics", "dashboard"]
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
    cylinderStatus: options.cylinderStatus ?? (options.active === false ? "EMPTY" : "ACTIVE"),
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
  document.getElementById("analyticsMonthRange")?.addEventListener("input", event => {
    analyticsRangeEnd = Math.max(1, Math.min(analyticsMonths.length - 1, Number(event.target.value)));
    renderAnalytics();
  });
  document.getElementById("protocolDetails")?.addEventListener("click", () => {
    window.alert("Protocol details: automated replenishment is triggered when projected depletion falls below the safety buffer.");
  });
  document.getElementById("downloadOrderSummary")?.addEventListener("click", () => {
    window.alert("Order summary downloaded.");
    void recordAuditEvent("Report Download", "Order summary download");
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
  document.getElementById("simulatorForm")?.addEventListener("submit", submitSimulatorEvent);
  document.getElementById("simulatorAlertType")?.addEventListener("change", applySimulatorPreset);
  document.getElementById("simulatorWard")?.addEventListener("change", populateSimulatorTanks);
  document.getElementById("simulatorTank")?.addEventListener("change", () => syncSimulatorTankLocation(false));
  ["simulatorPatientStatus", "simulatorPrescribedFlow", "simulatorLiveReading", "simulatorCylinderStatus", "simulatorCylinderCapacity", "simulatorConsumedVolume", "simulatorRuleFlowRate", "simulatorBreathingVariance", "simulatorDuration", "simulatorEmrStatus"].forEach(id => {
    const input = document.getElementById(id);
    const handleChange = () => {
      renderSimulatorRulePreview();
      updateSimulatorCriteriaFeedback();
    };
    input?.addEventListener("input", handleChange);
    input?.addEventListener("change", handleChange);
  });
  document.getElementById("simulatorApplyPreset")?.addEventListener("click", applySimulatorPreset);
  document.querySelectorAll("[data-simulator-preset]").forEach(button => {
    button.addEventListener("click", () => {
      document.getElementById("simulatorAlertType").value = button.dataset.simulatorPreset;
      applySimulatorPreset();
    });
  });
  document.getElementById("closeHeatMapDialog")?.addEventListener("click", () => document.getElementById("heatMapDialog")?.close());
  document.getElementById("viewAllAuditLogsButton")?.addEventListener("click", openAuditLogDialog);
  document.getElementById("closeAuditLogDialog")?.addEventListener("click", () => document.getElementById("auditLogDialog")?.close());
  document.getElementById("closeWardAlertDialog")?.addEventListener("click", () => document.getElementById("wardAlertDialog")?.close());
  document.getElementById("auditLogDayFilter")?.addEventListener("change", event => {
    selectedAuditLogDay = event.currentTarget.value;
    loadAuditLogDialogRows();
  });
  document.getElementById("emailAuditLogButton")?.addEventListener("click", emailAuditLogRows);
  document.getElementById("dashboardHeatMapCard")?.addEventListener("click", openHeatMapDialog);
  document.getElementById("dashboardHeatMapCard")?.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openHeatMapDialog();
    }
  });
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.addEventListener("change", event => {
    const select = event.target.closest(".ward-status-select");
    if (select) updateWardCardStatus(select);
  });
  setupNotifications();
  setupPermissionPreview();
  setupAdministrationActions();
  setupDepletionFilters();
  setupReportGenerator();
  setupPipelineFilters();
  setupGlobalAuditCapture();
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
  document.getElementById("emailGeneratedReport")?.addEventListener("click", generateSelectedReport);
  document.getElementById("printGeneratedReport")?.addEventListener("click", previewGeneratedReport);
  document.getElementById("exportGeneratedReport")?.addEventListener("click", exportGeneratedReport);
  document.getElementById("closeReportPreviewDialog")?.addEventListener("click", () => {
    document.getElementById("reportPreviewDialog")?.close();
  });
  document.getElementById("reportPreviewDialog")?.addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
}

function generateSelectedReport() {
  const button = document.getElementById("emailGeneratedReport");
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.textContent = "Generating...";
  }

  renderGeneratedReport();
  renderReportLiveInsights();
  renderMonthlyUsageComparison();

  const report = buildGeneratedReport(selectedReportType);
  updateReportActionStatus(`${report.title} generated at ${report.generatedAt}.`, "success");
  void recordAuditEvent("Report Generated", `${selectedReportType} report; ${report.range}`);
  document.getElementById("reportGeneratedSummaryCard")?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (button) {
    button.textContent = "Generated";
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = "Generate";
    }, 900);
  }
}

function previewGeneratedReport() {
  renderGeneratedReport();
  renderReportLiveInsights();
  renderMonthlyUsageComparison();

  const dialog = document.getElementById("reportPreviewDialog");
  const body = document.getElementById("reportPreviewBody");
  if (!dialog || !body) return;

  const previewSections = ["reportGeneratedSummaryCard", "reportExecutiveSummary", "generatedReport"]
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .map(section => {
      const clone = section.cloneNode(true);
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
      return clone;
    });
  body.replaceChildren(...previewSections);
  updateReportActionStatus("Preview opened. Export PDF to open the print/save dialog.", "info");
  if (!dialog.open) dialog.showModal();
}

function updateReportActionStatus(message, tone = "info") {
  const status = document.getElementById("reportActionStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
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
    updateReportActionStatus("CSV export downloaded.", "success");
    return;
  }
  void recordAuditEvent("Report Download", `${selectedReportType} report; format=pdf`);
  updateReportActionStatus("PDF export opened. Choose Save as PDF in the print dialog.", "success");
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
  void recordAuditEvent("Report Download", `${selectedReportType} report; format=csv`);
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
  const mfaCode = document.getElementById("loginMfaCode");
  const mfaField = document.getElementById("authCodeField");
  const backButton = document.getElementById("loginBackButton");
  const submit = document.getElementById("loginSubmit");
  const error = document.getElementById("loginError");
  const hint = document.getElementById("loginHint");
  const resetPanel = document.getElementById("passwordResetPanel");
  const resetMessage = document.getElementById("resetPasswordMessage");
  let resetChallengeId = "";

  document.getElementById("forgotPasswordButton")?.addEventListener("click", () => {
    resetPanel.hidden = !resetPanel.hidden;
    if (!resetPanel.hidden) document.getElementById("resetEmail")?.focus();
  });
  document.getElementById("requestResetButton")?.addEventListener("click", async () => {
    const email = document.getElementById("resetEmail")?.value.trim();
    resetMessage.textContent = "Sending reset code…";
    const response = await fetch("/api/password-reset/request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) });
    const result = parseJsonResponse(await response.text());
    resetMessage.textContent = result.message || "Unable to send reset code.";
    if (response.ok && result.challenge_id) { resetChallengeId = result.challenge_id; document.getElementById("resetConfirmFields").hidden = false; }
  });
  document.getElementById("confirmResetButton")?.addEventListener("click", async () => {
    const code = document.getElementById("resetCode")?.value.trim();
    const newPassword = document.getElementById("resetPassword")?.value;
    const response = await fetch("/api/password-reset/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challenge_id: resetChallengeId, code, password: newPassword }) });
    const result = parseJsonResponse(await response.text());
    resetMessage.textContent = result.message || "Unable to update password.";
    if (response.ok) { resetPanel.hidden = true; resetChallengeId = ""; password.value = ""; }
  });

  const savedUser = readSavedUser();
  const savedAccessToken = savedUser?.accessToken || savedUser?.access_token || sessionStorage.getItem("oxyguardAccessToken") || "";
  if (savedUser && (!requiresServerAuthenticatedSession() || savedAccessToken)) {
    currentUser = {
      ...savedUser,
      accessToken: savedAccessToken
    };
    sessionStorage.setItem("oxyguardUser", JSON.stringify(currentUser));
    showApp();
  } else {
    if (savedUser) {
      sessionStorage.removeItem("oxyguardUser");
      sessionStorage.removeItem("oxyguardAccessToken");
    }
    pendingMfaChallenge = null;
    setMfaLoginMode(false, { submit, mfaField, mfaCode, username, password, backButton, hint });
    username.focus();
  }

  backButton?.addEventListener("click", () => {
    pendingMfaChallenge = null;
    setMfaLoginMode(false, { submit, mfaField, mfaCode, username, password, backButton, hint });
    error.classList.remove("visible");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    error.classList.remove("visible");
    submit.disabled = true;

    try {
      if (pendingMfaChallenge) {
        const verifyResponse = await fetch("/api/mfa/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ challenge_id: pendingMfaChallenge.challenge_id, code: mfaCode.value.trim() })
        });
        const verifyResult = parseJsonResponse(await verifyResponse.text());
        if (!verifyResponse.ok || !verifyResult.ok) {
          throw new Error(verifyResult?.message || "Invalid authentication code.");
        }

        completeLogin(verifyResult);
        pendingMfaChallenge = null;
        setMfaLoginMode(false, { submit, mfaField, mfaCode, username, password, backButton, hint });
        return;
      }

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.value.trim(), password: password.value })
      });
      const responseText = await response.text();
      const result = parseJsonResponse(responseText);

      if (!response.ok || !result.ok) {
        throw new Error(result?.message || "Unable to sign in. Please try again.");
      }

      if (result.mfa_required) {
        if (result.delivery && result.delivery.sent === false) {
          throw new Error(result.delivery.message || "Authentication email could not be sent.");
        }
        pendingMfaChallenge = {
          challenge_id: result.challenge_id,
          expires_at: result.expires_at,
          username: username.value.trim()
        };
        setMfaLoginMode(true, { submit, mfaField, mfaCode, username, password, backButton, hint }, result.delivery);
        return;
      }

      completeLogin(result);
    } catch (authError) {
      error.textContent = authError.message;
      error.classList.add("visible");
    } finally {
      submit.disabled = false;
    }
  });
}

function completeLogin(result) {
  currentUser = {
    ...result.user,
    accessToken: result.access_token,
    loginAt: new Date().toISOString()
  };
  sessionStorage.setItem("oxyguardUser", JSON.stringify(currentUser));
  sessionStorage.setItem("oxyguardAccessToken", result.access_token);
  const password = document.getElementById("loginPassword");
  const code = document.getElementById("loginMfaCode");
  const error = document.getElementById("loginError");
  if (password) password.value = "";
  if (code) code.value = "";
  error?.classList.remove("visible");
  showApp();
}

function setMfaLoginMode(enabled, elements, delivery = {}) {
  const { submit, mfaField, mfaCode, username, password, backButton, hint } = elements;
  mfaField?.classList.toggle("visible", enabled);
  if (mfaField) mfaField.hidden = !enabled;
  backButton?.classList.toggle("visible", enabled);
  if (submit) submit.textContent = enabled ? "Verify Code" : "Login";
  if (username) username.disabled = enabled;
  if (password) password.disabled = enabled;
  if (hint) {
    const message = delivery?.message || `Authentication code sent to ${delivery?.masked_email || "your email"}.`;
    hint.textContent = enabled ? message : "Enter your OxyGuard username and password to continue.";
  }
  if (enabled) {
    if (mfaCode) mfaCode.value = "";
    mfaCode?.focus();
  } else {
    if (username) username.disabled = false;
    if (password) password.disabled = false;
    if (password) password.value = "";
    if (mfaCode) mfaCode.value = "";
    username?.focus();
  }
}

function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getLocalLoginUser(username, password) {
  const normalizedUsername = String(username || "").trim().toLowerCase();
  const users = {
    robertm: {
      password: "robert1",
      user_id: "AA002",
      username: "robertm",
      role: "admin",
      role_id: 1,
      label: "Administrator",
      email: "marsonrobert88@gmail.com",
      permissions: ["resolve_alert", "view_logs"]
    },
    admin: {
      password: "admin1",
      user_id: "AA008",
      username: "admin",
      role: "admin",
      role_id: 1,
      label: "Administrator",
      email: "facilities.admin@monamercy.local",
      permissions: ["resolve_alert", "view_logs"]
    },
    user1: {
      password: "password1",
      user_id: "AA004",
      username: "user1",
      role: "admin",
      role_id: 1,
      label: "Administrator",
      email: "robertmarson88@gmail.com",
      permissions: ["resolve_alert", "view_logs"]
    },
    martin: {
      password: "martin1",
      user_id: "AA001",
      username: "martin",
      role: "admin",
      role_id: 1,
      label: "Administrator",
      email: "robinsonmartin187@gmail.com",
      permissions: ["resolve_alert", "view_logs"]
    },
    martinm: {
      password: "martin1",
      user_id: "AA006",
      username: "martinm",
      role: "admin",
      role_id: 1,
      label: "Administrator",
      email: "robinsonmartin187@gmail.com",
      permissions: ["resolve_alert", "view_logs"]
    },
    supervisor: {
      password: "nurse1",
      user_id: "AA010",
      username: "supervisor",
      role: "nurse-supervisor",
      role_id: 4,
      label: "Nurse Manager",
      email: "nurse.supervisor@monamercy.local",
      permissions: ["resolve_alert", "view_logs"]
    },
    facilities: {
      password: "facilities1",
      user_id: "AA011",
      username: "facilities",
      role: "facilities-manager",
      role_id: 3,
      label: "Facilities Manager",
      email: "facilities.manager@monamercy.local",
      permissions: ["view_logs"]
    },
    nurse: {
      password: "nurse1",
      user_id: "AA012",
      username: "nurse",
      role: "nurse",
      role_id: 5,
      label: "Nurse",
      email: "ward.nurse@monamercy.local",
      permissions: ["resolve_alert", "view_logs"]
    },
    executive: {
      password: "executive1",
      user_id: "AA009",
      username: "executive",
      role: "cfo",
      role_id: 2,
      label: "CFO",
      email: "executive@monamercy.local",
      permissions: ["view_logs"]
    },
    vernon: {
      password: "vernon1",
      user_id: "AA003",
      username: "vernon",
      role: "admin",
      role_id: 1,
      label: "Administrator",
      email: "vernon.dacosta@gmail.com",
      permissions: ["resolve_alert", "view_logs"]
    },
    vernond: {
      password: "vernon1",
      user_id: "AA007",
      username: "vernond",
      role: "admin",
      role_id: 1,
      label: "Administrator",
      email: "vernon.dacosta@gmail.com",
      permissions: ["resolve_alert", "view_logs"]
    }
  };
  const user = users[normalizedUsername];
  if (!user || user.password !== password) return null;
  const { password: _password, ...safeUser } = user;
  return {
    ...safeUser,
    accessToken: "",
    loginAt: new Date().toISOString()
  };
}

function resetLoginStep() {
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginSubmit").textContent = "Login";
  document.getElementById("loginError").classList.remove("visible");
}

function showApp() {
  document.body.classList.remove("login-active");
  document.getElementById("appShell").removeAttribute("aria-hidden");
  applyRoleAccess();
  updateCurrentUserDisplay();
  updatePageTitle();
  if (!sessionStorage.getItem("oxyguardDashboardAccessLogged")) {
    sessionStorage.setItem("oxyguardDashboardAccessLogged", "true");
    void recordAuditEvent("Dashboard Access", "Dashboard session opened");
  }
  loadDatabaseAlerts();
  loadWardCardStatuses();
  void loadAnalyticsSnapshot();
}

async function logout() {
  if (!window.confirm("Are you sure you want to logout?")) return;
  await recordAuditEvent("User Logout", "Session ended by user", { endpoint: "/api/logout", keepalive: true });
  currentUser = null;
  permissionPreview = "admin";
  sessionStorage.removeItem("oxyguardUser");
  sessionStorage.removeItem("oxyguardAccessToken");
  sessionStorage.removeItem("oxyguardDashboardAccessLogged");
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
    // The dashboard, active incidents, patient alerts, and notifications all
    // read from this shared incident feed. Re-render them together so every
    // signed-in user sees the same current values after a refresh or update.
    if (!isEditingIncidentResponse()) renderAll();
    updateNotifications(activeAlerts());
  } catch {
    databaseAlertsLoaded = false;
  }
}

async function loadAnalyticsSnapshot() {
  if (!currentUser?.accessToken) return;
  try {
    const response = await fetch("/api/analytics", {
      cache: "no-store",
      headers: { authorization: `Bearer ${currentUser.accessToken}` }
    });
    if (!response.ok) return;
    const snapshot = await response.json();
    if (Array.isArray(snapshot.months) && snapshot.months.length) {
      analyticsMonths = snapshot.months;
      analyticsRangeEnd = analyticsMonths.length - 1;
    }
    if (Array.isArray(snapshot.wards) && snapshot.wards.length) {
      analyticsData = snapshot.wards.map(ward => ({
        ward: ward.ward,
        accent: analyticsAccentForWard(ward.ward),
        usage: ward.usage.map(Number),
        leakage: ward.leakage.map(Number)
      }));
    }
    if (Array.isArray(snapshot.rules) && snapshot.rules.length) analyticsRulePerformance = snapshot.rules;
    if (activeView === "analytics") renderAnalytics();
    if (activeView === "report") renderReport();
  } catch {
    // Keep the July 28 fallback snapshot available when the database is offline.
  }
}

function analyticsAccentForWard(wardName) {
  const value = String(wardName || "").toLowerCase();
  if (value.includes("a&e")) return colors.ae;
  if (value.includes("labour")) return colors.labour;
  if (value.includes("paediatric")) return colors.paediatric;
  if (value.includes("recovery")) return colors.recovery;
  return colors.nurse;
}

async function loadWardCardStatuses() {
  if (!currentUser?.accessToken) return;
  try {
    const response = await fetch("/api/ward-card-statuses", {
      cache: "no-store",
      headers: { authorization: `Bearer ${currentUser.accessToken}` }
    });
    if (!response.ok) throw new Error("Ward statuses could not be loaded.");
    const payload = await response.json();
    const rows = Array.isArray(payload?.statuses) ? payload.statuses : [];
    wardCardStatusOverrides = new Map(rows.map(row => [wardStatusKey(row.ward_key, row.asset_key), row.status]));
    if (activeView === "alert") renderRealTimeAlert();
  } catch {
    wardCardStatusOverrides = new Map();
  }
}

async function loadDatabaseConnectionStatus() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) throw new Error("Health check failed");

    const health = await response.json();
    const connected = health.database_status === "connected"
      || health.database === "supabase"
      || health.database === "connected"
      || (health.database_url_configured === true && health.database_error == null && health.status === "healthy");
    const usingDemoData = health.database_status === "local_demo"
      || (health.database === "demo" && health.database_url_configured !== true);
    const projectUrlOnly = health.database_status === "project_url_only";

    databaseConnectionStatus = {
      label: connected ? "Connected" : projectUrlOnly ? "DB URL Missing" : usingDemoData ? "Local Data Active" : "Not Connected",
      tone: connected ? "good" : usingDemoData ? "warn" : "bad"
    };
  } catch {
    databaseConnectionStatus = {
      label: "Not Connected",
      tone: "bad"
    };
  }

  renderSystemHealth();
}

function mapDatabaseAlertRow(alert, index) {
  const target = simulatorAlertTargets.get(String(alert.alert_id));
  const ward = getWardLabelFromDevice(alert.device_id, alert.ward_id);
  const priority = mapAlertPriority(alert.severity);
  const type = formatAlertType(alert.alert_type);
  const occurredAt = alert.timestamp || alert.created_at || new Date().toISOString();
  return {
    time: formatActivityTime(occurredAt),
    occurredAt,
    id: alert.alert_id,
    ward,
    type,
    priority,
    asset: alert.device_id || `Sensor ${index + 1}`,
    tankSerial: target?.serial || "",
    status: alert.status === "escalated" ? "Escalated" : alert.status === "acknowledged" ? "Acknowledged" : priority === "Critical" ? "Awaiting Response" : "Investigating",
    assigned: alert.supervisor_notified ? "Supervisor" : ["residual_gas_waste", "ghost_flow", "unauthorized_bed_usage", "device_offline", "sensor_fault"].includes(alert.alert_type) || priority === "Critical" ? "Facilities" : "Nurse Station",
    remainingVolume: alert.remaining_volume == null ? null : Number(alert.remaining_volume),
    unusedPercentage: alert.unused_percentage == null ? null : Number(alert.unused_percentage),
    estimatedOxygenWaste: alert.estimated_oxygen_waste == null ? null : Number(alert.estimated_oxygen_waste),
    estimatedFinancialLoss: alert.estimated_financial_loss == null ? null : Number(alert.estimated_financial_loss),
    potentialSavings: alert.potential_savings == null ? null : Number(alert.potential_savings),
    recommendedAction: alert.recommended_action || getRecommendedAlertAction(type),
    savedAction: alert.resolution_action || "",
    savedNote: alert.resolution_note || "",
    source: "database"
  };
}

function getWardLabelFromDevice(deviceId = "", wardId = "") {
  const wardNames = { X001: "Labour Ward", X002: "A&E Ward", X003: "Recovery Bay", X004: "Nurse Station", X005: "Paediatric Ward" };
  const mappedWard = wardNames[String(wardId || "").trim().toUpperCase()];
  if (mappedWard) return mappedWard;
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
    device_offline: "Device Offline",
    sensor_fault: "Sensor Fault",
    hardware_fault: "Sensor Fault",
    warning: "Flow Warning",
    leakage: "Leakage Detected",
    ghost_flow: "Ghost Flow",
    residual_gas_waste: "Residual Gas Waste",
    unauthorized_bed_usage: "Unauthorized Bed Usage"
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
    const allowed = access.allowedViews.includes(button.dataset.view);
    button.hidden = !allowed;
    button.classList.toggle("role-hidden", !allowed);
    button.setAttribute("aria-hidden", String(!allowed));
    button.tabIndex = allowed ? 0 : -1;
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
              <button type="button" data-permission-view="admin">Administrator</button>
              <button type="button" data-permission-view="facilities-manager">Facilities Manager</button>
              <button type="button" data-permission-view="nurse-supervisor">Nurse Manager</button>
              <button type="button" data-permission-view="maintenance">CFO</button>
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
  if (value.includes("nurse") && value.includes("manager")) return "nurse-supervisor";
  if (value.includes("facilities") && value.includes("manager")) return "facilities-manager";
  if (value.includes("executive")) return "maintenance";
  if (value === "cfo" || value.includes("chief-financial-officer")) return "maintenance";
  if (value.includes("maintenance")) return "maintenance";
  if (value === "admin" || value.includes("administrator") || value.includes("facilities-admin")) return "admin";
  if (value === "nurse" || value.includes("ward-nurse")) return "nurse";
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
  simulatorPresetInitialized = false;

  renderAll();
  loadNurseStationData();
  loadDatabaseConnectionStatus();
  timers.push(setInterval(updateClock, 1000));
  timers.push(setInterval(liveTick, 2000));
  timers.push(setInterval(loadNurseStationData, 2500));
  timers.push(setInterval(loadDatabaseConnectionStatus, 15000));
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
  timers.push(setInterval(() => {
    if (activeView === "order") renderOrderSummary();
  }, 5 * 60 * 1000));
  updateClock();
}

function renderAll() {
  if (isEditingIncidentResponse()) return;
  renderWards();
  updateMetrics();
  renderReport();
  renderGeneratedReport();
  renderReportLiveInsights();
  renderMonthlyUsageComparison();
  renderOrderSummary();
  if (activeView === "administration") renderAdministration();
  renderAnalytics();
  if (activeView === "simulator") renderSimulator();
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
  if (view === "simulator") renderSimulator();
  updatePageTitle();
}

function renderWards() {
  if (isEditingIncidentResponse()) return;
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
  const activeTankCount = activeTanks.length;
  const totalTankCount = 40;

  const kpiGrid = document.getElementById("alertKpiGrid");
  if (kpiGrid) {
    kpiGrid.innerHTML = [
      alertKpiCard("Critical Alerts", alertRows.filter(r => r.priority === "Critical").length, "Require immediate action", "danger", "View Alerts", "alert"),
      alertKpiCard("Active Alerts", alertRows.length, "Across all wards", "warning", "View All", "blank"),
      alertKpiCard("Total Tanks", totalTankCount, `${activeTankCount} tanks currently in use`, "blue", "", "blank"),
      alertKpiCard("System Status", `<span id="systemAlert">Monitoring</span>`, `<span id="alertText">All systems normal</span>`, "success", "", "blank"),
      alertKpiCard("Wastage Today", `<span id="wastage">${wastage}%</span>`, `<span id="wastageStatus">vs yesterday</span>`, "purple", "+ 8%", "blank")
    ].join("");
  }

  const incidentCount = document.getElementById("activeIncidentCount");
  if (incidentCount) incidentCount.textContent = String(alertRows.length);

  const incidentTarget = document.getElementById("alertIncidentsTable");
  if (incidentTarget && !isEditingIncidentResponse()) {
    const canRespond = canRespondToIncident();
    incidentTarget.innerHTML = alertRows.length ? `
      <div class="incident-list">
        ${alertRows.map(row => `
          <article class="active-incident-row">
            <div class="incident-alert-summary">
              <div><strong>${row.type}</strong><span>${row.time}</span></div>
              ${alertPill(row.priority)}
            </div>
            <div class="incident-location"><span>Location</span><strong>${row.ward}</strong><small>${row.asset}</small></div>
            <div class="incident-location"><span>Tank serial #</span><strong>${row.tankSerial || "Pending assignment"}</strong></div>
            <div class="incident-action">${formatAlertImpact(row)}</div>
            ${savedIncidentActionCell(row)}
            <div class="incident-state"><span>Current status</span>${alertStatus(row.status)}<small>Assigned to ${row.assigned}</small></div>
            ${canRespond ? incidentResponseControls(row) : ""}
          </article>
        `).join("")}
      </div>
    ` : `<div class="nurse-empty-state">No active incidents. New detections will appear here automatically.</div>`;
    bindIncidentActionControls(incidentTarget);
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
    wardTarget.querySelectorAll(".alert-ward-panel").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("select, button, a, input, label")) return;
        openAlertWardDialog(card.dataset.wardKey);
      });
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openAlertWardDialog(card.dataset.wardKey);
        }
      });
    });
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

function renderSimulator() {
  populateSimulatorWards();
  populateSimulatorTanks();
  applySimulatorPreset(false, !simulatorPresetInitialized);
  simulatorPresetInitialized = true;
  renderSimulatorLog();
}

function populateSimulatorWards() {
  const wardSelect = document.getElementById("simulatorWard");
  if (!wardSelect || wardSelect.options.length) return;
  wardSelect.innerHTML = wards.map(ward => `<option value="${ward.id}">${ward.name}</option>`).join("");
}

function populateSimulatorTanks() {
  const wardSelect = document.getElementById("simulatorWard");
  const tankSelect = document.getElementById("simulatorTank");
  if (!wardSelect || !tankSelect) return;
  const selectedWard = wards.find(ward => ward.id === wardSelect.value) || wards[0];
  const currentTankName = tankSelect.value;
  tankSelect.innerHTML = selectedWard.tanks.map(tankItem => `
    <option value="${tankItem.name}">${tankItem.name} - ${tankItem.station}</option>
  `).join("");
  if (selectedWard.tanks.some(tankItem => tankItem.name === currentTankName)) {
    tankSelect.value = currentTankName;
  }
  syncSimulatorTankLocation(true);
}

function syncSimulatorTankLocation(preserveCylinderStatus = true) {
  const tankItem = getSimulatorSelectedTank();
  const location = document.getElementById("simulatorLocation");
  if (tankItem && location) location.value = tankItem.station;
  const cylinderStatus = document.getElementById("simulatorCylinderStatus");
  if (tankItem && cylinderStatus && !preserveCylinderStatus) {
    cylinderStatus.value = tankItem.cylinderStatus || (tankItem.active ? "ACTIVE" : "EMPTY");
  }
  const serial = document.getElementById("simulatorTankSerial");
  if (tankItem && serial) serial.value = tankItem.serial || "Pending hospital validation";
}

function applySimulatorPreset(updateMessage = true, resetValues = true) {
  const alertType = document.getElementById("simulatorAlertType")?.value || "Ghost Flow";
  const prescribed = document.getElementById("simulatorPrescribedFlow");
  const live = document.getElementById("simulatorLiveReading");
  const patientStatus = document.getElementById("simulatorPatientStatus");
  const severity = document.getElementById("simulatorSeverity");
  const isResidualGas = alertType === "Residual Gas";
  const isGhostFlow = alertType === "Ghost Flow";
  const isUnauthorized = alertType === "Unauthorized Usage";
  const isDeviceOffline = alertType === "Device Offline";
  const isSensorFault = alertType === "Sensor Fault";
  const isCustomRule = isResidualGas || isGhostFlow || isUnauthorized || isDeviceOffline || isSensorFault;
  ["simulatorPatientStatusField", "simulatorPrescribedFlowField", "simulatorLiveReadingField"].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.hidden = isCustomRule;
  });
  document.getElementById("simulatorRuleFlowRateField").hidden = !(isGhostFlow || isUnauthorized);
  document.getElementById("simulatorDurationField").hidden = !(isGhostFlow || isUnauthorized || isDeviceOffline);
  document.getElementById("simulatorBreathingVarianceField").hidden = !isGhostFlow;
  document.getElementById("simulatorEmrStatusField").hidden = !isUnauthorized;
  ["simulatorCylinderCapacityField", "simulatorConsumedVolumeField"].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.hidden = !isResidualGas;
  });
  const serialField = document.getElementById("simulatorTankSerialField");
  if (serialField) serialField.hidden = !isResidualGas;
  const presets = {
    "Ghost Flow": { prescribed: 0, live: 1.2, patient: "OFF", severity: "Medium" },
    "Unauthorized Usage": { prescribed: 0, live: 2, patient: "OFF", severity: "High" },
    "Residual Gas": { prescribed: 0, live: 0.2, patient: "OFF", severity: "Medium" },
    "Device Offline": { prescribed: 0, live: 0, patient: "OFF", severity: "Critical" },
    "Sensor Fault": { prescribed: 0, live: 0, patient: "OFF", severity: "High" },
    "Normal": { prescribed: 3, live: 3.4, patient: "ON", severity: "Low" }
  };
  if (resetValues) {
    const preset = presets[alertType] || presets["Ghost Flow"];
    if (prescribed) prescribed.value = preset.prescribed;
    if (live) live.value = preset.live;
    if (patientStatus) patientStatus.value = preset.patient;
    if (severity) severity.value = preset.severity;
    if (isResidualGas) {
      document.getElementById("simulatorCylinderStatus").value = "REPLACED";
      document.getElementById("simulatorCylinderCapacity").value = 1200;
      document.getElementById("simulatorConsumedVolume").value = 1092;
    }
    if (isGhostFlow) {
      document.getElementById("simulatorRuleFlowRate").value = 1.2;
      document.getElementById("simulatorBreathingVariance").value = 0.005;
      document.getElementById("simulatorDuration").value = 11;
    }
    if (isUnauthorized) {
      document.getElementById("simulatorRuleFlowRate").value = 2;
      document.getElementById("simulatorDuration").value = 11;
      document.getElementById("simulatorEmrStatus").value = "EMPTY";
    }
    if (isDeviceOffline) document.getElementById("simulatorDuration").value = 10;
  }
  updateSimulatorRuleConstraints(alertType);
  renderSimulatorRulePreview();
  updateSimulatorCriteriaFeedback(alertType);
  if (updateMessage) updateSimulatorApiStatus(`${alertType} rule loaded. Review and send when ready.`, "ready");
}

function renderSimulatorRulePreview() {
  const target = document.getElementById("simulatorRulePreview");
  const status = document.getElementById("simulatorRuleStatus");
  if (!target) return;
  const alertType = document.getElementById("simulatorAlertType")?.value || "Ghost Flow";
  updateSimulatorRuleConstraints(alertType);
  const prescribed = Number(document.getElementById("simulatorPrescribedFlow")?.value || 0);
  const live = Number(document.getElementById("simulatorLiveReading")?.value || 0);
  const patientStatus = document.getElementById("simulatorPatientStatus")?.value || "OFF";
  const cylinderStatus = document.getElementById("simulatorCylinderStatus")?.value || "REPLACED";
  const cylinderCapacity = Number(document.getElementById("simulatorCylinderCapacity")?.value || 0);
  const consumedVolume = Number(document.getElementById("simulatorConsumedVolume")?.value || 0);
  const ruleFlowRate = Number(document.getElementById("simulatorRuleFlowRate")?.value || 0);
  const breathingVariance = Number(document.getElementById("simulatorBreathingVariance")?.value || 0);
  const duration = Number(document.getElementById("simulatorDuration")?.value || 0);
  const emrStatus = document.getElementById("simulatorEmrStatus")?.value || "EMPTY";
  const flowStatus = evaluatePatientFlowStatus(Math.max(0.1, prescribed), live);
  const variance = prescribed > 0 ? flowStatus.variance : 0;
  const ruleText = getSimulatorRuleText(alertType, patientStatus, prescribed, live, variance);
  if (status) status.textContent = `${alertType} selected`;
  const readingSummary = alertType === "Residual Gas"
    ? `<div class="simulator-reading-grid">
        <span><small>Status</small><strong>${cylinderStatus}</strong></span>
        <span><small>Capacity</small><strong>${cylinderCapacity.toLocaleString()} L</strong></span>
        <span><small>Consumed</small><strong>${consumedVolume.toLocaleString()} L</strong></span>
        <span><small>Utilization</small><strong>${cylinderCapacity > 0 ? `${((consumedVolume / cylinderCapacity) * 100).toFixed(1)}%` : "Invalid"}</strong></span>
      </div>`
    : alertType === "Ghost Flow"
      ? `<div class="simulator-reading-grid">
          <span><small>Flow Rate</small><strong>${formatFlow(ruleFlowRate)}</strong></span>
          <span><small>Breathing Variance</small><strong>${breathingVariance.toFixed(3)}</strong></span>
          <span><small>Duration</small><strong>${duration} min</strong></span>
          <span><small>Severity</small><strong>${ghostFlowSeverityFromDuration(duration)}</strong></span>
        </div>`
    : alertType === "Unauthorized Usage"
      ? `<div class="simulator-reading-grid">
          <span><small>EMR Status</small><strong>${emrStatus}</strong></span>
          <span><small>Flow Rate</small><strong>${formatFlow(ruleFlowRate)}</strong></span>
          <span><small>Duration</small><strong>${duration} min</strong></span>
          <span><small>Severity</small><strong>High</strong></span>
        </div>`
    : alertType === "Device Offline"
      ? `<div class="simulator-reading-grid">
          <span><small>Last Telemetry</small><strong>${duration} min ago</strong></span>
          <span><small>Required Gap</small><strong>10 min</strong></span>
          <span><small>Severity</small><strong>Critical</strong></span>
          <span><small>Status</small><strong>Active</strong></span>
        </div>`
    : alertType === "Sensor Fault"
      ? `<div class="simulator-reading-grid">
          <span><small>Operational Status</small><strong>hardware_fault</strong></span>
          <span><small>Severity</small><strong>High</strong></span>
          <span><small>Status</small><strong>Active</strong></span>
          <span><small>Action</small><strong>Inspect sensor</strong></span>
        </div>`
    : `<div class="simulator-reading-grid">
        <span><small>Patient</small><strong>${patientStatus}</strong></span>
        <span><small>Set Value</small><strong>${formatFlow(prescribed)}</strong></span>
        <span><small>Live Reading</small><strong>${formatFlow(live)}</strong></span>
        <span><small>Variance</small><strong>${prescribed > 0 ? formatVariance(variance) : "N/A"}</strong></span>
      </div>`;
  target.innerHTML = `
    <div class="simulator-rule-card ${alertType === "Normal" ? "normal" : "alert"}">
      <span>${alertType}</span>
      <strong>${ruleText.headline}</strong>
      <p>${ruleText.detail}</p>
    </div>
    ${readingSummary}
  `;
}

function getSimulatorRuleText(alertType, patientStatus, prescribed, live, variance) {
  const rules = {
    "Ghost Flow": {
      headline: "Flow > 0.5 LPM with breathing variance < 0.01",
      detail: "Set flow rate, breathing variance, and duration manually. Duration must be at least 11 minutes. Recommended Action: Verify patient occupancy and close oxygen supply."
    },
    "Unauthorized Usage": {
      headline: "Inactive EMR bed consuming at least 2.0 LPM",
      detail: "Select EMPTY, DISCHARGED, TRANSFERRED, or UNASSIGNED and set a duration of at least 11 minutes. Recommended Action: Verify patient assignment and investigate oxygen usage."
    },
    "Residual Gas": {
      headline: "REPLACED cylinder with utilization above 90%",
      detail: "Set cylinder status, capacity, and consumed volume manually. The alert triggers only when status is REPLACED and consumption is greater than 90%."
    },
    "Device Offline": {
      headline: "No telemetry received for at least 10 minutes",
      detail: "Severity: Critical. Recommended Action: Inspect device power and network connection."
    },
    "Sensor Fault": {
      headline: "Sensor reading is invalid or missing",
      detail: "Operational status is hardware_fault. Severity: High. Recommended Action: Inspect, calibrate or replace sensor."
    },
    "Normal": {
      headline: "Reading is equal to SetValue or 1% to 28% above it",
      detail: `Patient ${patientStatus}; prescribed ${formatFlow(prescribed)}; live ${formatFlow(live)}.`
    }
  };
  return rules[alertType] || rules["Ghost Flow"];
}

function ghostFlowSeverityFromDuration(durationMinutes) {
  const minutes = Number(durationMinutes) || 0;
  if (minutes > 29) return "Critical";
  if (minutes >= 21) return "High";
  if (minutes >= 11) return "Medium";
  return "Below threshold";
}

async function submitSimulatorEvent(event) {
  event.preventDefault();
  const tankItem = getSimulatorSelectedTank();
  const ward = getSimulatorSelectedWard();
  if (!tankItem || !ward) return;

  const alertType = document.getElementById("simulatorAlertType").value;
  const prescribed = Number(document.getElementById("simulatorPrescribedFlow").value || 0);
  const live = Number(document.getElementById("simulatorLiveReading").value || 0);
  const patientStatus = document.getElementById("simulatorPatientStatus").value;
  let severity = document.getElementById("simulatorSeverity").value;
  const cylinderStatus = document.getElementById("simulatorCylinderStatus")?.value || "REPLACED";
  const cylinderCapacity = Number(document.getElementById("simulatorCylinderCapacity")?.value || 0);
  const consumedVolume = Number(document.getElementById("simulatorConsumedVolume")?.value || 0);
  const ruleFlowRate = Number(document.getElementById("simulatorRuleFlowRate")?.value || 0);
  const breathingVariance = Number(document.getElementById("simulatorBreathingVariance")?.value || 0);
  const duration = Number(document.getElementById("simulatorDuration")?.value || 0);
  const emrStatus = document.getElementById("simulatorEmrStatus")?.value || "EMPTY";
  const tankSerial = document.getElementById("simulatorTankSerial")?.value.trim() || "";
  const location = document.getElementById("simulatorLocation").value.trim() || tankItem.station;
  const createdAt = new Date().toISOString();
  const sendButton = document.getElementById("simulatorSendButton");

  if (alertType === "Ghost Flow") {
    severity = ghostFlowSeverityFromDuration(duration);
    document.getElementById("simulatorSeverity").value = severity;
  }

  if (alertType === "Residual Gas") {
    if (!tankSerial) {
      updateSimulatorApiStatus("Enter a tank serial number.", "warn");
      return;
    }
    if (cylinderCapacity <= 0 || consumedVolume < 0) {
      updateSimulatorApiStatus("Enter a valid cylinder capacity and consumed volume.", "warn");
      return;
    }
    if (!["EMPTY", "REPLACED"].includes(cylinderStatus)) {
      updateSimulatorApiStatus("Residual Gas Cylinder Status must be EMPTY or REPLACED.", "warn");
      return;
    }
    if (consumedVolume <= cylinderCapacity * 0.9) {
      updateSimulatorApiStatus("Consumed volume must be greater than 90% of cylinder capacity.", "warn");
      return;
    }
  }
  if (alertType === "Ghost Flow") {
    if (ruleFlowRate <= 0.5) {
      updateSimulatorApiStatus("Ghost Flow requires a flow rate greater than 0.5 LPM.", "warn");
      return;
    }
    if (breathingVariance < 0 || breathingVariance >= 0.01) {
      updateSimulatorApiStatus("Ghost Flow requires breathing variance below 0.01.", "warn");
      return;
    }
    if (duration < 11) {
      updateSimulatorApiStatus("Ghost Flow duration must be at least 11 minutes.", "warn");
      return;
    }
  }
  if (alertType === "Unauthorized Usage") {
    if (ruleFlowRate < 2) {
      updateSimulatorApiStatus("Unauthorized Usage requires a flow rate of at least 2.0 LPM.", "warn");
      return;
    }
    if (!["EMPTY", "DISCHARGED", "TRANSFERRED", "UNASSIGNED"].includes(emrStatus)) {
      updateSimulatorApiStatus("Select a valid inactive EMR status.", "warn");
      return;
    }
    if (duration < 11) {
      updateSimulatorApiStatus("Unauthorized Usage duration must be at least 11 minutes.", "warn");
      return;
    }
  }
  if (alertType === "Device Offline" && duration < 10) {
    updateSimulatorApiStatus("Device Offline requires at least 10 minutes without telemetry.", "warn");
    return;
  }

  const effectiveLive = ["Ghost Flow", "Unauthorized Usage"].includes(alertType) ? ruleFlowRate : live;

  if (alertType === "Residual Gas") tankItem.serial = tankSerial;

  const effectiveCapacity = cylinderCapacity > 0 ? cylinderCapacity : tankItem.maxVolume;
  const effectiveConsumed = cylinderStatus === "EMPTY"
    ? effectiveCapacity
    : cylinderStatus === "ACTIVE"
      ? Math.max(0, effectiveCapacity - tankItem.volumeRemaining)
      : Math.min(effectiveCapacity, Math.max(0, consumedVolume));

  applySimulatorEventToTank(tankItem, {
    alertType,
    prescribed,
    live: effectiveLive,
    patientStatus,
    severity,
    location,
    cylinderStatus,
    cylinderCapacity: effectiveCapacity,
    consumedVolume: effectiveConsumed
  });
  if (sendButton) {
    sendButton.disabled = true;
    sendButton.textContent = ["Ghost Flow", "Unauthorized Usage"].includes(alertType) ? "Sending 4 Readings..." : "Sending...";
  }
  updateSimulatorApiStatus(`Running ${alertType} rule against the telemetry API...`, "ready");
  const telemetryResult = await postSimulatorTelemetry(ward, tankItem, alertType, effectiveLive, createdAt, {
    cylinderStatus,
    cylinderCapacity: effectiveCapacity,
    consumedVolume: effectiveConsumed,
    breathingVariance,
    duration,
    emrStatus
  });
  if (sendButton) {
    sendButton.disabled = false;
    sendButton.textContent = "Send Test Reading";
  }
  simulatorEvents.unshift({
    time: formatActivityTime(createdAt),
    ward: ward.name,
    tank: tankItem.name,
    tankSerial: tankItem.serial || "",
    location,
    alertType,
    severity,
    cylinderStatus,
    live: effectiveLive,
    prescribed,
    apiStatus: telemetryResult.ok ? "API logged" : "Screen only"
  });
  simulatorEvents = simulatorEvents.slice(0, 8);

  if (telemetryResult.ok && getSimulatorExpectedAlertType(alertType)) {
    void recordAuditEvent("Simulator Alert Sent", `${alertType} sent for ${ward.name} / ${tankItem.name}`);
  }
  if (telemetryResult.ok) {
    void recordAuditEvent("Cylinder Status Updated", `${ward.name} / ${tankItem.name}: ${cylinderStatus}`);
  }

  if (telemetryResult.alerts.length) {
    telemetryResult.alerts.forEach(alert => {
      if (Number.isFinite(Number(alert?.alert_id))) {
        simulatorAlertTargets.set(String(alert.alert_id), { wardId: ward.id, tankName: tankItem.name, serial: tankItem.serial || "" });
      }
    });
    const receivedRows = telemetryResult.alerts.map(mapDatabaseAlertRow);
    const receivedIds = new Set(receivedRows.map(row => String(row.id || row.asset)));
    databaseAlertRows = [
      ...receivedRows,
      ...databaseAlertRows.filter(row => !receivedIds.has(String(row.id || row.asset)))
    ];
    databaseAlertsLoaded = true;
  }

  updateSimulatorApiStatus(
    telemetryResult.ok
      ? `${alertType} verified: ${telemetryResult.triggeredAlerts.join(", ") || "no alert expected"}.`
      : `${alertType} shown on dashboard. API response: ${telemetryResult.message || "Telemetry was not accepted."}`,
    telemetryResult.ok ? "success" : "warn"
  );
  if (telemetryResult.ok) void loadDatabaseAlerts();
  renderAll();
  renderSimulator();
}

function applySimulatorEventToTank(tankItem, simulation) {
  tankItem.cylinderStatus = simulation.cylinderStatus || tankItem.cylinderStatus || "ACTIVE";
  tankItem.maxVolume = Number(simulation.cylinderCapacity) || tankItem.maxVolume;
  tankItem.volumeRemaining = Math.max(0, tankItem.maxVolume - (Number(simulation.consumedVolume) || 0));
  tankItem.active = simulation.alertType !== "Device Offline";
  tankItem.occupied = simulation.patientStatus === "ON";
  tankItem.flowRate = simulation.live;
  tankItem.stationFlowRate = simulation.live;
  tankItem.pressure = simulation.alertType === "Sensor Fault" ? 0 : clamp(tankItem.pressure || 48, 35, 60);
  tankItem.alertType = simulation.alertType === "Unauthorized Usage" ? "Unauthorized Bed Usage" : simulation.alertType;
  tankItem.alertMessage = simulation.alertType === "Normal" ? "" : simulation.alertType;
  tankItem.highFlowAlert = simulation.alertType === "Ghost Flow" || simulation.alertType === "High Flow";
  tankItem.leakageAlert = !["Normal", "High Flow"].includes(simulation.alertType) && simulation.alertType !== "Device Offline";
  tankItem.fixedFlow = simulation.alertType !== "Normal";
  if (simulation.alertType === "Device Offline") {
    tankItem.active = false;
    tankItem.flowRate = 0;
    tankItem.stationFlowRate = 0;
    tankItem.alertMessage = "Device Offline";
  }
  if (simulation.alertType === "Normal") {
    tankItem.active = true;
    tankItem.leakageAlert = false;
    tankItem.highFlowAlert = false;
    tankItem.fixedFlow = false;
  } else {
    wastage = Math.max(wastage, simulation.severity === "Critical" ? 18 : simulation.severity === "High" ? 14 : 9);
  }
  if (tankItem.cylinderStatus === "EMPTY") {
    tankItem.active = false;
    tankItem.volumeRemaining = 0;
    tankItem.flowRate = 0;
    tankItem.stationFlowRate = 0;
  } else if (tankItem.cylinderStatus === "REPLACED") {
    tankItem.active = false;
  } else if (tankItem.cylinderStatus === "ACTIVE" && simulation.alertType !== "Device Offline") {
    tankItem.active = true;
  }
}

async function postSimulatorTelemetry(ward, tankItem, alertType, live, createdAt, cylinder = {}) {
  simulatorDeviceSequence = (simulatorDeviceSequence + 1) % 1000;
  const deviceId = getSimulatorRunDeviceId(ward, simulatorDeviceSequence);
  const readings = buildSimulatorTelemetryReadings(ward, deviceId, alertType, live, createdAt, cylinder);
  const triggeredAlerts = new Set();
  const generatedAlerts = [];
  try {
    for (const [index, payload] of readings.entries()) {
      updateSimulatorApiStatus(`Sending ${alertType} reading ${index + 1} of ${readings.length}...`, "ready");
      const response = await fetch("/api/v1/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await readSimulatorApiResponse(response);
      if (!response.ok) {
        return {
          ok: false,
          triggeredAlerts: [...triggeredAlerts],
          alerts: generatedAlerts,
          message: data?.message || data?.error || formatSimulatorErrors(data?.errors) || `API returned ${response.status}`
        };
      }
      const alerts = Array.isArray(data?.alerts) ? data.alerts : data?.alert ? [data.alert] : [];
      alerts.forEach(alert => {
        if (alert?.alert_type) {
          triggeredAlerts.add(alert.alert_type);
          generatedAlerts.push(alert);
        }
      });
    }
    const expectedAlert = getSimulatorExpectedAlertType(alertType);
    const verified = !expectedAlert || triggeredAlerts.has(expectedAlert);
    return {
      ok: verified,
      triggeredAlerts: [...triggeredAlerts],
      alerts: generatedAlerts,
      message: verified ? "Rule verified." : `Expected ${expectedAlert}, received ${[...triggeredAlerts].join(", ") || "no alert"}.`
    };
  } catch (error) {
    return { ok: false, triggeredAlerts: [...triggeredAlerts], alerts: generatedAlerts, message: error?.message || "Telemetry API is not reachable." };
  }
}

function updateSimulatorRuleConstraints(alertType) {
  const flowRate = document.getElementById("simulatorRuleFlowRate");
  const breathingVariance = document.getElementById("simulatorBreathingVariance");
  const duration = document.getElementById("simulatorDuration");
  const capacity = document.getElementById("simulatorCylinderCapacity");
  const consumed = document.getElementById("simulatorConsumedVolume");

  if (flowRate) {
    flowRate.min = alertType === "Unauthorized Usage" ? "2" : "0.5";
    flowRate.max = "100";
    flowRate.step = "0.1";
  }
  if (breathingVariance) {
    breathingVariance.min = "0";
    breathingVariance.max = "0.009";
    breathingVariance.step = "0.001";
  }
  if (duration) {
    duration.min = alertType === "Device Offline" ? "10" : "11";
    duration.step = "0.1";
  }
  const cylinderCapacity = Number(capacity?.value || 0);
  if (consumed && cylinderCapacity > 0) {
    consumed.min = String(Number((cylinderCapacity * 0.9 + 0.01).toFixed(2)));
    consumed.max = String(cylinderCapacity);
    consumed.step = "0.01";
  }
}

function updateSimulatorCriteriaFeedback(selectedAlertType) {
  const alertType = selectedAlertType || document.getElementById("simulatorAlertType")?.value || "";
  const outstanding = [];
  const setValidity = (id, message) => {
    const input = document.getElementById(id);
    if (input) input.setCustomValidity(message || "");
  };
  ["simulatorRuleFlowRate", "simulatorBreathingVariance", "simulatorDuration", "simulatorCylinderStatus", "simulatorCylinderCapacity", "simulatorConsumedVolume", "simulatorEmrStatus"].forEach(id => setValidity(id, ""));

  const flowRate = Number(document.getElementById("simulatorRuleFlowRate")?.value);
  const breathingVariance = Number(document.getElementById("simulatorBreathingVariance")?.value);
  const duration = Number(document.getElementById("simulatorDuration")?.value);
  if (alertType === "Ghost Flow") {
    if (!Number.isFinite(flowRate) || flowRate <= 0.5) {
      const message = "Flow rate must be greater than 0.5 LPM.";
      outstanding.push(message);
      setValidity("simulatorRuleFlowRate", message);
    }
    if (!Number.isFinite(breathingVariance) || breathingVariance < 0 || breathingVariance >= 0.01) {
      const message = "Breathing variance must be between 0 and 0.009.";
      outstanding.push(message);
      setValidity("simulatorBreathingVariance", message);
    }
    if (!Number.isFinite(duration) || duration < 11) {
      const message = "Duration must be at least 11 minutes.";
      outstanding.push(message);
      setValidity("simulatorDuration", message);
    } else {
      const severity = ghostFlowSeverityFromDuration(duration);
      const severitySelect = document.getElementById("simulatorSeverity");
      if (severitySelect && severity !== "Below threshold") severitySelect.value = severity;
    }
  } else if (alertType === "Unauthorized Usage") {
    const emrStatus = document.getElementById("simulatorEmrStatus")?.value || "";
    if (!Number.isFinite(flowRate) || flowRate < 2) {
      const message = "Flow rate must be at least 2.0 LPM.";
      outstanding.push(message);
      setValidity("simulatorRuleFlowRate", message);
    }
    if (!["EMPTY", "DISCHARGED", "TRANSFERRED", "UNASSIGNED"].includes(emrStatus)) {
      const message = "EMR status must be EMPTY, DISCHARGED, TRANSFERRED, or UNASSIGNED.";
      outstanding.push(message);
      setValidity("simulatorEmrStatus", message);
    }
    if (!Number.isFinite(duration) || duration < 11) {
      const message = "Duration must be at least 11 minutes.";
      outstanding.push(message);
      setValidity("simulatorDuration", message);
    }
  } else if (alertType === "Residual Gas") {
    const cylinderStatus = document.getElementById("simulatorCylinderStatus")?.value || "";
    const capacity = Number(document.getElementById("simulatorCylinderCapacity")?.value);
    const consumed = Number(document.getElementById("simulatorConsumedVolume")?.value);
    if (!["EMPTY", "REPLACED"].includes(cylinderStatus)) {
      const message = "Cylinder status must be EMPTY or REPLACED.";
      outstanding.push(message);
      setValidity("simulatorCylinderStatus", message);
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      const message = "Cylinder capacity must be greater than 0.";
      outstanding.push(message);
      setValidity("simulatorCylinderCapacity", message);
    }
    if (!Number.isFinite(consumed) || !Number.isFinite(capacity) || consumed <= capacity * 0.9) {
      const message = "Consumed volume must be greater than 90% of cylinder capacity.";
      outstanding.push(message);
      setValidity("simulatorConsumedVolume", message);
    } else if (consumed > capacity) {
      const message = "Consumed volume cannot exceed cylinder capacity.";
      outstanding.push(message);
      setValidity("simulatorConsumedVolume", message);
    }
  } else if (alertType === "Device Offline" && (!Number.isFinite(duration) || duration < 10)) {
    const message = "No-telemetry duration must be at least 10 minutes.";
    outstanding.push(message);
    setValidity("simulatorDuration", message);
  }

  updateSimulatorApiStatus(
    outstanding.length
      ? `Alert criteria not met: ${outstanding.join(" ")}`
      : "All alert criteria met. Ready to send.",
    outstanding.length ? "warn" : "success"
  );
  return outstanding;
}

function buildSimulatorTelemetryReadings(ward, deviceId, alertType, live, createdAt, cylinder = {}) {
  const endTime = new Date(createdAt);
  const requestedDuration = Number(cylinder.duration);
  const minimumDuration = alertType === "Device Offline" ? 10 : 11;
  const duration = Number.isFinite(requestedDuration) && requestedDuration >= minimumDuration ? requestedDuration : minimumDuration;
  const offsets = [duration, Math.max(0, duration - 0.5), Math.max(0, duration - 0.1), 0];
  const durationRule = ["Ghost Flow", "Unauthorized Usage"].includes(alertType);
  const timestamps = durationRule
    ? offsets.map(minutes => new Date(endTime.getTime() - minutes * 60000).toISOString())
    : alertType === "Device Offline"
      ? [new Date(endTime.getTime() - (duration + 2) * 60000).toISOString()]
      : [createdAt];
  return timestamps.map(timestamp => {
    const payload = {
      device_id: deviceId,
      ward_id: getSimulatorWardId(ward),
      flow_rate: Number(live),
      operational_status: getSimulatorOperationalStatus(alertType, live),
      timestamp,
      cylinder_capacity: Number(cylinder.cylinderCapacity),
      consumed_volume: Number(cylinder.consumedVolume),
      cylinder_status: cylinder.cylinderStatus || "ACTIVE"
    };
    if (alertType === "Residual Gas") {
      Object.assign(payload, {
        breathing_variance: 0.03,
        emr_status: "OCCUPIED"
      });
    } else if (alertType === "Ghost Flow") {
      Object.assign(payload, { breathing_variance: Number(cylinder.breathingVariance), emr_status: "OCCUPIED" });
    } else if (alertType === "Unauthorized Usage") {
      Object.assign(payload, { breathing_variance: 0.05, emr_status: cylinder.emrStatus });
    }
    return payload;
  });
}

function getSimulatorExpectedAlertType(alertType) {
  const expected = {
    "Residual Gas": "residual_gas_waste",
    "Ghost Flow": "ghost_flow",
    "Unauthorized Usage": "unauthorized_bed_usage"
    , "Device Offline": "device_offline"
    , "Sensor Fault": "sensor_fault"
  };
  return expected[alertType] || "";
}

function getSimulatorRunDeviceId(ward, suffix) {
  const prefixes = { labour: "LB", ae: "AE", paediatric: "PD", recovery: "RC", nurse: "NS" };
  const prefix = prefixes[ward.id] || "SM";
  return `${prefix}${String(suffix).padStart(3, "0")}`;
}

async function readSimulatorApiResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 120) };
  }
}

function formatSimulatorErrors(errors) {
  if (!Array.isArray(errors) || !errors.length) return "";
  return errors.join("; ");
}

function getSimulatorSelectedWard() {
  const wardId = document.getElementById("simulatorWard")?.value;
  return wards.find(ward => ward.id === wardId) || wards[0];
}

function getSimulatorSelectedTank() {
  const ward = getSimulatorSelectedWard();
  const tankName = document.getElementById("simulatorTank")?.value;
  return ward?.tanks.find(tankItem => tankItem.name === tankName) || ward?.tanks[0];
}

function getSimulatorWardId(ward) {
  const ids = { labour: "X001", ae: "X002", paediatric: "X005", recovery: "X003", nurse: "X004" };
  return ids[ward.id] || ward.id.toUpperCase().slice(0, 4);
}

function getSimulatorDeviceId(ward, tankItem) {
  const ids = {
    "Tank A1": "TK007",
    "Tank A2": "TK008",
    "Tank A3": "AE003",
    "Tank B1": "TK001",
    "Tank B2": "TK002",
    "Tank B3": "TK003",
    "Tank C1": "TK004",
    "Tank C2": "TK005",
    "Tank C3": "TK006",
    "Tank R1": "RC001",
    "Tank R2": "RC002",
    "Nurse Station": "NS001"
  };
  return ids[tankItem.name] || `${ward.id.slice(0, 2).toUpperCase().padEnd(2, "X")}001`;
}

function getSimulatorOperationalStatus(alertType, live) {
  if (alertType === "Sensor Fault") return "hardware_fault";
  if (alertType === "Device Offline") return "normal";
  if (["Ghost Flow", "Unauthorized Usage", "Residual Gas"].includes(alertType)) return "normal";
  if (alertType === "High Flow" || live >= 30) return "critical";
  if (alertType === "Low Flow") return "warning";
  return "normal";
}

function updateSimulatorApiStatus(message, tone = "ready") {
  const status = document.getElementById("simulatorApiStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function renderSimulatorLog() {
  const target = document.getElementById("simulatorLog");
  const count = document.getElementById("simulatorLogCount");
  if (!target) return;
  if (count) count.textContent = `${simulatorEvents.length} event${simulatorEvents.length === 1 ? "" : "s"}`;
  target.innerHTML = simulatorEvents.length
    ? simulatorEvents.map(item => `
      <div class="simulator-log-row">
        <time>${item.time}</time>
        <div>
          <strong>${item.alertType}</strong>
          <span>${item.ward} | ${item.tank} | ${item.location} | Cylinder ${item.cylinderStatus || "ACTIVE"}</span>
        </div>
        <b class="${item.severity.toLowerCase()}">${item.severity}</b>
        <small>${item.apiStatus}</small>
      </div>
    `).join("")
    : `<div class="simulator-empty">No simulator events yet. Select a rule and send a test reading.</div>`;
}

function alertKpiCard(label, value, detail, tone, action = "", iconMode = "text") {
  const iconLabels = { danger: "!", warning: "A", blue: "O2", success: "~", purple: "%"};
  const iconClass = iconMode === "alert" ? " kpi-icon alert" : iconMode === "blank" ? " blank" : "";
  const iconText = iconMode === "blank" || iconMode === "alert" ? "" : iconLabels[tone] || "O2";
  return `
    <article class="alert-kpi ${tone}">
      <div class="alert-kpi-icon${iconClass}">${iconText}</div>
      <div class="alert-kpi-copy">
        <span>${label}</span>
        <strong>${value}</strong>
        <small>${detail}</small>
      </div>
      ${action ? `<button type="button">${action}</button>` : ""}
    </article>
  `;
}

function getAlertIncidentRows(sourceRows = databaseAlertRows) {
  return sourceRows
    .map(row => ({ ...row, type: normalizeWardIncidentStatus(row.type) }))
    .filter(row => row.type)
    .filter((row, index, rows) => rows.findIndex(candidate => (
    candidate.type === row.type && candidate.ward === row.ward && candidate.asset === row.asset
  )) === index).slice(0, 6);
}

function requiresServerAuthenticatedSession() {
  const hostname = String(window.location.hostname || "").toLowerCase();
  return window.location.protocol === "https:"
    || (window.location.protocol === "http:" && !["localhost", "127.0.0.1"].includes(hostname));
}

function canRespondToIncident() {
  // A dashboard permission preview must not grant operational alert controls.
  // These actions require an actual Nurse Manager session from the server.
  const actualRole = normalizePermissionRole(currentUser?.role || currentUser?.label);
  return actualRole === "nurse-supervisor"
    && Boolean(currentUser?.permissions?.includes("resolve_alert"));
}

function isEditingIncidentResponse() {
  return Boolean(activeIncidentResponseEditorId)
    || document.activeElement?.classList?.contains("incident-response-input")
    || document.activeElement?.classList?.contains("incident-action-select");
}

function protectIncidentResponseControl(control) {
  const editorId = control.closest("[data-incident-form]")?.dataset.incidentForm || "";
  const activate = () => { activeIncidentResponseEditorId = editorId; };
  control.addEventListener("pointerdown", activate);
  control.addEventListener("focus", activate);
  control.addEventListener("blur", () => {
    window.setTimeout(() => {
      const focusedEditorId = document.activeElement?.closest?.("[data-incident-form]")?.dataset.incidentForm || "";
      if (focusedEditorId !== editorId) activeIncidentResponseEditorId = "";
    }, 250);
  });
}

function protectIncidentResponseInput(input) {
  const editorId = input.closest("[data-incident-form]")?.dataset.incidentForm || "";
  protectIncidentResponseControl(input);
  input.addEventListener("input", () => {
    activeIncidentResponseEditorId = editorId;
    incidentResponseDrafts.set(editorId, input.value);
  });
}

function incidentResponseControls(row) {
  if (!Number.isFinite(Number(row.id))) return '<span class="incident-response-note">Syncing</span>';
  const savedAction = String(row.savedAction || "");
  const savedNote = String(row.savedNote || "");
  const savedLabel = {
    manual_valve_turn_off: "Manual valve turn off",
    flow_meter_malfunction: "Flow meter malfunction",
    no_patient_connected: "No patient connected",
    other: "Other"
  }[savedAction] || "";
  return `
    <div class="incident-response-actions" data-incident-form="${row.id}">
      <label class="incident-note-label" for="incident-action-${row.id}">Action taken</label>
      <select id="incident-action-${row.id}" class="incident-action-select" data-saved-action="${escapeHtml(savedAction)}" aria-label="Action taken for alert ${row.id}">
        <option value="">Select action</option>
        <option value="manual_valve_turn_off">Manual valve turn off</option>
        <option value="flow_meter_malfunction">Flow meter malfunction</option>
        <option value="no_patient_connected">No patient connected</option>
        <option value="other">Other</option>
      </select>
      <textarea id="incident-note-${row.id}" class="incident-response-input" maxlength="100" rows="2" placeholder="Describe other action (100 characters)" aria-label="Other action details" hidden>${escapeHtml(incidentResponseDrafts.get(String(row.id)) || savedNote)}</textarea>
      <div class="incident-response-buttons">
        <button type="button" class="incident-response-button" data-save-alert-action data-alert-id="${row.id}" data-clear-alert="false">Save action</button>
        <button type="button" class="incident-response-button clear" data-save-alert-action data-alert-id="${row.id}" data-clear-alert="true">Save & clear alert</button>
      </div>
    </div>
  `;
}

function savedIncidentActionCell(row) {
  const action = String(row.savedAction || "");
  const note = String(row.savedNote || "");
  const label = {
    manual_valve_turn_off: "Manual valve turn off",
    flow_meter_malfunction: "Flow meter malfunction",
    no_patient_connected: "No patient connected",
    other: "Other"
  }[action];
  return `<div class="incident-saved-action"><span>Saved action</span>${label
    ? `<strong>${escapeHtml(label)}</strong>${note ? `<small>${escapeHtml(note)}</small>` : ""}`
    : "<small>No action saved</small>"}</div>`;
}

function bindIncidentActionControls(container) {
  if (!container) return;
  container.querySelectorAll(".incident-action-select").forEach(select => {
    const editorId = select.closest("[data-incident-form]")?.dataset.incidentForm || "";
    select.value = incidentActionDrafts.get(editorId) || select.dataset.savedAction || "";
    const syncOtherField = () => {
      const form = select.closest("[data-incident-form]");
      const note = form?.querySelector(".incident-response-input");
      if (!note) return;
      note.hidden = select.value !== "other";
      note.required = select.value === "other";
      if (note.hidden) note.value = "";
    };
    protectIncidentResponseControl(select);
    select.addEventListener("change", () => {
      incidentActionDrafts.set(editorId, select.value);
      syncOtherField();
    });
    syncOtherField();
  });
  container.querySelectorAll("[data-save-alert-action]").forEach(button => {
    button.addEventListener("click", () => {
      const form = button.closest("[data-incident-form]");
      const action = form?.querySelector(".incident-action-select")?.value || "";
      const note = form?.querySelector(".incident-response-input")?.value || "";
      saveIncidentAction(Number(button.dataset.alertId), action, note, button.dataset.clearAlert === "true");
    });
  });
  container.querySelectorAll(".incident-response-input").forEach(protectIncidentResponseInput);
}

async function saveIncidentAction(alertId, action, note = "", clearAlert = false) {
  if (!Number.isFinite(alertId) || !canRespondToIncident()) return;
  if (!action) {
    window.alert("Select the action taken before saving.");
    return;
  }
  note = String(note || "").trim();
  if (note.length > 100) {
    window.alert("Action notes must be 100 characters or fewer.");
    return;
  }
  if (action === "other" && !note) {
    window.alert("Describe the other action taken.");
    return;
  }
  if (!hasServerToken()) {
    window.alert("Your Nurse Manager session has expired. Please sign in again before saving an action.");
    return;
  }
  try {
    const response = await fetch(`/api/alerts/${alertId}/action`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ action, note, clear_alert: clearAlert })
    });
    const result = await response.json();
    if (isInvalidBearerTokenError(response, result)) {
      clearInvalidServerToken();
      throw new Error("Your session has expired. Please sign in again as Nurse Manager.");
    }
    if (!response.ok) throw new Error(result?.message || "Action could not be saved.");
    if (clearAlert) {
      clearSimulatorAlertTarget(alertId);
      incidentResponseDrafts.delete(String(alertId));
      incidentActionDrafts.delete(String(alertId));
    }
    activeIncidentResponseEditorId = "";
    await loadDatabaseAlerts();
    if (clearAlert) await loadWardCardStatuses();
    renderAll();
  } catch (error) {
    window.alert(error.message || "Action could not be saved.");
  }
}

function clearSimulatorAlertTarget(alertId) {
  const target = simulatorAlertTargets.get(String(alertId));
  if (!target) return;
  const ward = wards.find(item => item.id === target.wardId);
  const tank = ward?.tanks.find(item => item.name === target.tankName);
  if (tank) {
    tank.alertType = "Normal";
    tank.alertMessage = "";
    tank.highFlowAlert = false;
    tank.leakageAlert = false;
    tank.fixedFlow = false;
  }
  simulatorAlertTargets.delete(String(alertId));
}

async function respondToIncident(alertId, action, note = "") {
  if (!Number.isFinite(alertId) || !canRespondToIncident()) return;
  if (!hasServerToken()) {
    window.alert("Your Nurse Manager session has expired. Please sign out and sign in again before saving an incident response.");
    return;
  }
  if (action === "acknowledge") {
    note = String(note || "").trim();
    if (!note) {
      window.alert("An acknowledgement note is required.");
      return;
    }
    if (note.length > 50) {
      window.alert("Acknowledgement notes must be 50 characters or fewer.");
      return;
    }
  }
  const endpoint = `/api/alerts/${alertId}/${action}`;
  try {
    const response = await fetch(endpoint, { method: "POST", headers: authHeaders(true), body: JSON.stringify({ note }) });
    const result = await response.json();
    if (isInvalidBearerTokenError(response, result)) {
      clearInvalidServerToken();
      throw new Error("Your session has expired. Please sign out and sign in again as Nurse Manager.");
    }
    if (!response.ok) throw new Error(result?.message || "Incident response could not be saved.");
    incidentResponseDrafts.delete(String(alertId));
    activeIncidentResponseEditorId = "";
    await loadDatabaseAlerts();
    renderAll();
  } catch (error) {
    window.alert(error.message || "Incident response could not be saved.");
  }
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
  const tone = value === "Normal" ? "normal" : value === "Residual Gas" ? "warning" : "danger";
  return `<span class="assignment-result ${tone}">${value}</span>`;
}

function getAlertWardCards() {
  const cards = [
    { key: "ae", ward: "A&E Ward", pressure: 50, totalFlow: 6.8, rows: [wardAlertRow("bed-05", "Bed 05", "PT-0005", "On", "4.0", "4.0", "Normal"), wardAlertRow("bed-06", "Bed 06", "PT-0006", "On", "3.5", "3.8", "Normal"), wardAlertRow("bed-07", "Bed 07", "PT-0007", "Off", "0.0", "2.8", "Normal")] },
    { key: "paediatrics", ward: "Paediatrics Ward", pressure: 48, totalFlow: 7.7, rows: [wardAlertRow("bed-10", "Bed 10", "PT-0010", "On", "2.5", "2.5", "Normal"), wardAlertRow("bed-11", "Bed 11", "PT-0011", "On", "3.0", "0.0", "Normal"), wardAlertRow("bed-12", "Bed 12", "PT-0012", "On", "4.0", "5.2", "Normal")] },
    { key: "recovery", ward: "Recovery Bay", pressure: 45, totalFlow: 4.1, rows: [wardAlertRow("bed-15", "Bed 15", "PT-0015", "On", "4.0", "4.1", "Normal"), wardAlertRow("bed-16", "Bed 16", "PT-0016", "Off", "0.0", "0.0", "Normal"), wardAlertRow("tank-r1", "Tank R1", "TANK-R1", "-", "0.0", "-", "Normal")] },
    { key: "labour", ward: "Labour Ward", pressure: 47, totalFlow: 3.8, rows: [wardAlertRow("bed-20", "Bed 20", "PT-0020", "On", "4.0", "3.9", "Normal"), wardAlertRow("bed-21", "Bed 21", "PT-0021", "On", "3.0", "0.0", "Normal"), wardAlertRow("bed-22", "Bed 22", "PT-0022", "Off", "0.0", "0.0", "Normal")] },
    { key: "maternity", ward: "Maternity Ward", pressure: 49, totalFlow: 5.4, rows: [wardAlertRow("bed-25", "Bed 25", "PT-0025", "On", "3.0", "3.1", "Normal"), wardAlertRow("bed-26", "Bed 26", "PT-0026", "On", "2.5", "2.3", "Normal"), wardAlertRow("bed-27", "Bed 27", "PT-0027", "Off", "0.0", "0.0", "Normal")] },
    { key: "nurse", ward: "Nurse Station", pressure: 48, totalFlow: 1.2, rows: [wardAlertRow("bed-30", "Bed 30", "PT-0030", "On", "1.0", "1.2", "Normal"), wardAlertRow("bed-31", "Bed 31", "PT-0031", "Off", "0.0", "0.0", "Normal"), wardAlertRow("bed-32", "Bed 32", "PT-0032", "Off", "0.0", "0.0", "Normal")] }
  ];
  return cards.sort((left, right) => Number(cardHasActiveAlert(right)) - Number(cardHasActiveAlert(left)));
}

function wardAlertRow(assetKey, asset, patientId, patientFlag, setValue, flow, defaultStatus) {
  return { assetKey, asset, patientId, patientFlag, setValue, flow, defaultStatus };
}

function wardStatusKey(wardKey, assetKey) {
  return `${wardKey}:${assetKey}`;
}

function getWardRowStatus(card, row) {
  const liveStatus = getLiveWardIncidentStatus(card, row);
  if (liveStatus) return liveStatus;
  return "Normal";
}

function cardHasActiveAlert(card) {
  return card.rows.some(row => getWardRowStatus(card, row) !== "Normal");
}

function normalizeWardIncidentStatus(status = "") {
  const value = String(status).trim().toLowerCase();
  if (value === "ghost flow") return "Ghost Flow";
  if (["unauthorized usage", "unauthorized bed usage", "unauthorized bed detection"].includes(value)) return "Unauthorized Bed Usage";
  if (["residual gas", "residual gas waste", "residual gas detection"].includes(value)) return "Residual Gas";
  return "";
}

function normalizeWardLabel(value = "") {
  return String(value).toLowerCase().replace("paediatrics", "paediatric").replace(/[^a-z0-9]/g, "");
}

function getLiveWardIncidentStatus(card, row) {
  const rowIdentifiers = [row.assetKey, row.asset, row.patientId]
    .map(value => String(value).toLowerCase().replace(/[^a-z0-9]/g, ""));
  const wardIncidents = getAlertIncidentRows().filter(alert =>
    simulatorAlertTargets.has(String(alert.id))
    && normalizeWardLabel(alert.ward) === normalizeWardLabel(card.ward)
  );
  const apiIncident = wardIncidents.find(alert => {
    const alertAsset = String(alert.asset || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return rowIdentifiers.some(identifier => identifier && (alertAsset.includes(identifier) || identifier.includes(alertAsset)));
  });
  if (apiIncident) return normalizeWardIncidentStatus(apiIncident.type);

  // Simulator IDs do not carry a ward-card bed key. Place the live ward incident
  // on the card's designated incident row so the card remains synchronized.
  if (wardIncidents.length && card.rows.at(-1) === row) return wardIncidents[0].type;

  const ward = wards.find(item => normalizeWardLabel(item.name) === normalizeWardLabel(card.ward));
  const tank = ward?.tanks.find(item => item.name === row.asset || item.station === row.asset);
  return normalizeWardIncidentStatus(tank?.alertType);
}

function canEditWardStatus() {
  const role = normalizePermissionRole(currentUser?.role || currentUser?.label || "");
  return WARD_STATUS_EDITOR_ROLES.has(role);
}

function renderWardStatusControl(card, row, editable = false) {
  const status = getWardRowStatus(card, row);
  return assignmentResult(status);
}

function renderAlertWardCard(card) {
  const hasAlert = cardHasActiveAlert(card);
  return `
    <article class="alert-panel alert-ward-panel${hasAlert ? " has-active-alert" : ""}" data-ward-key="${card.key}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="Open large ${card.ward} table">
      <div class="alert-panel-head">
        <h3>${card.ward}</h3>
        <span class="live-dot">Live</span>
      </div>
      <table class="alert-data-table compact">
        <thead><tr><th>Bed / Tank</th><th>Patient Flag</th><th>Set Value</th><th>Flow</th><th>Status</th></tr></thead>
        <tbody>${card.rows.map(row => `
          <tr class="${getWardRowStatus(card, row) !== "Normal" ? "ward-alert-row" : ""}">
            <td><b>${row.asset}</b><small>${row.patientId}</small></td>
            <td>${assignmentFlag(row.patientFlag)}</td>
            <td>${row.setValue}</td>
            <td>${row.flow}</td>
            <td>${renderWardStatusControl(card, row)}</td>
          </tr>
        `).join("")}</tbody>
      </table>
      <footer>Avg Pressure: ${card.pressure} PSI | Total Flow: ${card.totalFlow} Litre/Min</footer>
    </article>
  `;
}

function openAlertWardDialog(cardKey) {
  activeWardAlertKey = cardKey;
  renderAlertWardDialog(cardKey);
  const dialog = document.getElementById("wardAlertDialog");
  if (dialog && !dialog.open) dialog.showModal();
}

function renderAlertWardDialog(cardKey) {
  const card = getAlertWardCards().find(item => item.key === cardKey);
  if (!card) return;
  const title = document.getElementById("wardAlertDialogTitle");
  const summary = document.getElementById("wardAlertDialogSummary");
  const body = document.getElementById("wardAlertDialogBody");
  if (title) title.textContent = card.ward;
  if (summary) summary.textContent = `Average pressure ${card.pressure} PSI | Total flow ${card.totalFlow} Litre/Min`;
  if (body) {
    body.innerHTML = `
      <table class="alert-data-table ward-alert-dialog-table">
        <thead><tr><th>Bed / Tank</th><th>Patient ID</th><th>Patient Flag</th><th>Set Value</th><th>Live Flow</th><th>Status</th></tr></thead>
        <tbody>${card.rows.map(row => `
          <tr class="${getWardRowStatus(card, row) !== "Normal" ? "ward-alert-row" : ""}">
            <td><b>${row.asset}</b></td>
            <td>${row.patientId}</td>
            <td>${assignmentFlag(row.patientFlag)}</td>
            <td><strong>${row.setValue}</strong><small>Litre/Min</small></td>
            <td><strong>${row.flow}</strong><small>Litre/Min</small></td>
            <td>${renderWardStatusControl(card, row, true)}</td>
          </tr>
        `).join("")}</tbody>
      </table>
    `;
  }
}

async function updateWardCardStatus(select) {
  if (!canEditWardStatus() || !currentUser?.accessToken) return;
  const wardKey = select.dataset.wardKey;
  const assetKey = select.dataset.assetKey;
  const status = select.value;
  const previous = wardCardStatusOverrides.get(wardStatusKey(wardKey, assetKey));
  select.disabled = true;
  setWardStatusMessage("Saving status...", "saving");
  try {
    const response = await fetch("/api/ward-card-statuses", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${currentUser.accessToken}`
      },
      body: JSON.stringify({ ward_key: wardKey, asset_key: assetKey, status })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.message || "Status could not be saved.");
    wardCardStatusOverrides.set(wardStatusKey(wardKey, assetKey), payload.status.status);
    renderRealTimeAlert();
    if (document.getElementById("wardAlertDialog")?.open) renderAlertWardDialog(activeWardAlertKey);
    setWardStatusMessage("Status saved to Supabase.", "success");
  } catch (error) {
    select.value = previous || getAlertWardCards().find(card => card.key === wardKey)?.rows.find(row => row.assetKey === assetKey)?.defaultStatus || "Normal";
    select.disabled = false;
    setWardStatusMessage(error.message || "Status could not be saved.", "error");
  }
}

function setWardStatusMessage(message, tone) {
  const target = document.getElementById("wardAlertDialogStatus");
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
}

function renderAlertPipelineMap() {
  const flowTotal = Math.round(wards.reduce((sum, ward) => sum + totalFlow(ward), 0));
  const tankPercent = Math.max(42, 88 - Math.floor((Date.now() / 60000) % 28));
  return `
    <div class="pipeline-canvas live-pipeline" style="--flow-speed:${Math.max(10, 20 - flowTotal / 10)}s; --tank-level:${tankPercent}%">
      <div class="tank-farm">
        <strong>Main Tank Farm</strong>
        <span class="tank-percent">${tankPercent}%</span>
        <div class="tank-gauge" aria-label="Main tank farm remaining oxygen ${tankPercent}%">
          <i style="width:${tankPercent}%"></i>
        </div>
        <div><i></i><i></i><i></i><i></i></div>
      </div>
      <div class="pipe horizontal main"><b></b><b></b><b></b><b></b><b></b></div>
      <div class="pipe vertical center"><b></b><b></b></div>
      <div class="pipe horizontal bottom"><b></b><b></b></div>
      <div class="pipe vertical branch-left"><b></b></div>
      <div class="pipe vertical branch-right"><b></b></div>
      <span class="flow-label main">${flowTotal} Litre/Min</span>
      <button class="map-ward ae" type="button">A&E Ward<small>${Math.round(totalFlow(wards.find(w => w.id === "ae")))} Litre/Min</small></button>
      <button class="map-ward nurse" type="button">Nurse Station<small>${Math.round(totalFlow(wards.find(w => w.id === "nurse")))} Litre/Min</small></button>
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
  const token = currentUser?.accessToken || currentUser?.access_token || sessionStorage.getItem("oxyguardAccessToken");
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function setupGlobalAuditCapture() {
  if (auditCaptureInitialized) return;
  auditCaptureInitialized = true;
  const capture = (verb, element) => {
    if (!currentUser || !hasServerToken() || !element) return;
    if (element.closest("#loginCard") || element.matches('[type="password"], #loginMfaCode')) return;
    const label = String(
      element.dataset?.view
      || element.getAttribute?.("aria-label")
      || element.name
      || element.id
      || element.textContent
      || element.tagName
    ).replace(/\s+/g, " ").trim().slice(0, 70);
    if (!label) return;
    const detail = `${verb}: ${label}`.slice(0, 100);
    const signature = `${verb}|${label}`;
    const now = Date.now();
    if (lastCapturedAudit.signature === signature && now - lastCapturedAudit.at < 1200) return;
    lastCapturedAudit = { signature, at: now };
    void recordAuditEvent("User Activity", detail);
  };
  document.addEventListener("click", event => capture("Activated", event.target.closest("button, a, [data-view], [role='button']")), true);
  document.addEventListener("change", event => capture("Changed", event.target.closest("select, input, textarea")), true);
  document.addEventListener("submit", event => capture("Submitted", event.target), true);
}

async function recordAuditEvent(action, details, options = {}) {
  if (!hasServerToken()) return false;
  const endpoint = options.endpoint || "/api/audit-events";
  const body = endpoint === "/api/logout" ? {} : { action, details };
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(body),
      keepalive: Boolean(options.keepalive)
    });
    return response.ok;
  } catch {
    return false;
  }
}

function hasServerToken() {
  return Boolean(currentUser?.accessToken || currentUser?.access_token || sessionStorage.getItem("oxyguardAccessToken"));
}

function clearInvalidServerToken() {
  if (currentUser) {
    delete currentUser.accessToken;
    delete currentUser.access_token;
    sessionStorage.setItem("oxyguardUser", JSON.stringify(currentUser));
  }
  sessionStorage.removeItem("oxyguardAccessToken");
}

function isInvalidBearerTokenError(response, result) {
  return response?.status === 401 && /bearer token/i.test(String(result?.message || ""));
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
  const { time, date } = formatApplicationTimestamp(now);
  document.getElementById("dateTime").innerHTML = `<span class="clock-time">${time}</span><span class="clock-date">${date}</span>`;
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
    simulator: "ALERT SIMULATOR",
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
  if (isEditingIncidentResponse()) return;
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
  const criticalIncidentImpact = getCriticalIncidentImpact();
  const wastageTodayLitres = criticalIncidentImpact.estimatedWaste;
  const wastageCost = criticalIncidentImpact.estimatedCost;
  const yesterdayDelta = formatSignedPercent((todayConsumptionLitres - yesterdayConsumptionLitres) / yesterdayConsumptionLitres);
  const consumptionDirection = todayConsumptionLitres >= yesterdayConsumptionLitres ? "up" : "down";
  const consumptionTone = todayConsumptionLitres >= yesterdayConsumptionLitres ? "bad" : "good";
  const esp32Status = getEsp32DeviceStatus();
  const criticalOverview = getCriticalAlertOverview(alertRows);
  const patientAlertSummary = getPatientAlertSummary(activeTanks);
  const wastageCostLabel = criticalIncidentImpact.count
    ? `${currency(wastageCost)}&nbsp;Exposure&nbsp;|&nbsp;${criticalIncidentImpact.count}&nbsp;Core&nbsp;Detection${criticalIncidentImpact.count === 1 ? "" : "s"}`
    : "No cumulative core-rule exposure";

  document.getElementById("reportSummary").innerHTML = [
    reportSummaryCard("Average Flow", `${avgFlowValue}&nbsp;Litre/Min`, "Across active wards", colors.green, "spark"),
    reportSummaryCard("Oxygen at Risk (YTD)", `${wastageTodayLitres.toLocaleString()}&nbsp;Litre`, wastageCostLabel, colors.yellow, "warn"),
    reportSummaryCard("Active Patients", patientAlertSummary.total, `${patientAlertSummary.alertCount} Patient Alert${patientAlertSummary.alertCount === 1 ? "" : "s"}`, colors.purple, "people"),
    reportSummaryCard("Core Detections (YTD)", criticalOverview.total, "Matches cumulative rule overview", colors.red, "alert"),
    reportSummaryCard("Offline Devices", esp32Status.offline, `${esp32Status.online} / ${esp32Status.total} ESP32 Online`, colors.navy, "wifi")
  ].join("");

  const nurseDashboard = isNurseSupervisorDashboard();
  const maintenanceDashboard = isMaintenanceExecutiveDashboard();
  const facilitiesDashboard = getActivePermissionKey() === "facilities-manager";
  document.getElementById("operationsDashboardGrid")?.toggleAttribute("hidden", nurseDashboard || maintenanceDashboard);
  document.getElementById("nurseSupervisorDashboard")?.toggleAttribute("hidden", !nurseDashboard);
  document.getElementById("executiveMaintenanceDashboard")?.toggleAttribute("hidden", !maintenanceDashboard);
  document.getElementById("facilitiesResidualImpactCard")?.toggleAttribute("hidden", !facilitiesDashboard);

  if (facilitiesDashboard) renderResidualGasFinancialImpact("facilitiesResidualImpact");

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
  const depletionRows = getTankDepletionMonitoringRows(allTanks, depletionStatusFilter);

  const depletionTarget = document.getElementById("depletionTable");
  const depletionTableRows = depletionRows.length
    ? depletionRows.slice(0, 5).map(item => item.row)
    : dashboardBaselineDepletionRows[depletionStatusFilter] || dashboardBaselineDepletionRows.all;
  if (depletionTarget) depletionTarget.innerHTML = tableHtml(
    ["Ward", "Tank", "Serial #", "Tank Volume", "Depleted Volume", "Remaining", "Est. Depletion", "Tank Status"],
    depletionTableRows
  );
}

function renderNurseSupervisorDashboard(allTanks, activeTanks, alertRows) {
  const assignedWard = wards.find(ward => ward.id === "nurse") || wards[0];
  const assignedTanks = allTanks.filter(t => t.wardId === assignedWard.id);
  const activeAssignedTanks = assignedTanks.filter(t => t.active);
  const incidentRows = getAlertIncidentRows();
  const occupiedBeds = assignedTanks.filter(t => t.occupied).length;
  const assignedFlow = activeAssignedTanks.reduce((sum, t) => sum + t.flowRate, 0);
  const avgPressure = Math.round(activeAssignedTanks.reduce((sum, t) => sum + t.pressure, 0) / Math.max(1, activeAssignedTanks.length));
  const lowVolumeCount = activeAssignedTanks.filter(t => getReportVolumePercent(t) < 30).length;

  renderNurseAssignedWard(assignedWard, assignedTanks, activeAssignedTanks, occupiedBeds, incidentRows.length);
  renderNurseActiveAlerts(incidentRows);
  renderNurseCurrentUsage(assignedFlow, avgPressure, activeAssignedTanks, occupiedBeds);
  renderNurseBedStatus(assignedTanks);
  renderNurseWardCards();
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

function renderNurseActiveAlerts(alertRows) {
  const target = document.getElementById("nurseActiveAlerts");
  const count = document.getElementById("nurseActiveAlertCount");
  if (!target) return;
  const rows = alertRows.map(row => [
    `${row.ward} / ${row.asset}`,
    row.tankSerial || "Pending assignment",
    row.type,
    alertPill(row.priority),
    formatAlertImpact(row),
    savedIncidentActionCell(row),
    canRespondToIncident() ? incidentResponseControls(row) : ""
  ]);
  target.innerHTML = rows.length
    ? tableHtml(["Ward / Bed", "Tank Serial #", "Alert", "Priority", "Recommended Action", "Saved Action", "Response"], rows)
    : `<div class="nurse-empty-state">No active incidents. New alerts will appear here for nurse response.</div>`;
  bindIncidentActionControls(target);
  if (count) count.textContent = `${rows.length} active`;
}

function formatApplicationTimestamp(value) {
  const dateTime = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dateTime.getTime())) return { time: "--:--:--", date: "--" };
  return {
    time: dateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    date: dateTime.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })
  };
}

function renderNurseWardCards() {
  const target = document.getElementById("nurseWardCards");
  if (!target || isEditingIncidentResponse()) return;
  target.innerHTML = getAlertWardCards().map(renderAlertWardCard).join("");
  target.querySelectorAll(".alert-ward-panel").forEach(card => {
    card.addEventListener("click", event => {
      if (event.target.closest("select, button, a, input, label")) return;
      openAlertWardDialog(card.dataset.wardKey);
    });
  });
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
  renderResidualGasFinancialImpact("executiveResidualImpact");

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
      const depletedVolume = Math.max(0, t.maxVolume - t.volumeRemaining);
      const status = tankDepletionStatus(t);
      const cylinderStatus = getCylinderOperationalStatus(t);
      return {
        tank: t,
        status,
        minutes: minutesUntilDepletion(t),
        row: [
          t.wardName,
          t.name,
          t.serial,
          `${t.maxVolume.toLocaleString()} L`,
          `${depletedVolume.toLocaleString()} L`,
          `${t.volumeRemaining.toLocaleString()} L (${percent}%)`,
          estimateDepletion(t),
          badge(cylinderStatus.label, cylinderStatus.tone)
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
    ["Database", databaseConnectionStatus.label, "database", databaseConnectionStatus.tone],
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

function getCriticalAlertOverview() {
  const incidents = getAlertIncidentRows(databaseAlertRows.filter(isAlertFromToday));
  const liveGhostFlow = incidents.filter(row => row.type === "Ghost Flow").length;
  const unauthorized = incidents.filter(row => row.type === "Unauthorized Bed Usage").length;
  const residualGas = incidents.filter(row => row.type === "Residual Gas").length;
  const cards = [
    ["Ghost Flow", liveGhostFlow, "GF"],
    ["Unauthorized", unauthorized, "ID"],
    ["Residual Gas", residualGas, "O2"]
  ];
  return {
    cards,
    total: cards.reduce((sum, [, value]) => sum + value, 0)
  };
}

function isAlertFromToday(alert, today = new Date()) {
  const occurredAt = new Date(alert?.occurredAt);
  return !Number.isNaN(occurredAt.getTime())
    && occurredAt.getFullYear() === today.getFullYear()
    && occurredAt.getMonth() === today.getMonth()
    && occurredAt.getDate() === today.getDate();
}

function getResidualGasFinancialImpact() {
  const rows = databaseAlertRows.filter(row => row.type === "Residual Gas Waste");
  const sum = key => rows.reduce((total, row) => {
    const value = Number(row[key]);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
  const percentageRows = rows.filter(row => Number.isFinite(row.unusedPercentage));
  return {
    alertCount: rows.length,
    remainingVolume: sum("remainingVolume"),
    unusedPercentage: percentageRows.length
      ? percentageRows.reduce((total, row) => total + row.unusedPercentage, 0) / percentageRows.length
      : 0,
    estimatedOxygenWaste: sum("estimatedOxygenWaste"),
    estimatedFinancialLoss: sum("estimatedFinancialLoss"),
    potentialSavings: sum("potentialSavings")
  };
}

function renderResidualGasFinancialImpact(targetId) {
  const impact = getResidualGasFinancialImpact();
  renderExecutiveMetricPanel(targetId, {
    value: `${impact.estimatedOxygenWaste.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`,
    label: "Estimated oxygen waste",
    detail: `${impact.alertCount} unresolved residual gas alert${impact.alertCount === 1 ? "" : "s"}`,
    tone: impact.alertCount ? "warn" : "good",
    items: [
      ["Remaining volume", `${impact.remainingVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`],
      ["Unused percentage", `${(impact.unusedPercentage * 100).toFixed(1)}%`],
      ["Estimated financial loss", currency(impact.estimatedFinancialLoss)],
      ["Potential savings", currency(impact.potentialSavings)]
    ]
  });
}

function formatAlertImpact(row) {
  const recommendedAction = row.recommendedAction || getRecommendedAlertAction(row.type);
  const action = recommendedAction
    ? `<div class="recommended-action-text"><strong>Recommended Action:</strong> ${recommendedAction}</div>`
    : "-";
  if (row.type !== "Residual Gas Waste" || !Number.isFinite(row.estimatedOxygenWaste)) return action;
  const unusedPercent = Number.isFinite(row.unusedPercentage) ? `${(row.unusedPercentage * 100).toFixed(1)}%` : "-";
  const loss = Number.isFinite(row.estimatedFinancialLoss) ? currency(row.estimatedFinancialLoss) : "-";
  const savings = Number.isFinite(row.potentialSavings) ? currency(row.potentialSavings) : "-";
  return `<strong>${row.estimatedOxygenWaste.toLocaleString()} L waste (${unusedPercent})</strong><br>Loss ${loss} · Savings ${savings}<br>${action}`;
}

function getCriticalIncidentImpact() {
  const latestRuleRows = getLatestRulePerformance();
  if (latestRuleRows.length) {
    return {
      count: latestRuleRows.reduce((total, row) => total + Number(row.active_detections || 0), 0),
      estimatedWaste: Math.round(latestRuleRows.reduce((total, row) => total + Number(row.oxygen_at_risk_litres || 0), 0)),
      estimatedCost: Math.round(latestRuleRows.reduce((total, row) => total + Number(row.cost_exposure_jmd || 0), 0))
    };
  }
  // Fall back to unresolved incidents when no cumulative snapshot is available.
  const incidents = getAlertIncidentRows().filter(row => ["Ghost Flow", "Unauthorized Bed Usage", "Residual Gas"].includes(row.type));
  const estimatedWaste = Math.round(incidents.reduce((total, row) => {
    const value = Number(row.estimatedOxygenWaste);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0));
  const reportedCost = incidents.reduce((total, row) => {
    const value = Number(row.estimatedFinancialLoss);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
  return {
    count: incidents.length,
    estimatedWaste,
    estimatedCost: Math.round(reportedCost || estimatedWaste * OXYGEN_COST_PER_LITRE)
  };
}

function getRecommendedAlertAction(type = "") {
  const normalizedType = String(type).trim().toLowerCase();
  if (["ghost flow", "ghost_flow"].includes(normalizedType)) {
    return "Verify patient occupancy and close oxygen supply.";
  }
  if (["unauthorized bed detection", "unauthorized bed usage", "unauthorized usage", "unauthorized_bed_usage"].includes(normalizedType)) {
    return "Verify patient assignment and investigate oxygen usage.";
  }
  if (["residual gas detection", "residual gas", "residual gas waste", "residual_gas_waste"].includes(normalizedType)) {
    return "Review cylinder replacement procedures.";
  }
  return "";
}

function renderCriticalOverview(overview) {
  const target = document.getElementById("criticalOverviewCards");
  if (!target) return;
  target.innerHTML = overview.cards.map(([label, value, icon]) => `
    <article class="critical-mini-card ${value ? "active-alert" : "clear-alert"}">
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
        <small>Today</small>
      </div>
      <b>${icon}</b>
    </article>
  `).join("");
}

function getSynchronizedWardAlertEntries() {
  const incidents = getAlertIncidentRows();
  return getAlertWardCards().flatMap(card => card.rows.map(row => {
    const type = getWardRowStatus(card, row);
    if (type === "Normal") return null;
    const incident = incidents.find(item => (
      normalizeWardLabel(item.ward) === normalizeWardLabel(card.ward)
      && normalizeWardIncidentStatus(item.type) === type
    ));
    return { card, row, type, priority: incident?.priority || "High" };
  }).filter(Boolean));
}

function renderPatientAlerts(activeTanks) {
  const target = document.getElementById("patientAlertsTable");
  if (!target) return;
  const incidents = getAlertIncidentRows();
  const rows = getAlertWardCards().flatMap(card => card.rows
    .filter(row => row.patientFlag === "On")
    .map(row => {
    const type = getWardRowStatus(card, row);
    const incident = incidents.find(item => (
      normalizeWardLabel(item.ward) === normalizeWardLabel(card.ward)
      && normalizeWardIncidentStatus(item.type) === type
    ));
    const priority = incident?.priority || "Normal";
    const setValue = Number(row.setValue) || 0;
    const liveReading = Number(row.flow) || 0;
    const status = evaluatePatientFlowStatus(Math.max(0.1, setValue), liveReading);
    return [
      row.patientId,
      `${card.ward} / ${row.asset}`,
      formatFlow(setValue),
      formatFlow(liveReading),
      formatVariance(status.variance),
      type === "Normal" ? badge("Normal", "good") : alertPill(priority),
      patientAlertTypeBadge(type === "Normal" ? "Clear" : type)
    ];
  }));
  target.innerHTML = rows.length
    ? tableHtml(["Patient ID", "Ward / Bed", "SetValue", "Live Reading", "Variance", "Status", "Alert"], rows)
    : `<div class="nurse-empty-state">No patients are currently flagged as on oxygen support in the Ward Cards.</div>`;
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
  const entries = getSynchronizedWardAlertEntries();
  const rows = getAlertWardCards().map(card => {
    const wardEntries = entries.filter(entry => entry.card.key === card.key);
    const critical = wardEntries.filter(entry => entry.priority === "Critical").length;
    const warning = wardEntries.filter(entry => entry.priority !== "Critical").length;
    const activeAlerts = wardEntries.length;
    return {
      ward: card.ward.replace(" Ward", ""),
      total: activeAlerts,
      activeAlerts,
      critical,
      warning,
      accent: wards.find(ward => normalizeWardLabel(ward.name) === normalizeWardLabel(card.ward))?.accent || colors.grey
    };
  });
  target.innerHTML = `
    <div class="ward-alert-summary" aria-label="Alerts by ward status summary">
      <div class="ward-alert-summary-head" aria-hidden="true">
        <span>Ward</span><span>Crit</span><span>Warn</span><span>Act</span>
      </div>
      ${rows.map(row => `
          <div class="ward-alert-summary-row">
            <div class="ward-alert-identity">
              <i style="--ward-accent:${row.accent}"></i>
              <div><strong>${row.ward}</strong><span>${row.total ? `${row.total} open` : "Clear"}</span></div>
            </div>
            <b class="ward-alert-count critical ${row.critical ? "" : "zero"}" aria-label="${row.critical} critical alerts">${row.critical}</b>
            <b class="ward-alert-count warning ${row.warning ? "" : "zero"}" aria-label="${row.warning} warning alerts">${row.warning}</b>
            <b class="ward-alert-count active ${row.activeAlerts ? "" : "zero"}" aria-label="${row.activeAlerts} active alerts">${row.activeAlerts}</b>
          </div>
        `).join("")}
    </div>
  `;
}

function renderV5TrendAnalytics() {
  const target = document.getElementById("v5TrendAnalytics");
  if (!target) return;

  const hours = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"];
  const totalFlowValue = wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
  const averageFlowValue = Math.round(totalFlowValue / Math.max(1, wards.length));
  const flowAxisMaximum = Math.max(20, Math.ceil(Math.max(1, averageFlowValue) / 20) * 20);
  const now = new Date();
  const dayProgress = (now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60) / (24 * 60);
  const width = 520;
  const height = 188;
  const left = 50;
  const right = 20;
  const top = 28;
  const bottom = 40;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const currentX = left + dayProgress * plotWidth;
  const currentY = top + ((flowAxisMaximum - averageFlowValue) / flowAxisMaximum) * plotHeight;
  const flowPath = `M ${left.toFixed(1)} ${currentY.toFixed(1)} L ${currentX.toFixed(1)} ${currentY.toFixed(1)}`;

  target.innerHTML = `
    <div class="trend-legend">
      <span class="flow">Live Average Flow — ${averageFlowValue} Litre/Min</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" aria-label="Live average flow by current time of day">
      <text class="trend-axis-title left" x="${left}" y="16">Flow (Litre/Min)</text>
      ${[0, 1, 2, 3].map(index => Math.round((flowAxisMaximum / 3) * index)).map(value => {
        const y = top + ((flowAxisMaximum - value) / flowAxisMaximum) * plotHeight;
        return `
          <line class="trend-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>
          <text class="trend-tick" x="${left - 14}" y="${y + 4}">${value}</text>
        `;
      }).join("")}
      <line class="trend-axis" x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}"></line>
      <line class="trend-axis" x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}"></line>
      <path class="trend-flow-line" d="${flowPath}"></path>
      <circle cx="${currentX.toFixed(1)}" cy="${currentY.toFixed(1)}" r="5" fill="#1f8bff" stroke="#ffffff" stroke-width="2"></circle>
      <text class="trend-time" x="${currentX.toFixed(1)}" y="${Math.max(top + 12, currentY - 10).toFixed(1)}">Now</text>
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
      [formatActivityTime(minutesFromNow(4)), "danger", `${activeAlert.name} ${activeAlert.alertType || "alert"} detected in ${activeAlert.wardName || activeAlert.ward || "A&E Ward"}`],
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
    ["Review oxygen allocation in A&E Ward.", "Usage is 18% higher than monthly average.", "Low"]
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
  if (String(t.cylinderStatus || "").toUpperCase() === "EMPTY" || Number(t.volumeRemaining) <= 0) return { key: "critical", label: "Empty", tone: "bad" };
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

function renderTankVolumeChart() {
  const target = document.getElementById("tankVolumeChart");
  if (!target) return;
  const incidents = getAlertIncidentRows();

  target.innerHTML = incidents.length
    ? `
      <div class="critical-tank-board">
        ${incidents.map(incident => `
          <article class="critical-tank-item">
            <div>
              <strong>${incident.type}</strong>
              <span>${incident.ward} | ${incident.asset}</span>
            </div>
            <b>${incident.priority}</b>
          </article>
        `).join("")}
      </div>
    `
    : `
      <div class="critical-tank-empty">
        <strong>No active detection alerts</strong>
        <span>Ghost Flow, Unauthorized Bed Usage, and Residual Gas alerts will appear here when triggered.</span>
      </div>
    `;
}

function getPatientAlertSummary(activeTanks) {
  const incidents = getAlertIncidentRows();
  const patientAlerts = incidents.filter(row => ["Ghost Flow", "Unauthorized Bed Usage", "Residual Gas"].includes(row.type));
  return {
    // This is the same monitored patient population shown in the anonymized
    // patient-alert table; the secondary value is the live incident count.
    total: activeTanks.length ? ACTIVE_PATIENT_TARGET : 0,
    alertCount: patientAlerts.length
  };
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
  const replacementCost = replacementCount * CYLINDER_REFILL_COST;
  const newCylinderExposure = replacementCount * NEW_CYLINDER_COST;

  renderOrderSummaryData({
    metrics: {
      reason: "3 tanks below 10% capacity",
      predicted_shortage: "In 2 hours 05 min",
      recommendation: "Order 20 replacement tanks",
      confidence: "96%"
    },
    trigger_summary: {
      tanks_below_threshold: replacementTanks.length,
      forecasted_demand_increase: "18%",
      current_system_capacity: "15%",
      threshold_exceeded: true
    },
    financial_summary: {
      order_value: replacementCost,
      refill_unit_cost: CYLINDER_REFILL_COST,
      new_cylinder_unit_cost: NEW_CYLINDER_COST,
      new_cylinder_exposure: newCylinderExposure,
      refill_vs_new_savings: newCylinderExposure - replacementCost,
      estimated_waste_prevented: 820000,
      potential_downtime_avoided: 3100000,
      projected_monthly_savings: 1200000
    },
    supplier_information: {
      supplier: "Industrial Gases Limited (IGL)",
      expected_delivery: "Tomorrow, 08:00 AM",
      lead_time: "14 hours",
      past_orders: 23,
      reliability: "99%"
    },
    inventory_details: {
      total_tanks: activeTanks.length,
      tanks_in_use: activeTanks.length,
      critical_tanks: replacementTanks.filter(t => t.volumePercent < 10).length,
      reorder_level: "30%",
      available_reserve: Math.max(0, 40 - activeTanks.length),
      last_updated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    },
    order_details: {
      product: "100 lb Oxygen Cylinder Refill",
      quantity: replacementCount,
      tank_type: "100 lb medical oxygen cylinder",
      po_number: "AUTO-PO-2026-0619-0018",
      status: "Pending Approval"
    },
    risk: {
      level: "High",
      affected_wards: ["Recovery Bay", "Labour Ward"],
      estimated_impact: "Service interruption, patient care delay",
      time_until_shortage: "2 hours 05 minutes"
    },
    replacement_tanks: replacementTanks.map(t => ({
      tank: t.name,
      ward: t.wardName,
      remaining_percent: t.volumePercent,
      empty_in: t.emptyIn,
      status: t.volumePercent < 10 ? "Critical" : "Low"
    }))
  });
  loadOrderSummaryFromApi();
}

async function loadOrderSummaryFromApi() {
  if (!hasServerToken()) return;
  if (activeView !== "order") return;
  const now = Date.now();
  if (now - lastOrderSummaryFetchAt < 15000) return;
  lastOrderSummaryFetchAt = now;
  const requestId = ++orderSummaryRequestId;
  try {
    const response = await fetch("/api/order-summary", { cache: "no-store", headers: authHeaders(false) });
    const result = await response.json();
    if (requestId !== orderSummaryRequestId) return;
    if (isInvalidBearerTokenError(response, result)) {
      clearInvalidServerToken();
      return;
    }
    if (!response.ok || !result.ok || !result.order_summary) throw new Error(result?.message || "Order summary unavailable.");
    renderOrderSummaryData(result.order_summary);
  } catch (error) {
    console.warn(`OxyGuard order summary unavailable: ${error.message}`);
  }
}

function renderOrderSummaryData(summary) {
  const metrics = summary.metrics || {};
  const trigger = summary.trigger_summary || {};
  const financial = summary.financial_summary || {};
  const supplier = summary.supplier_information || {};
  const details = summary.order_details || {};
  const inventory = summary.inventory_details || {};
  const risk = summary.risk || {};
  const replacementTanks = Array.isArray(summary.replacement_tanks) ? summary.replacement_tanks : [];
  // Inventory detail is a live operational snapshot. Refreshing this view at
  // five-minute intervals makes the displayed timestamp match that cadence.
  const inventoryUpdatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  setOrderHtml("orderRecommendMetrics", `
    ${orderMetric("Reason", metrics.reason || `${replacementTanks.length || 0} tanks below threshold`, "R")}
    ${orderMetric("Predicted Shortage", metrics.predicted_shortage || risk.time_until_shortage || "Monitoring", "T")}
    ${orderMetric("Recommendation", metrics.recommendation || `Order ${details.quantity || replacementTanks.length || 0} replacement tanks`, "O")}
    ${orderMetric("Confidence", metrics.confidence || "96%", "%")}
  `);
  renderReplacementSummary(replacementTanks);
  setOrderHtml("riskAssessmentPanel", renderRiskAssessment(risk));
  setOrderHtml("orderTriggerSummary", orderMiniPanel("Order Trigger Summary", [
    ["Tanks below threshold", trigger.tanks_below_threshold ?? replacementTanks.length],
    ["Forecasted demand increase", trigger.forecasted_demand_increase || "Calculating"],
    ["Current system capacity", trigger.current_system_capacity || "Monitoring"],
    ["Threshold exceeded", trigger.threshold_exceeded ? "<b class=\"order-red\">Yes</b>" : "<b class=\"order-green\">No</b>"]
  ]));
  setOrderHtml("financialSummary", orderMiniPanel("Financial Summary", [
    ["Refill Unit Cost", currency(Number(financial.refill_unit_cost || CYLINDER_REFILL_COST))],
    ["New Cylinder Cost", currency(Number(financial.new_cylinder_unit_cost || NEW_CYLINDER_COST))],
    ["Order Value (Refill)", currency(Number(financial.order_value || 0))],
    ["New Cylinder Exposure", currency(Number(financial.new_cylinder_exposure || 0))],
    ["Refill Savings vs New", currency(Number(financial.refill_vs_new_savings || 0))],
    ["Estimated Waste Prevented", currency(Number(financial.estimated_waste_prevented || 0))],
    ["Potential Downtime Avoided", currency(Number(financial.potential_downtime_avoided || 0))],
    ["Projected Monthly Savings", currency(Number(financial.projected_monthly_savings || 0))]
  ], "money"));
  setOrderHtml("supplierInformation", orderMiniPanel("Supplier Information", [
    ["Supplier", supplier.supplier || "Industrial Gases Limited (IGL)"],
    ["Expected Delivery", supplier.expected_delivery || "Pending supplier confirmation"],
    ["Lead Time", supplier.lead_time || "14 hours"],
    ["Past Orders", supplier.past_orders ?? "23"],
    ["Reliability", `<b class=\"order-green\">${supplier.reliability || "99%"}</b>`]
  ]));
  setOrderHtml("inventoryDetails", orderMiniPanel("Inventory Details", [
    ["Total Tanks", inventory.total_tanks ?? "Monitoring"],
    ["Tanks in Use", inventory.tanks_in_use ?? "Monitoring"],
    ["Critical Tanks", `<b class=\"${Number(inventory.critical_tanks || 0) ? "order-red" : "order-green"}\">${inventory.critical_tanks ?? 0}</b>`],
    ["Reorder Level", inventory.reorder_level || "30%"],
    ["Available Reserve", inventory.available_reserve ?? "Monitoring"],
    ["Last Updated", inventoryUpdatedAt]
  ]));
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
          refillCost: CYLINDER_REFILL_COST,
          replacementCost: NEW_CYLINDER_COST
        };
      })
      .filter(t => t.volumePercent < threshold);
  });
}

function renderReplacementSummary(replacementTanks) {
  const summary = document.getElementById("replacementSummary");
  if (!summary) return;
  const panelTitle = document.querySelector(".critical-tanks-panel h3");
  if (panelTitle) panelTitle.textContent = `Critical Tanks (${replacementTanks.length})`;

  summary.innerHTML = `
    <table class="order-data-table">
      <thead><tr><th>Tank</th><th>Ward</th><th>Remaining</th><th>Est. Empty</th><th>Status</th></tr></thead>
      <tbody>
        ${replacementTanks.map(t => `
          <tr>
            <td><b>${escapeHtml(t.tank || t.name || "Tank")}</b></td>
            <td>${escapeHtml(t.ward || t.wardName || "Unassigned")}</td>
            <td>
              <span class="order-remaining"><b>${t.remaining_percent ?? t.volumePercent}%</b><i><em style="width:${Math.max(4, Number(t.remaining_percent ?? t.volumePercent) || 0)}%"></em></i></span>
            </td>
            <td class="${Number(t.remaining_percent ?? t.volumePercent) < 8 ? "order-red" : "order-orange"}">${escapeHtml(t.empty_in || t.emptyIn || "Monitoring")}</td>
            <td>${orderBadge(t.status || (Number(t.remaining_percent ?? t.volumePercent) < 10 ? "Critical" : "Low"), Number(t.remaining_percent ?? t.volumePercent) < 10 ? "bad" : "warn")}</td>
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
  if (target && target.innerHTML !== html) target.innerHTML = html;
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

function renderRiskAssessment(risk = {}) {
  const level = risk.level || "High";
  const affectedWards = Array.isArray(risk.affected_wards) && risk.affected_wards.length ? risk.affected_wards.join(", ") : "Recovery Bay, Labour Ward";
  const impact = risk.estimated_impact || "Service interruption, patient care delay";
  const timeUntilShortage = risk.time_until_shortage || "2 hours 05 minutes";
  return `
    <div class="risk-callout">
      <i>!</i>
      <div>
        <strong>Operational Risk: ${escapeHtml(level)}</strong>
        <span>Delay in ordering may cause ward disruption and impact patient care.</span>
      </div>
    </div>
    <div class="risk-list">
      ${orderMiniRow("Affected Wards", escapeHtml(affectedWards))}
      ${orderMiniRow("Estimated Impact", escapeHtml(impact))}
      ${orderMiniRow("Time Until Shortage", `<b class=\"order-red\">${escapeHtml(timeUntilShortage)}</b>`)}
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

  const auditTable = document.getElementById("adminAuditTable");
  if (auditTable && !auditTable.hasChildNodes()) {
    renderAdminAuditTable([], "Loading today's activity...");
  }
  if (!adminAuditLoading && Date.now() - lastAdminAuditFetchAt >= 10_000) {
    void loadAdminAuditLogs();
  }
}

function renderAdminAuditTable(rows, emptyMessage = "No audit activity recorded for today.") {
  const visibleRows = rows.slice(0, 7);
  if (!visibleRows.length) {
    setOrderHtml("adminAuditTable", `<div class="audit-log-empty">${escapeHtml(emptyMessage)}</div>`);
    return;
  }
  setOrderHtml("adminAuditTable", `
    <table class="admin-table">
      <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th></tr></thead>
      <tbody>
        ${visibleRows.map(row => `
          <tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>
        `).join("")}
      </tbody>
    </table>
  `);
}

async function loadAdminAuditLogs() {
  if (adminAuditLoading) return;
  adminAuditLoading = true;
  lastAdminAuditFetchAt = Date.now();
  const requestId = ++adminAuditRequestId;
  const today = localDateInputValue(new Date());
  if (!hasServerToken()) {
    renderAdminAuditTable(buildLiveAuditFallbackRows(), "Live audit activity is available after login.");
    adminAuditLoading = false;
    return;
  }
  try {
    const response = await fetch(`/api/audit-logs?day=${encodeURIComponent(today)}&limit=7`, {
      cache: "no-store",
      headers: authHeaders(false)
    });
    const result = await response.json();
    if (requestId !== adminAuditRequestId) return;
    if (isInvalidBearerTokenError(response, result)) {
      clearInvalidServerToken();
      renderAdminAuditTable(buildLiveAuditFallbackRows(), "Live audit activity is available after login.");
      return;
    }
    if (!response.ok || !result.ok || !Array.isArray(result.audit_logs)) {
      throw new Error(result?.message || "Today's audit activity could not be loaded.");
    }
    const rows = result.audit_logs.map(log => [
      formatAdminAuditTime(log.performed_at),
      escapeHtml(log.username || log.user_id || "System"),
      escapeHtml(log.role || "Unknown"),
      escapeHtml(log.action || "Activity"),
      escapeHtml(log.target_resource || log.ip_address || "Recorded")
    ]);
    renderAdminAuditTable(rows);
  } catch (error) {
    if (requestId !== adminAuditRequestId) return;
    renderAdminAuditTable([], error.message || "Today's audit activity could not be loaded.");
  } finally {
    if (requestId === adminAuditRequestId) adminAuditLoading = false;
  }
}

function buildLiveAuditFallbackRows() {
  const now = new Date();
  const active = activeAlerts();
  const latestAlert = active[0] || "No active alert";
  return [
    [formatAdminAuditTime(now.toISOString()), currentUser?.username || "Current Session", currentUser?.label || "Unknown", "User Login", "Live session active"],
    [formatAdminAuditTime(new Date(Date.now() - 60_000)), "System", "System", "Telemetry Check", `${totalFlowAllWards().toFixed(1)} Litre/Min live hospital flow`],
    [formatAdminAuditTime(new Date(Date.now() - 120_000)), "System", "System", active.length ? "Alert Review" : "System Normal", latestAlert],
    [formatAdminAuditTime(new Date(Date.now() - 180_000)), "System", "System", "Database Sync", databaseConnectionStatus.label || "Checking connection"],
    [formatAdminAuditTime(new Date(Date.now() - 240_000)), "System", "System", "Heat Map Refresh", "Ward oxygen usage status updated"]
  ];
}

function totalFlowAllWards() {
  return wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
}

async function openAuditLogDialog() {
  const dialog = document.getElementById("auditLogDialog");
  const dayFilter = document.getElementById("auditLogDayFilter");
  if (!dialog) return;
  if (dayFilter) {
    const today = localDateInputValue(new Date());
    dayFilter.max = today;
    if (!selectedAuditLogDay || selectedAuditLogDay > today) selectedAuditLogDay = today;
    dayFilter.value = selectedAuditLogDay;
  }
  dialog.showModal();
  await loadAuditLogDialogRows();
}

async function loadAuditLogDialogRows() {
  const requestId = ++auditLogDialogRequestId;
  const table = document.getElementById("auditLogDialogTable");
  const status = document.getElementById("auditLogDialogStatus");
  const dayFilter = document.getElementById("auditLogDayFilter");
  const day = selectedAuditLogDay || dayFilter?.value || localDateInputValue(new Date());
  selectedAuditLogDay = day;
  if (!table) return;
  table.setAttribute("aria-busy", "true");
  if (status) status.textContent = day ? `Loading audit logs for ${day}...` : "Loading recent audit logs...";
  if (!hasServerToken()) {
    auditLogDialogRows = buildLiveAuditFallbackRows().map((row, index) => ({
      audit_id: `live-${index + 1}`,
      performed_at: new Date().toISOString(),
      username: row[1],
      role: row[2],
      action: row[3],
      target_resource: row[4]
    }));
    renderAuditLogDialogRows(auditLogDialogRows);
    if (status) status.textContent = "Showing live session activity. Log in through the server to load Supabase history.";
    table.removeAttribute("aria-busy");
    return;
  }
  try {
    const query = day ? `?day=${encodeURIComponent(day)}` : "";
    const response = await fetch(`/api/audit-logs${query}`, { cache: "no-store", headers: authHeaders(false) });
    const result = await response.json();
    if (requestId !== auditLogDialogRequestId) return;
    if (isInvalidBearerTokenError(response, result)) {
      clearInvalidServerToken();
      auditLogDialogRows = buildLiveAuditFallbackRows().map((row, index) => ({
        audit_id: `live-${index + 1}`,
        performed_at: new Date().toISOString(),
        username: row[1],
        role: row[2],
        action: row[3],
        target_resource: row[4]
      }));
      renderAuditLogDialogRows(auditLogDialogRows);
      if (status) status.textContent = "Showing live session activity. Please log in again to load Supabase history.";
      return;
    }
    if (!response.ok || !result.ok || !Array.isArray(result.audit_logs)) {
      throw new Error(result?.message || "Audit logs could not be loaded.");
    }
    auditLogDialogRows = result.audit_logs;
    renderAuditLogDialogRows(auditLogDialogRows);
    if (status) {
      status.textContent = day
        ? `Showing ${auditLogDialogRows.length} log entr${auditLogDialogRows.length === 1 ? "y" : "ies"} for ${day}.`
        : `Showing ${auditLogDialogRows.length} recent log entries.`;
    }
  } catch (error) {
    if (requestId !== auditLogDialogRequestId) return;
    auditLogDialogRows = [];
    table.innerHTML = `<div class="audit-log-empty">${escapeHtml(error.message || "Audit logs could not be loaded.")}</div>`;
    if (status) status.textContent = "Unable to load audit logs.";
  } finally {
    if (requestId === auditLogDialogRequestId) table.removeAttribute("aria-busy");
  }
}

function localDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderAuditLogDialogRows(rows) {
  const table = document.getElementById("auditLogDialogTable");
  if (!table) return;
  if (!rows.length) {
    table.innerHTML = "<div class=\"audit-log-empty\">No audit logs found for this day.</div>";
    return;
  }
  table.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
      <tbody>
        ${rows.map(log => `
          <tr>
            <td>${formatAdminAuditTime(log.performed_at)}</td>
            <td>${escapeHtml(log.username || log.user_id || "System")}</td>
            <td>${escapeHtml(log.role || "Unknown")}</td>
            <td>${escapeHtml(log.action || "Activity")}</td>
            <td>${escapeHtml(log.target_resource || "Recorded")}</td>
            <td>${escapeHtml(log.ip_address || "-")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function emailAuditLogRows() {
  const email = document.getElementById("auditLogEmail")?.value.trim();
  const day = document.getElementById("auditLogDayFilter")?.value || "recent";
  const status = document.getElementById("auditLogDialogStatus");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (status) status.textContent = "Enter a valid email address before sending the log.";
    return;
  }
  const lines = auditLogDialogRows.length
    ? auditLogDialogRows.map(log => [
        formatAdminAuditTime(log.performed_at),
        log.username || log.user_id || "System",
        log.role || "Unknown",
        log.action || "Activity",
        log.target_resource || "Recorded",
        log.ip_address || "-"
      ].join(" | "))
    : ["No audit logs found for the selected period."];
  const subject = encodeURIComponent(`OxyGuard audit log - ${day}`);
  const body = encodeURIComponent(["OxyGuard Audit Log", `Period: ${day}`, "", ...lines].join("\n"));
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  if (status) status.textContent = `Prepared email for ${email}.`;
}

function formatAdminAuditTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return escapeHtml(value || "");
  const formatted = formatApplicationTimestamp(date);
  return `${formatted.time} · ${formatted.date}`;
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
  void recordAuditEvent("Configuration Change", `${setting.title}: ${setting.value}`);
  if (activeView === "administration") renderAdministration();
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
  void recordAuditEvent("Configuration Change", `Device ${deviceId}: ${action}; status=${device.status}`);
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
  void recordAuditEvent("Configuration Change", `Device added: ${deviceId}; location=${location}`);
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

  const safeRangeEnd = Math.max(1, Math.min(analyticsMonths.length - 1, analyticsRangeEnd));
  const selectedMonths = analyticsMonths.slice(0, safeRangeEnd + 1);
  const selectedData = analyticsData.map(ward => ({
    ...ward,
    usage: ward.usage.slice(0, safeRangeEnd + 1),
    leakage: ward.leakage.slice(0, safeRangeEnd + 1)
  }));
  updateAnalyticsRangeControl(selectedMonths, safeRangeEnd);

  const wardTotals = selectedData.map(ward => {
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
  const leakageRate = (totalLeakageTanks / Math.max(1, totalTanks)) * 100;
  const averageMonthlyUse = totalTanks / selectedMonths.length;
  const recoverableSavings = Math.round(totalLeakageCost * 0.7);

  summary.innerHTML = [
    reportSummaryCard("Total consumption", `${totalTanks} tanks`, `${averageMonthlyUse.toFixed(1)} tanks per month`, colors.ae),
    reportSummaryCard("Leakage rate", `${leakageRate.toFixed(1)}%`, `${totalLeakageTanks} tanks lost across all wards`, colors.orange),
    reportSummaryCard("Loss exposure", currency(totalLeakageCost), `${currency(CYLINDER_REFILL_COST)} per refill-equivalent tank`, colors.red, "dot", {
      hover: `Loss exposure: ${currency(totalLeakageCost)} based on ${totalLeakageTanks} estimated tanks lost.`
    }),
    reportSummaryCard("Recoverable value", currency(recoverableSavings), "Estimated savings if loss is reduced by 70%", colors.green, "dot", {
      hover: `Recoverable value: ${currency(recoverableSavings)} if the current leakage loss is reduced by 70%.`
    })
  ].join("");

  renderMonthlyUsageChart(wardTotals, selectedMonths);
  renderMonthlyWastageChart(wardTotals, selectedMonths);
  renderTopInsight("topConsumption", topConsumption, "consumption", topConsumption.totalTanks, topConsumption.usageCost, selectedMonths);
  renderTopInsight("topWastage", topWastage, "leakage wastage", topWastage.leakageTanks, topWastage.leakageCost, selectedMonths);
  renderCostExposureChart(wardTotals);
  renderSavingsOpportunityChart(wardTotals);
  renderAnalyticsRuleSummary(safeRangeEnd);

  renderWardMonthlyTotals(wardTotals, selectedMonths);
}

function getCylinderOperationalStatus(tankItem) {
  const status = String(tankItem.cylinderStatus || "").toUpperCase();
  if (status === "EMPTY" || Number(tankItem.volumeRemaining) <= 0) return { label: "Empty", tone: "bad" };
  if (status === "REPLACED") return { label: "Replaced", tone: "warn" };
  return { label: "Active", tone: "good" };
}

function updateAnalyticsRangeControl(selectedMonths, rangeEnd) {
  const firstMonth = selectedMonths[0];
  const lastMonth = selectedMonths.at(-1);
  const periodLabel = `${firstMonth}–${lastMonth}`;
  const slider = document.getElementById("analyticsMonthRange");
  const label = document.getElementById("analyticsRangeLabel");
  const period = document.getElementById("analyticsReportingPeriod");
  const summaryCopy = document.getElementById("analyticsWardSummaryCopy");
  const ruleCopy = document.getElementById("analyticsRulePeriodCopy");
  const marks = document.querySelector(".analytics-range-marks");

  if (label) label.textContent = periodLabel;
  if (period) period.textContent = periodLabel;
  if (summaryCopy) summaryCopy.textContent = `${lastMonth} usage, period movement, and ${periodLabel} contribution by ward.`;
  if (ruleCopy) ruleCopy.textContent = `Cumulative detections, oxygen risk, and financial exposure through ${lastMonth}.`;
  if (marks) marks.innerHTML = analyticsMonths.slice(1).map(month => `<span>${month}</span>`).join("");
  if (slider) {
    const maximum = Math.max(1, analyticsMonths.length - 1);
    slider.max = String(maximum);
    slider.value = String(rangeEnd);
    slider.setAttribute("aria-valuetext", `${analyticsMonths[0]} through ${lastMonth}`);
    slider.style.setProperty("--range-progress", `${((rangeEnd - 1) / Math.max(1, maximum - 1)) * 100}%`);
  }
}

function renderAnalyticsRuleSummary(rangeEnd = analyticsRangeEnd) {
  const target = document.getElementById("analyticsRuleSummary");
  if (!target) return;

  const incidents = getAlertIncidentRows();
  const rules = [
    {
      key: "ghost_flow",
      type: "Ghost Flow",
      code: "GF",
      tone: "ghost",
      trigger: "Flow above 0.5 LPM with breathing variance below 0.01 for at least 11 minutes.",
      action: "Verify patient occupancy and close oxygen supply."
    },
    {
      key: "unauthorized_bed_usage",
      type: "Unauthorized Bed Usage",
      code: "ID",
      tone: "unauthorized",
      trigger: "An inactive EMR bed consumes at least 2.0 LPM for at least 11 minutes.",
      action: "Verify patient assignment and investigate oxygen usage."
    },
    {
      key: "residual_gas",
      type: "Residual Gas",
      code: "O₂",
      tone: "residual",
      trigger: "A replaced cylinder reports more than 90% utilization.",
      action: "Review cylinder replacement procedures."
    }
  ];

  target.innerHTML = rules.map(rule => {
    const snapshot = getRulePerformanceForMonth(rule.key, rangeEnd);
    const aliases = rule.key === "unauthorized_bed_usage"
      ? ["Unauthorized Bed Usage", "Unauthorized Usage"]
      : rule.key === "residual_gas"
        ? ["Residual Gas", "Residual Gas Waste"]
        : [rule.type];
    const ruleIncidents = incidents.filter(item => aliases.includes(item.type));
    const active = snapshot ? Number(snapshot.active_detections) : ruleIncidents.length;
    const detectionShare = snapshot ? Number(snapshot.detection_share) : (active / Math.max(1, incidents.length)) * 100;
    const oxygenAtRisk = snapshot
      ? Number(snapshot.oxygen_at_risk_litres)
      : ruleIncidents.reduce((total, item) => total + (Number.isFinite(Number(item.estimatedOxygenWaste)) ? Number(item.estimatedOxygenWaste) : 0), 0);
    const financialExposure = snapshot
      ? Number(snapshot.cost_exposure_jmd)
      : ruleIncidents.reduce((total, item) => total + (Number.isFinite(Number(item.estimatedFinancialLoss)) ? Number(item.estimatedFinancialLoss) : 0), 0);
    const recoverableValue = snapshot
      ? Number(snapshot.recoverable_value_jmd)
      : ruleIncidents.reduce((total, item) => total + (Number.isFinite(Number(item.potentialSavings)) ? Number(item.potentialSavings) : 0), 0);
    return `
      <article class="analytics-rule-card ${rule.tone} ${active ? "has-active" : "is-clear"}">
        <div class="analytics-rule-card-head">
          <span class="analytics-rule-code">${rule.code}</span>
        <span class="analytics-rule-status">${active ? `${active} YTD` : "Clear"}</span>
        </div>
        <h4>${rule.type}</h4>
        <div class="analytics-rule-primary"><strong>${active}</strong><span>cumulative detection${active === 1 ? "" : "s"}</span></div>
        <div class="analytics-rule-meter" aria-label="${detectionShare.toFixed(0)} percent of cumulative rule detections"><i style="width:${Math.max(active ? 8 : 0, detectionShare)}%"></i></div>
        <dl class="analytics-rule-metrics">
          <div><dt>Detection share</dt><dd>${active ? `${detectionShare.toFixed(0)}%` : "0%"}</dd></div>
          <div><dt>Oxygen at risk</dt><dd>${oxygenAtRisk.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</dd></div>
          <div><dt>Cost exposure</dt><dd>${currency(financialExposure)}</dd></div>
          <div><dt>Recoverable value</dt><dd>${currency(recoverableValue)}</dd></div>
        </dl>
        <div class="analytics-rule-action"><span>Rule logic</span><strong>${rule.trigger}</strong></div>
      </article>
    `;
  }).join("");
}

function getRulePerformanceForMonth(ruleKey, rangeEnd) {
  const targetMonth = Math.max(1, Math.min(12, Number(rangeEnd) + 1));
  return analyticsRulePerformance
    .filter(item => item.rule_key === ruleKey && new Date(`${String(item.as_of_date).slice(0, 10)}T00:00:00Z`).getUTCMonth() + 1 === targetMonth)
    .sort((a, b) => String(b.as_of_date).localeCompare(String(a.as_of_date)))[0] || null;
}

function getLatestRulePerformance() {
  const latestDate = analyticsRulePerformance.reduce((latest, item) => String(item.as_of_date) > latest ? String(item.as_of_date) : latest, "");
  return analyticsRulePerformance.filter(item => String(item.as_of_date) === latestDate);
}

function renderMonthlyUsageChart(wardTotals, selectedMonths) {
  const totalUsage = sumValues(wardTotals.map(ward => ward.totalTanks));
  const chartWidth = 480;
  const chartHeight = 32;
  const padding = { top: 4, right: 4, bottom: 4, left: 4 };

  document.getElementById("monthlyUsageChart").innerHTML = `
    <div class="ward-summary-board" aria-label="Ward oxygen consumption summary">
      <div class="ward-summary-columns" aria-hidden="true">
        <span>Ward</span><span>${selectedMonths[0]}–${selectedMonths.at(-1)} trend</span><span>${selectedMonths.at(-1)}</span><span>Change</span><span>Share</span>
      </div>
      ${wardTotals.slice().sort((a, b) => b.usage.at(-1) - a.usage.at(-1)).map(ward => {
        const firstMonth = ward.usage[0];
        const latestMonth = ward.usage[ward.usage.length - 1];
        const change = latestMonth - firstMonth;
        const maximumUsage = Math.max(...ward.usage);
        const minimumUsage = Math.min(...ward.usage);
        const usageRange = Math.max(1, maximumUsage - minimumUsage);
        const pointX = index => Math.round(padding.left + (index * (chartWidth - padding.left - padding.right)) / Math.max(1, selectedMonths.length - 1));
        const pointY = value => Math.round((padding.top + ((maximumUsage - value) / usageRange) * (chartHeight - padding.top - padding.bottom)) * 2) / 2;
        const points = ward.usage.map((value, index) => `${pointX(index)},${pointY(value)}`).join(" ");
        const share = Math.round((ward.totalTanks / Math.max(1, totalUsage)) * 100);
        const lastX = pointX(ward.usage.length - 1);
        const lastY = pointY(latestMonth);
        return `
          <div class="ward-summary-row" style="--ward-accent:${ward.accent}">
            <div class="ward-summary-ward">
              <i></i>
              <div><strong>${ward.ward}</strong><span>${ward.totalTanks} tanks total</span></div>
            </div>
            <div class="ward-summary-spark">
              <svg viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" shape-rendering="geometricPrecision" role="img" aria-label="${ward.ward} moved from ${firstMonth} tanks in ${selectedMonths[0]} to ${latestMonth} tanks in ${selectedMonths.at(-1)}">
                <polyline points="${points}" fill="none" stroke="${ward.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
                <line x1="${lastX}" y1="${lastY}" x2="${lastX}" y2="${lastY}" stroke="${ward.accent}" stroke-width="7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
              </svg>
            </div>
            <div class="ward-summary-latest"><span>${selectedMonths.at(-1)}</span><strong>${latestMonth}</strong><small>tanks</small></div>
            <div class="ward-summary-change ${change >= 0 ? "is-up" : "is-down"}"><span>vs ${selectedMonths[0]}</span><strong>${change >= 0 ? "+" : ""}${change}</strong></div>
            <div class="ward-summary-share">
              <div><span>Share</span><strong>${share}%</strong></div>
              <i><b style="width:${share}%;"></b></i>
            </div>
          </div>`;
      }).join("")}
    </div>
  `;
}

function renderMonthlyWastageChart(wardTotals, selectedMonths) {
  const monthlyTotals = selectedMonths.map((month, index) => {
    const usage = sumValues(wardTotals.map(item => item.usage[index]));
    const leakage = sumValues(wardTotals.map(item => item.leakage[index]));
    const leakageRate = Math.round((leakage / Math.max(1, usage)) * 100);
    return { month, usage, leakage, leakageRate, leakageCost: leakage * TANK_COST };
  });
  const totalUsage = sumValues(monthlyTotals.map(item => item.usage));
  const totalLeakage = sumValues(monthlyTotals.map(item => item.leakage));
  const usageMax = Math.ceil(Math.max(...monthlyTotals.map(item => item.usage)) / 20) * 20;
  const rateMax = Math.max(20, Math.ceil(Math.max(...monthlyTotals.map(item => item.leakageRate)) / 5) * 5);

  document.getElementById("monthlyWastageChart").innerHTML = `
    <div class="loss-line-summary">
      <div><span>Total consumption</span><strong>${totalUsage} tanks</strong></div>
      <div><span>Oxygen loss</span><strong>${totalLeakage} tanks</strong></div>
      <div><span>Latest loss rate</span><strong>${monthlyTotals.at(-1).leakageRate}%</strong></div>
    </div>
    <div class="loss-compare-board" role="table" aria-label="Monthly consumption and oxygen loss rate from ${selectedMonths[0]} through ${selectedMonths.at(-1)}">
      <div class="loss-compare-heading" role="row">
        <span role="columnheader">Month</span>
        <span role="columnheader">Consumption</span>
        <span role="columnheader">Loss rate</span>
      </div>
      ${monthlyTotals.map(item => `
        <div class="loss-compare-month-row" role="row">
          <strong class="loss-compare-month" role="cell">${item.month}</strong>
          <div class="loss-compare-metric usage" role="cell">
            <div><span>Oxygen used</span><strong>${item.usage} <small>tanks</small></strong></div>
            <i><b style="width:${Math.max(8, (item.usage / usageMax) * 100)}%"></b></i>
          </div>
          <div class="loss-compare-metric loss" role="cell">
            <div><span>Estimated loss</span><strong>${item.leakageRate}<small>%</small></strong></div>
            <i><b style="width:${Math.max(8, (item.leakageRate / rateMax) * 100)}%"></b></i>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderWardMonthlyTotals(wardTotals, selectedMonths) {
  const maxTotal = Math.max(1, ...wardTotals.map(item => item.totalTanks));
  document.getElementById("analyticsTable").innerHTML = wardTotals
    .slice()
    .sort((a, b) => b.totalTanks - a.totalTanks)
    .map(item => `
      <article class="ward-total-row" style="--ward-accent:${item.accent}; --ward-fill:${Math.max(10, Math.round((item.totalTanks / maxTotal) * 100))}%">
        <div class="ward-total-main">
          <span><i></i>${item.ward}</span>
          <strong>${item.totalTanks} tanks</strong>
        </div>
        <div class="ward-month-chip-row">
          ${selectedMonths.map((month, index) => `
            <b style="--chip-accent:${monthAccent(index)}">${month}<em>${item.usage[index]}</em></b>
          `).join("")}
        </div>
        <div class="ward-total-costs">
          <span>Spend <strong>${currency(item.usageCost)}</strong></span>
          <span>Loss rate <strong>${((item.leakageTanks / Math.max(1, item.totalTanks)) * 100).toFixed(1)}%</strong></span>
          <span>Recoverable <strong>${currency(Math.round(item.leakageCost * 0.7))}</strong></span>
        </div>
      </article>
    `).join("");
}

function monthAccent(index) {
  return ["#0b72e7", "#7c3aed", "#06a6d8", "#10a37f", "#f97316"][index % 5];
}

function renderCostExposureChart(wardTotals) {
  const maxCost = Math.max(1, ...wardTotals.map(item => item.usageCost + item.leakageCost));
  document.getElementById("costExposureChart").innerHTML = wardTotals
    .slice()
    .sort((a, b) => (b.usageCost + b.leakageCost) - (a.usageCost + a.leakageCost))
    .map(item => {
      const totalCost = item.usageCost + item.leakageCost;
      const leakageShare = Math.round((item.leakageCost / Math.max(1, totalCost)) * 100);
      return `
        <div class="cost-exposure-row">
          <div>
            <strong>${item.ward}</strong>
            <span>${currency(totalCost)}</span>
          </div>
          <div class="cost-exposure-bar">
            <i style="width:${Math.max(8, Math.round((totalCost / maxCost) * 100))}%; background:${item.accent}"></i>
          </div>
          <small>${leakageShare}% wastage</small>
        </div>
      `;
    }).join("");
}

function renderSavingsOpportunityChart(wardTotals) {
  const maxLeakageCost = Math.max(1, ...wardTotals.map(item => item.leakageCost));
  document.getElementById("savingsOpportunityChart").innerHTML = wardTotals
    .slice()
    .sort((a, b) => b.leakageCost - a.leakageCost)
    .map(item => {
      const recoverable = Math.round(item.leakageCost * 0.7);
      return `
        <div class="savings-row">
          <strong>${item.ward}</strong>
          <div class="savings-meter">
            <span style="width:${Math.max(8, Math.round((item.leakageCost / maxLeakageCost) * 100))}%; background:${item.accent}"></span>
          </div>
          <small>${currency(recoverable)} recoverable</small>
        </div>
      `;
    }).join("");
}

function renderTopInsight(id, item, label, tanks, value, selectedMonths) {
  document.getElementById(id).innerHTML = `
    <div class="top-ring" style="--accent:${item.accent}">
      <strong>${item.ward}</strong>
      <span>${tanks} tanks</span>
    </div>
    <div class="top-detail">
      <span>Top ward ${label}</span>
      <strong>${currency(value)}</strong>
      <small>Based on ${selectedMonths[0]}–${selectedMonths.at(-1)} data at ${currency(TANK_COST)} per tank.</small>
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

function currencyCompact(value) {
  if (value >= 1000000) {
    return `JMD ${(value / 1000000).toFixed(value >= 10000000 ? 1 : 2)}M`;
  }
  if (value >= 1000) {
    return `JMD ${(value / 1000).toFixed(0)}K`;
  }
  return currency(value);
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

  const roomForWard = (wardId, className, label, metaLabel) => {
    const ward = wards.find(item => item.id === wardId);
    const flow = ward ? totalFlow(ward) : 0;
    const activeCount = ward ? ward.tanks.filter(tankItem => tankItem.active).length : 0;
    const tankCount = ward?.tanks.length || 0;
    const alertCount = ward ? getWardIncidentCount(ward.name) : 0;
    const pressure = ward ? averagePressure(ward) : 0;
    const state = getHeatMapWardState(ward, alertCount);
    return {
      label,
      className,
      state,
      meta: `${metaLabel} | ${flow.toFixed(1)} Litre/Min | ${activeCount} online`,
      details: {
        flow,
        activeCount,
        tankCount,
        alertCount,
        pressure,
        stateLabel: heatMapStateLabel(state)
      }
    };
  };
  const supportRoom = (label, className, meta, details) => ({
    label,
    className,
    state: details.alertCount > 0 ? "ghost" : details.flow >= 15 ? "high" : "normal",
    meta,
    details: {
      ...details,
      stateLabel: details.alertCount > 0 ? "Alert" : details.flow >= 15 ? "High oxygen usage" : "Normal usage"
    }
  });
  const allTanks = wards.flatMap(ward => ward.tanks);
  const onlineTanks = allTanks.filter(tank => tank.active);
  const hospitalPressure = onlineTanks.length
    ? Math.round(onlineTanks.reduce((sum, tank) => sum + tank.pressure, 0) / onlineTanks.length)
    : 0;
  const hospitalAlerts = getAlertIncidentRows().length;
  const mapRooms = [
    supportRoom("ICU", "icu", "North intake | 8.0 Litre/Min | 2 online", {
      flow: 8,
      activeCount: 2,
      tankCount: 2,
      alertCount: 0,
      pressure: 48
    }),
    roomForWard("ae", "ward-a", "A&E Ward", "Emergency feed"),
    roomForWard("labour", "ward-b", "Labour Ward", "Labour line"),
    roomForWard("recovery", "ward-c", "Recovery Bay", "Recovery line"),
    roomForWard("paediatric", "pediatrics", "Pediatrics", "Paediatric feed"),
    roomForWard("nurse", "maternity", "Nurse Station", "Station feed"),
    supportRoom("Plant Room", "plant-room", `Supply control | ${totalFlowAllWards().toFixed(1)} Litre/Min | ${onlineTanks.length} online`, {
      flow: totalFlowAllWards(),
      activeCount: onlineTanks.length,
      tankCount: allTanks.length,
      alertCount: hospitalAlerts,
      pressure: hospitalPressure
    }),
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
        <div class="oxygen-room ${room.className} ${room.state}" tabindex="0">
          <b class="room-status ${room.state}"></b>
          <strong>${room.label}</strong>
          <small>${room.meta}</small>
          ${room.details ? `
            <div class="oxygen-room-popover">
              <span>${room.label}</span>
              <strong>${room.details.flow.toFixed(1)} Litre/Min</strong>
              <p>${room.details.activeCount} of ${room.details.tankCount} devices online</p>
              <p>${room.details.pressure} PSI average pressure</p>
              <p>${room.details.alertCount} active alert${room.details.alertCount === 1 ? "" : "s"} | ${room.details.stateLabel}</p>
            </div>
          ` : ""}
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

function heatMapStateLabel(state) {
  const labels = {
    normal: "Normal usage",
    high: "High oxygen usage",
    ghost: "Alert"
  };
  return labels[state] || "Monitoring";
}

function getWardIncidentCount(wardName) {
  return getAlertIncidentRows().filter(row => normalizeWardLabel(row.ward) === normalizeWardLabel(wardName)).length;
}

function getHeatMapWardState(ward, alertCount = 0) {
  if (alertCount > 0) return "ghost";
  if (!ward) return "normal";
  if (totalFlow(ward) >= 15) return "high";
  return "normal";
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
  const hoverDetail = escapeHtml(options.hover || `${title}: ${String(value).replace(/<[^>]*>/g, " ")}. ${String(status).replace(/<[^>]*>/g, " ")}`);
  const extraClass = options.className ? ` ${options.className}` : "";
  return `
    <article class="summary-card v5-kpi-card ${icon}${extraClass}" style="--kpi-accent:${color}" aria-label="${hoverDetail}" title="${hoverDetail}">
      <div class="kpi-copy">
        <span>${title}</span>
        <strong style="color:${color}">${value}</strong>
        <small>${status}${delta}</small>
      </div>
      <b class="kpi-icon ${icon}" aria-hidden="true"></b>
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
  return getAlertIncidentRows().map(alert => `${alert.type} — ${alert.ward} / ${alert.asset}`);
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
