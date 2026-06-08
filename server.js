import { createServer } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

await loadLocalEnv();

const port = Number(process.env.PORT || 4180);
const root = process.cwd();
const nurseStationDataPath = join(process.env.USERPROFILE || "C:\\Users\\twcl.ssa", "Desktop", "data.txt");
const codeTtlMs = 5 * 60 * 1000;
const users = {
  user1: { password: "password1", role: "admin", label: "Administrator", email: process.env.OXYGUARD_AUTH_EMAIL || "robertmarson88@gmail.com" },
  user2: { password: "password2", role: "admin", label: "Administrator", email: process.env.OXYGUARD_AUTH_EMAIL || "robertmarson88@gmail.com" },
  vernon: { password: "vernon1", role: "admin", label: "Administrator", email: "vernon.dacosta@gmail.com" },
  martin: { password: "martin1", role: "admin", label: "Administrator", email: "robinsonmartin187@gmail.com" }
};
const pendingCodes = new Map();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === "POST" && url.pathname === "/api/login/request-code") {
      const { username, password } = await readJson(req);
      const user = users[String(username || "").trim()];

      if (!user || user.password !== password) {
        sendJson(res, 401, { ok: false, message: "Invalid username or password." });
        return;
      }

      const code = String(randomInt(100000, 1000000));
      const challengeId = randomUUID();
      pendingCodes.set(challengeId, {
        username: String(username).trim(),
        code,
        expiresAt: Date.now() + codeTtlMs
      });

      const delivery = await sendAuthEmail(user.email, code);
      if (!delivery.sent) {
        pendingCodes.delete(challengeId);
        sendJson(res, 503, {
          ok: false,
          message: delivery.message || "Email delivery is not configured. Add an email API key before requesting a code."
        });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        challengeId,
        email: maskEmail(user.email),
        message: "Email code sent."
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/login/verify-code") {
      const { challengeId, code } = await readJson(req);
      const pending = pendingCodes.get(challengeId);

      if (!pending || pending.expiresAt < Date.now()) {
        pendingCodes.delete(challengeId);
        sendJson(res, 401, { ok: false, message: "The auth code expired. Send password again." });
        return;
      }

      if (pending.code !== String(code || "").trim()) {
        sendJson(res, 401, { ok: false, message: "Invalid email auth code." });
        return;
      }

      pendingCodes.delete(challengeId);
      const user = users[pending.username];
      sendJson(res, 200, {
        ok: true,
        user: {
          username: pending.username,
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

async function sendAuthEmail(to, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OXYGUARD_EMAIL_FROM || "OxyGuard <onboarding@resend.dev>";
  const message = `Your OxyGuard login code is ${code}. It expires in 5 minutes.`;

  if (!apiKey) {
    console.log("[OxyGuard email not sent] RESEND_API_KEY is not configured.");
    return { sent: false, message: "Email delivery is not configured. Add an email API key before requesting a code." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Your OxyGuard login code",
      text: message
    })
  });

  if (!response.ok) {
    const details = await response.text();
    console.log(`[OxyGuard email failed] ${response.status}: ${details}`);
    return { sent: false, message: emailFailureMessage(details) };
  }

  return { sent: true };
}

function emailFailureMessage(details) {
  try {
    const parsed = JSON.parse(details);
    if (parsed.message?.includes("You can only send testing emails")) {
      return "Resend is in testing mode. Verify a domain in Resend before sending codes to this user's email address.";
    }
    return parsed.message || "Email delivery failed. Check your Resend sender settings.";
  } catch {
    return "Email delivery failed. Check your Resend sender settings.";
  }
}

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
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
