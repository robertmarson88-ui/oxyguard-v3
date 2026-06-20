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

const permissionViews = {
  admin: {
    label: "Admin",
    allowedViews: ["report", "dashboard", "alert", "analytics", "order"]
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
  document.getElementById("protocolDetails").addEventListener("click", () => {
    window.alert("Protocol details: automated replenishment is triggered when projected depletion falls below the safety buffer.");
  });
  document.getElementById("downloadOrderSummary").addEventListener("click", () => {
    window.alert("Order summary downloaded.");
  });
  document.getElementById("rejectOrder").addEventListener("click", () => {
    window.alert("Automated order was rejected and marked for review.");
  });
  document.getElementById("confirmOrder").addEventListener("click", () => {
    window.alert("Order confirmed. Purchase order AUTO-PO-2026-0418-01 is pending supplier acknowledgement.");
  });
  document.getElementById("closeDialog").addEventListener("click", () => document.getElementById("wardDialog").close());
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

  document.getElementById("reportStartMonth").value = "2026-06";
  document.getElementById("reportEndMonth").value = "2026-06";

  ["reportStartMonth", "reportEndMonth"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {
      selectedReportPeriod = "";
      document.getElementById("reportEndMonth").value = document.getElementById("reportStartMonth").value;
      renderGeneratedReport();
      renderReportLiveInsights();
      renderMonthlyUsageComparison();
    });
  });
  document.querySelectorAll("[data-report-type]").forEach(button => {
    button.addEventListener("click", () => {
      selectedReportType = button.dataset.reportType;
      renderGeneratedReport();
    });
  });
  document.getElementById("emailGeneratedReport")?.addEventListener("click", emailGeneratedReport);
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

      currentUser = result.user;
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

function applyRoleAccess() {
  const isAdmin = currentUser?.role === "admin";
  const access = getActivePermissionView();
  const previewWrap = document.getElementById("permissionPreviewWrap");
  const previewLabel = document.getElementById("permissionPreviewLabel");

  if (previewWrap) previewWrap.hidden = !isAdmin;
  if (previewLabel) previewLabel.textContent = access.label;

  document.querySelectorAll(".side-button[data-view]").forEach(button => {
    button.hidden = !access.allowedViews.includes(button.dataset.view);
  });
  document.getElementById("sidebarUser").innerHTML = currentUser
    ? `<div class="user-avatar">${currentUser.username.slice(0, 1).toUpperCase()}</div><div class="user-meta"><strong>${currentUser.username}</strong><span>${isAdmin ? access.label : currentUser.label}</span></div>`
    : "";
  if (!access.allowedViews.includes(activeView)) {
    setView(access.allowedViews[0] || "report");
  }
}

function setupPermissionPreview() {
  const button = document.getElementById("permissionPreviewButton");
  const menu = document.getElementById("permissionPreviewMenu");
  if (!button || !menu) return;

  button.addEventListener("click", event => {
    event.stopPropagation();
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    menu.hidden = expanded;
  });

  menu.querySelectorAll("[data-permission-view]").forEach(option => {
    option.addEventListener("click", () => {
      permissionPreview = option.dataset.permissionView;
      button.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      applyRoleAccess();
      updateCurrentUserDisplay();
      updatePageTitle();
    });
  });

  document.addEventListener("click", event => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) {
      button.setAttribute("aria-expanded", "false");
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
  if (view === "analytics") renderAnalytics();
  updatePageTitle();
}

function renderWards() {
  const grid = document.getElementById("wardGrid");
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
  const active = wards.flatMap(w => w.tanks).filter(t => t.active).length;
  document.getElementById("activePatients").textContent = `${active}/40`;
  document.getElementById("wastage").textContent = `${wastage}%`;
  document.getElementById("wastageStatus").textContent = "Across all wards";

  const lowVolume = wards.flatMap(w => w.tanks)
    .map(t => ({ name: t.name, percent: Math.round((t.volumeRemaining * 100) / t.maxVolume) }))
    .filter(t => t.percent < 10);
  const lowVolumeEl = document.getElementById("lowVolume");
  lowVolumeEl.classList.toggle("low-volume-list", lowVolume.length > 0);
  lowVolumeEl.innerHTML = lowVolume.length ? renderLowVolumeList(lowVolume) : "None";
  lowVolumeEl.style.color = lowVolume.length ? colors.red : colors.green;

  const flowWard = wards[flowIndex % wards.length];
  document.getElementById("rotatingWard").textContent = flowWard.name;
  document.getElementById("rotatingWard").style.color = flowWard.accent;
  document.getElementById("rotatingFlow").textContent = `${totalFlow(flowWard)} Litre/Min`;
  document.getElementById("rotatingFlow").style.color = flowWard.accent;

  const alerts = activeAlerts();
  const systemAlert = document.getElementById("systemAlert");
  const alertText = document.getElementById("alertText");
  if (alerts.length > 1) {
    systemAlert.innerHTML = "MULTIPLE<br>LEAKS";
    systemAlert.style.color = colors.red;
    alertText.innerHTML = alerts.join("<br>");
  } else if (alerts.length === 1) {
    systemAlert.innerHTML = "LEAKAGE<br>DETECTED";
    systemAlert.style.color = colors.red;
    alertText.innerHTML = alerts[0];
  } else {
    systemAlert.textContent = "NORMAL";
    systemAlert.style.color = colors.green;
    alertText.textContent = "System running normally";
  }
  updateNotifications(alerts);
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
    analytics: "CALL ANALYTICS"
  };
  document.querySelector(".topbar h1").textContent = titles[activeView] || titles.report;
}

