import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function loadLocalEnv() {
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
    // Local .env support is optional; production can provide normal environment variables.
  }
}
