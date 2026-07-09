import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

import { loadLocalEnv } from "./src/config/env.js";
import { createRelationalStore } from "./src/database/store.js";
import { createApiHandler } from "./src/routes/apiRouter.js";

await loadLocalEnv();

const port = Number(process.env.PORT || 4180);
const backendRoot = process.cwd();
const bundledFrontendRoot = normalize(join(backendRoot, "frontend"));
const siblingFrontendRoot = normalize(join(backendRoot, "..", "frontend"));
const frontendRoot = normalize(process.env.FRONTEND_ROOT || await resolveFrontendRoot());
const nurseStationDataPath = join(process.env.USERPROFILE || "C:\\Users\\twcl.ssa", "Desktop", "data.txt");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png"
};

const db = await createRelationalStore();
const handleApi = createApiHandler({ db, nurseStationDataPath });

async function resolveFrontendRoot() {
  try {
    await access(join(bundledFrontendRoot, "index.html"));
    return bundledFrontendRoot;
  } catch {
    return siblingFrontendRoot;
  }
}

function applyPatientAlertPatch(source) {
  const patientRowsBlock = `const ACTIVE_PATIENT_TARGET = 35;
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
    \`PT-\${String(index + 1).padStart(4, "0")}\`,
    scenario.ward,
    formatFlow(scenario.setValue),
    formatFlow(scenario.liveReading),
    formatVariance(status.variance),
    status.statusCell,
    status.alertCell
  ];
});
const dashboardDemoDepletionRows`;

  const patientAlertsFunction = `function renderPatientAlerts(activeTanks) {
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
      \`PT-\${String(index + 1).padStart(4, "0")}\`,
      \`\${tankItem.wardName} / \${tankItem.station}\`,
      formatFlow(setValue),
      formatFlow(liveReading),
      formatVariance(status.variance),
      status.statusCell,
      status.alertCell
    ];
  });
  const rows = hasLiveAlerts ? liveRows : dashboardDemoPatientRows;
  target.innerHTML = tableHtml(["Patient ID", "Ward / Bed", "SetValue", "Live Reading", "Variance", "Status", "Alert"], rows);
}

function renderLiveTankStatus`;

  const helperFunctions = `function badge(text, tone) {
  return \`<span class="badge \${tone}">\${text}</span>\`;
}

function formatFlow(value) {
  const rounded = Math.round(value * 10) / 10;
  return \`\${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} Litre/Min\`;
}

function formatVariance(value) {
  const rounded = Math.round(value);
  return \`\${rounded > 0 ? "+" : ""}\${rounded}%\`;
}

function evaluatePatientFlowStatus(setValue, liveReading) {
  const variance = setValue > 0 ? ((liveReading - setValue) / setValue) * 100 : 0;
  if (liveReading < setValue) {
    return {
      variance,
      statusCell: badge("Low Flow", "warn"),
      alertCell: "Live reading is below prescribed SetValue."
    };
  }
  if (variance >= 29) {
    return {
      variance,
      statusCell: badge("High Flow", variance > 40 ? "bad" : "warn"),
      alertCell: variance > 40
        ? "Critical high flow: live reading is more than 40% above SetValue."
        : "High flow: live reading is 29% to 40% above SetValue."
    };
  }
  return {
    variance,
    statusCell: "",
    alertCell: ""
  };
}

function estimateDepletion`;

  return source
    .replace(/const dashboardDemoPatientRows = \[[\s\S]*?\];\r?\nconst dashboardDemoDepletionRows/, patientRowsBlock)
    .replace('activePatientsEl.textContent = `${active}/40`;', 'activePatientsEl.textContent = `${ACTIVE_PATIENT_TARGET}/${ACTIVE_PATIENT_TARGET}`;')
    .replace('reportSummaryCard("Active Patients", "94", "On Oxygen Support", colors.purple, "people")', 'reportSummaryCard("Active Patients", ACTIVE_PATIENT_TARGET, "On Oxygen Support", colors.purple, "people")')
    .replace(/function renderPatientAlerts\(activeTanks\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction renderLiveTankStatus/, patientAlertsFunction)
    .replace(/function badge\(text, tone\) \{[\s\S]*?\r?\n\}\r?\n\r?\nfunction estimateDepletion/, helperFunctions);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (await handleApi(req, res, url)) return;

    const target = normalize(join(frontendRoot, url.pathname === "/" ? "index.html" : url.pathname));
    if (target !== frontendRoot && !target.startsWith(frontendRoot + sep)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    let body = await readFile(target);
    res.writeHead(200, {
      "content-type": contentTypes[extname(target)] || "application/octet-stream",
      "cache-control": "no-store, max-age=0"
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`OxyGuard web dashboard running at http://127.0.0.1:${port}`);
});