function updateNotifications(alerts = activeAlerts()) {
  const button = document.getElementById("alertNotificationButton");
  const count = document.getElementById("alertNotificationCount");
  const list = document.getElementById("alertNotificationList");
  const panel = document.getElementById("alertNotificationPanel");
  if (!button || !count || !list || !panel) return;

  count.textContent = String(alerts.length);
  button.classList.toggle("has-alert", alerts.length > 0);
  button.setAttribute("aria-label", alerts.length ? `${alerts.length} active alert notifications` : "No active alert notifications");

  list.innerHTML = alerts.length
    ? `<ul>${alerts.map(alert => `<li>${alert}</li>`).join("")}</ul>`
    : "No active alerts.";

  if (!alerts.length) {
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }
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
  const wastageCostLabel = `${currency(wastageCost)} Est. Cost | ${wastageTankLabel}`;
  const yesterdayDelta = formatSignedPercent((todayConsumptionLitres - yesterdayConsumptionLitres) / yesterdayConsumptionLitres);
  const esp32Status = getEsp32DeviceStatus();
  const criticalOverview = getCriticalAlertOverview(alertRows);

  document.getElementById("reportSummary").innerHTML = [
    reportSummaryCard("Average Flow", `${avgFlowValue} Litre/Min`, "Across active wards", colors.green, "spark"),
    reportSummaryCard("Today's Consumption", `${todayConsumptionLitres.toLocaleString()} Litre`, `vs Yesterday (${yesterdayConsumptionLitres.toLocaleString()} Litre)`, colors.blue, "up", { delta: yesterdayDelta, deltaTone: "bad" }),
    reportSummaryCard("Estimated Wastage (Today)", `${wastageTodayLitres.toLocaleString()} Litre`, wastageCostLabel, colors.yellow, "warn"),
    reportSummaryCard("Active Patients", "94", "On Oxygen Support", colors.purple, "people"),
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
  const depletionRows = activeTanks
    .map(t => {
      const percent = Math.round((t.volumeRemaining * 100) / t.maxVolume);
      const status = tankDepletionStatus(t);
      return {
        status,
        row: [
          t.wardName,
          t.name,
          t.serial,
          `${t.flowRate} Litre/Min`,
          `${t.volumeRemaining} L (${percent}%)`,
          estimateDepletion(t),
          badge(status.label, status.tone)
        ]
      };
    })
    .filter(item => depletionStatusFilter === "all" || item.status.key === depletionStatusFilter);

  const depletionTarget = document.getElementById("depletionTable");
  if (depletionTarget) depletionTarget.innerHTML = tableHtml(
    ["Ward", "Tank", "Serial #", "Flow", "Volume", "Est. Depletion", "Status"],
    depletionRows.length ? depletionRows.slice(0, 5).map(item => item.row) : [["No tanks match this filter", "-", "-", "-", "-", "-", badge("Clear", "good")]]
  );
}

function renderSystemHealth(status = getEsp32DeviceStatus()) {
  const target = document.getElementById("systemHealthPanel");
  if (!target) return;
  const espStatus = status.offline ? `${status.online} / ${status.total} Online` : `${status.total} / ${status.total} Online`;
  const items = [
    ["ESP32 Devices", espStatus, "device", status.offline ? "warn" : "good"],
    ["MQTT Broker", "Connected", "network"],
    ["FastAPI Server", "Running", "server"],
    ["Database", "Healthy", "database"],
    ["Last Packet Received", "2 sec ago", "packet"]
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
  const cards = [
    ["Leaks", alertRows.filter(t => t.leakageAlert).length, "LK"],
    ["Ghost Flow", alertRows.filter(t => t.highFlowAlert).length, "GF"],
    ["Unauthorized", 0, "ID"],
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
      <span>${label}</span>
      <strong>${value}</strong>
      <small>Active</small>
      <b>${icon}</b>
    </article>
  `).join("");
}

function renderPatientAlerts(activeTanks) {
  const target = document.getElementById("patientAlertsTable");
  if (!target) return;
  const rows = activeTanks.slice(0, 5).map((tankItem, index) => {
    const warning = tankItem.highFlowAlert ? "+92%" : tankItem.leakageAlert ? "+55%" : index % 2 ? "+10%" : "-5%";
    const status = tankItem.highFlowAlert ? badge("Ghost Flow", "bad") : tankItem.leakageAlert ? badge("Low Flow", "warn") : badge("Normal", "good");
    const alert = tankItem.highFlowAlert ? "Ghost flow detected" : tankItem.leakageAlert ? "Flow below prescription" : "No flow detected";
    return [
      `PT-${String(index + 1).padStart(4, "0")}`,
      `${tankItem.wardName} / ${tankItem.station}`,
      `${Math.max(1, tankItem.flowRate - 1)} Litre/Min`,
      `${tankItem.flowRate + 0.2} Litre/Min`,
      warning,
      status,
      alert
    ];
  });
  target.innerHTML = tableHtml(["Patient ID", "Ward / Bed", "Prescribed Flow", "Live Flow", "Variance", "Status", "Alert"], rows);
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
    const activeAlerts = ward.tanks.filter(t => t.active && (t.leakageAlert || t.highFlowAlert)).length;
    const critical = ward.tanks.filter(t => t.active && getReportVolumePercent(t) < 10).length;
    const warning = ward.tanks.filter(t => t.active && getReportVolumePercent(t) >= 10 && getReportVolumePercent(t) < 30).length;
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
  const lowest = [...activeTanks].sort((a, b) => getReportVolumePercent(a) - getReportVolumePercent(b))[0];
  const totalFlowValue = wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
  const todayConsumptionLitres = Math.round(totalFlowValue * 60 * 24);
  const yesterdayDelta = formatSignedPercent((todayConsumptionLitres - YESTERDAY_CONSUMPTION_LITRES) / YESTERDAY_CONSUMPTION_LITRES);
  const wastageTodayLitres = Math.round(todayConsumptionLitres * (wastage / 100));
  const insights = [
    ["danger", `${lowest?.name || "Tank B3"} will deplete in`, estimateDepletion(lowest || activeTanks[0] || { volumeRemaining: 120, flowRate: 1 }), "Suggested refill"],
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

function renderRecentActivity(alertRows) {
  const target = document.getElementById("recentActivityList");
  if (!target) return;
  const entries = [
    ["11:01 AM", "danger", `${alertRows[0]?.name || "Tank C1"} alert detected`],
    ["11:02 AM", "good", "Alert notification sent to admin"],
    ["11:03 AM", "blue", "Alert acknowledged by nurse"],
    ["11:06 AM", "good", "Issue resolved in recovery bay"]
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
  updateOperationsReportPanels();
  renderOperationsWasteComparison();

  const report = buildGeneratedReport(selectedReportType);
  target.innerHTML = `
    <div class="generated-report-head">
      <div>
        <span>${report.range}</span>
        <h3>${report.title}</h3>
        <p>${report.description}</p>
      </div>
      <strong>${report.generatedAt}</strong>
    </div>
    <div class="generated-kpis">
      ${report.kpis.map(item => `
        <article>
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </article>
      `).join("")}
    </div>
    <div class="generated-report-body">
      ${tableHtml(report.headers, report.rows)}
      <div class="report-brief">
        <strong>Brief Analysis</strong>
        <ul>${report.brief.map(item => `<li>${item}</li>`).join("")}</ul>
      </div>
    </div>
  `;
}

function renderReportLiveInsights() {
  const depletionTarget = document.getElementById("reportDepletionTable");
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
  const isOperations = selectedReportType === "operations";
  const isCritical = selectedReportType === "critical";
  const hideSupportingReportSections = isCritical || selectedReportType === "wastage" || selectedReportType === "ward";
  const alertTables = document.querySelector(".report-alert-tables");
  const flowCard = document.getElementById("highAbnormalFlowCard");
  const pressureCard = document.getElementById("highAbnormalPressureCard");
  const wasteCard = document.getElementById("operationsWasteComparisonCard");
  const monthlyCard = document.querySelector(".monthly-comparison-card");
  const depletionSection = document.querySelector(".report-live-grid");
  if (alertTables) alertTables.hidden = !isCritical;
  if (flowCard) flowCard.hidden = !isCritical;
  if (pressureCard) pressureCard.hidden = !isCritical;
  if (wasteCard) wasteCard.hidden = !isOperations;
  if (monthlyCard) monthlyCard.hidden = hideSupportingReportSections;
  if (depletionSection) depletionSection.hidden = hideSupportingReportSections;
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
  const selectedValue = document.getElementById("reportStartMonth")?.value || "2026-06";
  const selectedIndex = reportDemoData.findIndex(item => item.month === selectedValue);
  const endIndex = selectedIndex >= 0 ? selectedIndex : reportDemoData.length - 1;
  const startIndex = Math.max(0, endIndex - 2);
  return reportDemoData.slice(startIndex, endIndex + 1);
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
  const periodLabels = {
    today: "Current month",
    "7": "Current month",
    "30": "30-day monthly range",
    quarter: "Quarter",
    ytd: "Year to date"
  };
  const start = document.getElementById("reportStartMonth")?.value || "2026-06";
  const months = getSelectedDemoMonths();
  const first = months[0]?.month || start;
  const last = months[months.length - 1]?.month || start;
  const prefix = periodLabels[selectedReportPeriod] || "Selected month";
  return `${prefix}: ${first} to ${last}`;
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
  const totalFlowValue = wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
  const lowestPercent = Math.min(...activeTanks.map(t => Math.round((t.volumeRemaining * 100) / t.maxVolume)));
  const replacementTanks = tanksUnderVolumePercent(10);
  const replacementCost = replacementTanks.length * TANK_COST;

  document.getElementById("orderDetails").innerHTML = orderDetailRows([
    ["Supplier", "Caribbean Oxygen Ltd."],
    ["Product", replacementTanks.length ? "Replacement Oxygen Tanks" : "Liquid Oxygen (LOX)"],
    ["Quantity", replacementTanks.length ? `${replacementTanks.length} tank${replacementTanks.length === 1 ? "" : "s"}` : "20,000 Liters"],
    ["Order Type", "Automated Replenishment"],
    ["Estimated Cost", replacementTanks.length ? currency(replacementCost) : "JMD 4,950,000.00"],
    ["PO Number", "AUTO-PO-2026-0418-01"],
    ["Order Channel", "EDI"],
    ["Order Status", "Pending Confirmation"]
  ]);

  document.getElementById("capacitySummary").innerHTML = orderDetailRows([
    ["Current Usable Capacity", "8,500 Liters"],
    ["Current Average Flow", `${totalFlowValue} Litre/Min`],
    ["Order Quantity", "20,000 Liters"],
    ["Projected Capacity After Delivery", "28,500 Liters"],
    ["Projected Depletion Date", "~14 May 2026"],
    ["Time Until Next Anticipated Order", "26 days"]
  ]);

  renderReplacementSummary(replacementTanks);
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

  if (!replacementTanks.length) {
    summary.innerHTML = `
      <div class="replacement-empty">
        <strong>No replacement tanks required</strong>
        <span>There are no active tanks below 10% volume.</span>
      </div>
    `;
    return;
  }

  const totalCost = replacementTanks.reduce((sum, tankItem) => sum + tankItem.replacementCost, 0);
  summary.innerHTML = `
    <div class="replacement-total">
      <span>${replacementTanks.length} tank${replacementTanks.length === 1 ? "" : "s"} below 10%</span>
      <strong>${currency(totalCost)}</strong>
    </div>
    ${replacementTanks.map(t => `
      <div class="replacement-row">
        <div>
          <strong>${t.wardName}</strong>
          <span>${t.name} - ${t.serial}</span>
        </div>
        <div>
          <b>${t.volumePercent}%</b>
          <small>${estimateDepletion(t)}</small>
        </div>
        <em>${currency(t.replacementCost)}</em>
      </div>
    `).join("")}
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
      <div class="floorplan-maintenance-dot"></div>
      <div class="floorplan-pipeline main"></div>
      <div class="floorplan-pipeline lower"></div>
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
      <div class="floorplan-offline-dot"></div>
    </div>
  `;
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
