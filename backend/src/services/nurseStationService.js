import { readFile } from "node:fs/promises";

export async function readNurseStationData(nurseStationDataPath) {
  try {
    const body = await readFile(nurseStationDataPath, "utf8");
    return parseNurseStationData(body);
  } catch {
    return getDefaultNurseStationData();
  }
}

function parseNurseStationData(body) {
  const data = getDefaultNurseStationData();

  body.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separator = trimmed.includes("=") ? "=" : trimmed.includes(":") ? ":" : "";
    if (!separator) return;

    const key = trimmed.slice(0, trimmed.indexOf(separator)).trim();
    const value = trimmed.slice(trimmed.indexOf(separator) + 1).trim();

    if (["flowRate", "pressure", "volumeRemaining", "stationFlowRate"].includes(key)) {
      data[key] = Number(value);
    } else if (key === "maxVolume") {
      data.maxVolume = Number(value);
    } else if (key === "active" || key === "occupied") {
      data[key] = value === "true" || value === "1" || value.toLowerCase() === "yes";
    } else if (key === "updatedAt") {
      data.updatedAt = value;
    }
  });

  if (!Number.isFinite(data.stationFlowRate)) data.stationFlowRate = data.flowRate;
  return data;
}

function getDefaultNurseStationData() {
  return {
    active: true,
    occupied: true,
    flowRate: 7,
    pressure: 48,
    volumeRemaining: 960,
    maxVolume: 1200,
    stationFlowRate: 7,
    updatedAt: new Date().toISOString()
  };
}
