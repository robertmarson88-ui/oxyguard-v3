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
      tank("Tank C1", "C1-OXY-3017", "Station 1", 47, 2),
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
      tank("Tank R1", "R1-OXY-4106", "Bay 1", 48, 4),
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

const TANK_COST = 588000;
const analyticsMonths = ["Jan", "Feb", "Mar", "Apr", "May"];
const analyticsData = [
  { ward: "A&E Ward", accent: colors.ae, usage: [18, 21, 24, 27, 30], leakage: [2, 3, 4, 3, 5] },
  { ward: "Labour Ward", accent: colors.labour, usage: [14, 16, 17, 18, 20], leakage: [1, 2, 2, 3, 2] },
  { ward: "Paediatric Ward", accent: colors.paediatric, usage: [20, 22, 26, 29, 34], leakage: [3, 4, 5, 7, 8] },
  { ward: "Recovery Bay", accent: colors.recovery, usage: [10, 12, 13, 15, 16], leakage: [1, 1, 2, 2, 3] },
  { ward: "Nurse Station", accent: colors.nurse, usage: [4, 5, 5, 6, 7], leakage: [0, 0, 1, 1, 1] }
];

let wards;
let wastage;
let flowIndex;
let flashRed;
let activeView = "dashboard";
let timers = [];
let currentUser = null;

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
  document.getElementById("refreshReport").addEventListener("click", renderReport);
  document.getElementById("refreshAnalytics").addEventListener("click", renderAnalytics);
  document.getElementById("emailReport").addEventListener("click", () => {
    window.alert("Report email was sent to adminService@gmail.com");
  });
  document.getElementById("printReport").addEventListener("click", () => window.print());
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
  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
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
  currentUser = null;
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
  const role = currentUser?.role || "viewer";
  const isAdmin = role === "admin";
  document.querySelectorAll("[data-role-required='admin']").forEach(button => {
    button.hidden = !isAdmin;
  });
  document.getElementById("sidebarUser").innerHTML = currentUser
    ? `<strong>${currentUser.username}</strong><span>${currentUser.label}</span>`
    : "";
  if (!isAdmin && activeView !== "dashboard") {
    setView("dashboard");
  }
}

function resetState() {
  timers.forEach(clearInterval);
  timers = [];
  wards = cloneWards();
  wastage = 3;
  flowIndex = 0;
  flashRed = false;

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
  updateClock();
}

function renderAll() {
  renderWards();
  updateMetrics();
  renderReport();
  renderOrderSummary();
  renderAnalytics();
  updateFooter();
}

function setView(view) {
  if (currentUser?.role !== "admin" && view !== "dashboard") {
    view = "dashboard";
  }
  activeView = view;
  document.querySelectorAll(".view").forEach(section => {
    section.classList.toggle("active-view", section.id === `${view}View`);
  });
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  if (view === "report") renderReport();
  if (view === "order") renderOrderSummary();
  if (view === "analytics") renderAnalytics();
  updatePageTitle();
}

function renderWards() {
  const grid = document.getElementById("wardGrid");
  grid.innerHTML = wards.map(renderWardCard).join("");
  grid.querySelectorAll(".ward-card").forEach(card => {
    card.addEventListener("click", () => openWard(card.dataset.ward));
  });
}

