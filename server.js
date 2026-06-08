import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

await loadLocalEnv();

const port = Number(process.env.PORT || 4180);
const root = process.cwd();
const nurseStationDataPath = join(process.env.USERPROFILE || "C:\\Users\\twcl.ssa", "Desktop", "data.txt");
const users = {
  user1: { password: "password1", role: "admin", label: "Administrator", email: process.env.OXYGUARD_AUTH_EMAIL || "robertmarson88@gmail.com" },
  user2: { password: "password2", role: "admin", label: "Administrator", email: process.env.OXYGUARD_AUTH_EMAIL || "robertmarson88@gmail.com" },
  vernon: { password: "vernon1", role: "admin", label: "Administrator", email: "vernon.dacosta@gmail.com" },
  martin: { password: "martin1", role: "admin", label: "Administrator", email: "robinsonmartin187@gmail.com" }
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === "POST" && url.pathname === "/api/login") {
      const { username, password } = await readJson(req);
      const normalizedUsername = String(username || "").trim();
      const user = users[normalizedUsername];

      if (!user || user.password !== password) {
        sendJson(res, 401, { ok: false, message: "Invalid username or password." });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        user: {
          username: normalizedUsername,
          role: user.role,
          label: user.label
        }
      });
      return;
    }

    if (url.pathname === "/api/nurse-station") {
      const body = await readFile(nurseStationDataPath, "utf8");
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(parseNurseStationData(body)));
      return;
    }

    const target = normalize(join(root, url.pathname === "/" ? "index.html" : url.pathname));
    if (!target.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, { "content-type": types[extname(target)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, () => {
  console.log(`OxyGuard web dashboard running at http://127.0.0.1:${port}`);
});

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

async function loadLocalEnv() {
  try {
    const body = await readFile(join(process.cwd(), ".env"), "utf8");
    body.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separator = trimmed.indexOf("=");
      if (separator === -1) return;
      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      if (!key || process.env[key]) return;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    });
  } catch {
    // .env is optional; the server also accepts normal environment variables.
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function parseNurseStationData(body) {
  const data = {
    flowRate: 7,
    pressure: 48,
    volumeRemaining: 960,
    stationFlowRate: 7,
    occupied: true,
    active: true
  };

  body.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [rawKey, rawValue] = trimmed.split("=");
    if (!rawKey || rawValue === undefined) return;
    const key = rawKey.trim();
    const value = rawValue.trim();
    if (["flowRate", "pressure", "volumeRemaining", "stationFlowRate"].includes(key)) {
      data[key] = Number(value);
    } else if (["active", "occupied"].includes(key)) {
      data[key] = value.toLowerCase() === "true";
    }
  });

  if (!Number.isFinite(data.stationFlowRate)) data.stationFlowRate = data.flowRate;
  return data;
}