function renderWardCard(ward) {
  const alert = ward.tanks.some(t => t.active && (t.leakageAlert || t.highFlowAlert));
  const flow = totalFlow(ward);
  const pressure = averagePressure(ward);

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
        ${ward.tanks.filter(t => t.active).map(t => renderTankRow(t)).join("")}
      </div>
      <footer class="ward-summary">Average Pressure: ${pressure} PSI | Total Flow: ${flow} L/min</footer>
    </article>
  `;
}

function renderTankRow(t) {
  const alert = t.leakageAlert || t.highFlowAlert;
  const arrowColor = !t.active || t.flowRate <= 0 ? colors.grey : alert ? colors.red : colors.green;
  const status = t.alertMessage || (t.highFlowAlert ? "High Abnormal Flow Rate" : t.leakageAlert ? "Wastage Alert" : t.flowRate <= 0 ? "No oxygen" : t.occupied ? "Stable" : "Monitor");

  return `
    <div class="tank-row ${alert ? "alert" : ""} ${alert && flashRed ? "flash" : ""}">
      <div>
        <div class="tank-name">${t.name}</div>
        <div class="tank-meta">
          <span>Serial #: ${t.serial}</span>
          <span>Pressure: ${t.pressure} PSI</span>
          <span>Flow Rate: ${t.flowRate} L/min</span>
          <span>Volume: ${t.volumeRemaining} / ${t.maxVolume} L</span>
        </div>
      </div>
      <div class="flow-arrow" style="--arrow-color:${arrowColor}">
        ${t.flowRate > 0 ? '<span class="pulse"></span>' : ""}
      </div>
      <div class="tank-detail">
        <span>${t.station}</span>
        <span>Pressure: ${t.pressure} PSI</span>
        <span>Flow Rate: ${t.stationFlowRate} L/min</span>
        <span>${status}</span>
      </div>
    </div>
  `;
}

function updateMetrics() {
  const active = wards.flatMap(w => w.tanks).filter(t => t.active).length;
  document.getElementById("activePatients").textContent = active;
  document.getElementById("wastage").textContent = `${wastage}%`;

  const lowVolume = wards.flatMap(w => w.tanks)
    .map(t => ({ name: t.name, percent: Math.round((t.volumeRemaining * 100) / t.maxVolume) }))
    .filter(t => t.percent < 15);
  const lowVolumeEl = document.getElementById("lowVolume");
  lowVolumeEl.classList.toggle("low-volume-list", lowVolume.length > 0);
  lowVolumeEl.innerHTML = lowVolume.length ? renderLowVolumeList(lowVolume) : "None";
  lowVolumeEl.style.color = lowVolume.length ? colors.red : colors.green;

  const flowWard = wards[flowIndex % wards.length];
  document.getElementById("rotatingWard").textContent = flowWard.name;
  document.getElementById("rotatingWard").style.color = flowWard.accent;
  document.getElementById("rotatingFlow").textContent = `${totalFlow(flowWard)} L/min`;
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
      t.volumeRemaining = Math.max(0, t.volumeRemaining - t.flowRate);
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
      return `<div class="detail-row"><span>${t.name}<br><small>${t.serial}</small></span><span>${t.station}</span><span>${t.pressure} PSI</span><span>${t.flowRate} L/min</span><span>${status}</span></div>`;
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
  currentUserElement.innerHTML = currentUser
    ? `<span>Logged in as</span><strong>${currentUser.username} - ${currentUser.label}</strong>`
    : "";
}

function updatePageTitle() {
  const titles = {
    dashboard: "OXYGUARD MONITORING DASHBOARD",
    report: "OXYGEN USAGE REPORT",
    order: "ORDER SUMMARY",
    analytics: "CALL ANALYTICS"
  };
  document.querySelector(".topbar h1").textContent = titles[activeView] || titles.dashboard;
}

function renderReport() {
  const generated = document.getElementById("reportGenerated");
  if (!generated) return;

  const now = new Date();
  generated.textContent = `Generated: ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

  const allTanks = wards.flatMap(ward => ward.tanks.map(t => ({ ...t, wardName: ward.name, wardId: ward.id })));
  const activeTanks = allTanks.filter(t => t.active);
  const alertRows = activeTanks.filter(t => t.leakageAlert || t.highFlowAlert);
  const avgPressure = Math.round(activeTanks.reduce((sum, t) => sum + t.pressure, 0) / Math.max(1, activeTanks.length));
  const totalFlowValue = wards.reduce((sum, ward) => sum + totalFlow(ward), 0);
  const lowestVolume = Math.min(...activeTanks.map(t => Math.round((t.volumeRemaining * 100) / t.maxVolume)));
  const dailyTankUsed = allTanks.filter(t => t.active || t.volumeRemaining < t.maxVolume).length;

  document.getElementById("reportSummary").innerHTML = [
    reportSummaryCard("Active Tanks", activeTanks.length, "Currently in service", colors.ae),
    reportSummaryCard("Tanks Used Today", dailyTankUsed, "Daily oxygen tank activity", colors.labour),
    reportSummaryCard("Total Flow", `${totalFlowValue} L/min`, "Across all wards", colors.green),
    reportSummaryCard("Average Pressure", `${avgPressure} PSI`, "Active tank average", colors.ae),
    reportSummaryCard("Estimated Wastage", `${wastage}%`, "Current system estimate", alertRows.length ? colors.red : colors.green),
    reportSummaryCard("Leakage Alerts", alertRows.length || "None", alertRows.length ? "Requires investigation" : "No active alerts", alertRows.length ? colors.red : colors.green),
    reportSummaryCard("Lowest Volume", `${lowestVolume}%`, "Lowest active tank level", lowestVolume < 15 ? colors.red : colors.green)
  ].join("");

  renderCharts(activeTanks);
  renderHospitalHeatMap();

  document.getElementById("wardUsageTable").innerHTML = tableHtml(
    ["Ward", "Total Tanks Used", "Total Flow", "Avg Pressure", "Status"],
    wards.map(ward => {
      const alerts = ward.tanks.some(t => t.active && (t.leakageAlert || t.highFlowAlert));
      const tanksUsed = ward.tanks.filter(t => t.active || t.volumeRemaining < t.maxVolume).length;
      return [
        ward.name,
        tanksUsed,
        `${totalFlow(ward)} L/min`,
        `${averagePressure(ward)} PSI`,
        alerts ? badge("Alert", "bad") : badge("Stable", "good")
      ];
    })
  );

  document.getElementById("leakageTable").innerHTML = tableHtml(
    ["Ward", "Tank", "Station", "Alert", "Flow"],
    alertRows.length ? alertRows.map(t => [
      t.wardName,
      t.name,
      t.station,
      t.highFlowAlert ? "High abnormal flow" : "Wastage alert",
      `${t.flowRate} L/min`
    ]) : [["No active leakage alerts", "-", "-", badge("Clear", "good"), "-"]]
  );

  document.getElementById("depletionTable").innerHTML = tableHtml(
    ["Ward", "Tank", "Serial #", "Flow", "Volume", "Est. Depletion", "Status"],
    activeTanks.map(t => {
      const percent = Math.round((t.volumeRemaining * 100) / t.maxVolume);
      const status = t.highFlowAlert ? badge("High Flow", "bad") : t.leakageAlert ? badge("Wastage", "bad") : percent < 15 ? badge("Low Volume", "warn") : badge("Normal", "good");
      return [
        t.wardName,
        t.name,
        t.serial,
        `${t.flowRate} L/min`,
        `${t.volumeRemaining} L (${percent}%)`,
        estimateDepletion(t),
        status
      ];
    })
  );
}

function renderCharts(activeTanks) {
  renderWardFlowChart();
  renderTankVolumeChart(activeTanks);
  renderAlertDistributionChart();
}

function renderWardFlowChart() {
  const maxFlow = Math.max(1, ...wards.map(totalFlow));
  document.getElementById("wardFlowChart").innerHTML = wards.map(ward => {
    const flow = totalFlow(ward);
    const width = Math.max(4, Math.round((flow / maxFlow) * 100));
    return `
      <div class="bar-row">
        <span>${ward.name}</span>
        <div class="bar-track"><i style="width:${width}%; background:${ward.accent}"></i></div>
        <b>${flow} L/min</b>
      </div>
    `;
  }).join("");
}

function renderTankVolumeChart(activeTanks) {
  const sorted = [...activeTanks].sort((a, b) => {
    const aPercent = a.volumeRemaining / a.maxVolume;
    const bPercent = b.volumeRemaining / b.maxVolume;
    return aPercent - bPercent;
  });
  document.getElementById("tankVolumeChart").innerHTML = sorted.map(t => {
    const percent = Math.round((t.volumeRemaining * 100) / t.maxVolume);
    const tone = percent < 15 ? colors.red : percent < 30 ? colors.yellow : colors.green;
    const hoverText = `${t.name} belongs to ${t.wardName}`;
    return `
      <div class="bar-row" title="${hoverText}">
        <span title="${hoverText}">${t.name} - ${t.wardName}</span>
        <div class="bar-track" title="${hoverText}"><i style="width:${percent}%; background:${tone}"></i></div>
        <b>${percent}%</b>
      </div>
    `;
  }).join("");
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
    ["Current Total Flow", `${totalFlowValue} L/min`],
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
  const alertCounts = wards.map(ward => ({
    name: ward.name,
    accent: ward.accent,
    count: ward.tanks.filter(t => t.active && (t.leakageAlert || t.highFlowAlert)).length
  }));
  const totalAlerts = alertCounts.reduce((sum, item) => sum + item.count, 0);
  const maxAlerts = Math.max(1, ...alertCounts.map(item => item.count));
  document.getElementById("alertChart").innerHTML = `
    <div class="alert-total ${totalAlerts ? "bad" : "good"}">
      <strong>${totalAlerts}</strong>
      <span>${totalAlerts === 1 ? "active alert" : "active alerts"}</span>
    </div>
    <div class="alert-bars">
      ${alertCounts.map(item => {
        const height = Math.max(8, Math.round((item.count / maxAlerts) * 92));
        return `
          <div class="alert-bar">
            <div class="alert-column"><i style="height:${height}px; background:${item.count ? colors.red : item.accent}"></i></div>
            <b>${item.count}</b>
            <span>${item.name.replace(" Ward", "")}</span>
          </div>
        `;
      }).join("")}
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
  const hospitalZones = [
    { label: "Emergency Entrance", className: "support entrance", meta: "triage access" },
    { label: "A&E Ward", className: "ward ae", ward: wards[0] },
    { label: "Diagnostics / Imaging", className: "support diagnostics", meta: "x-ray / lab" },
    { label: "Main Corridor", className: "corridor main-corridor", meta: "pipeline spine" },
    { label: "Nurses' Station", className: "support nurses", meta: "ward control" },
    { label: "Labour Ward", className: "ward labour", ward: wards[1] },
    { label: "Pharmacy", className: "support pharmacy", meta: "medication" },
    { label: "Paediatric Ward", className: "ward paediatric", ward: wards[2] },
    { label: "Recovery Bay", className: "ward recovery", ward: wards[3] },
    { label: "Nurse Station", className: "ward nurse", ward: wards[4] },
    { label: "Service Corridor", className: "corridor service-corridor", meta: "rear access" }
  ];

  heatMap.innerHTML = hospitalZones.map(zone => {
    if (!zone.ward) {
      return `<div class="heat-zone ${zone.className}"><strong>${zone.label}</strong><small>${zone.meta}</small></div>`;
    }

    const flow = totalFlow(zone.ward);
    const ratio = flow / maxFlow;
    const level = ratio >= 0.7 ? "high" : ratio >= 0.38 ? "medium" : "low";
    const alerts = zone.ward.tanks.filter(t => t.active && (t.leakageAlert || t.highFlowAlert)).length;
    const active = zone.ward.tanks.filter(t => t.active).length;
    return `
      <div class="heat-zone ${zone.className} ${level} ${alerts ? "has-alert" : ""}">
        <strong>${zone.label}</strong>
        <small>${flow} L/min | ${active} tanks active</small>
        <span>${level.toUpperCase()} USAGE</span>
      </div>
    `;
  }).join("");
}

function reportSummaryCard(title, value, status, color) {
  return `
    <article class="summary-card">
      <span>${title}</span>
      <strong style="color:${color}">${value}</strong>
      <small>${status}</small>
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
