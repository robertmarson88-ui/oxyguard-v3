import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

import { loadLocalEnv } from "./src/config/env.js";
import { createRelationalStore } from "./src/database/store.js";
import { createApiHandler } from "./src/routes/apiRouter.js";

await loadLocalEnv();

const port = Number(process.env.PORT || 4180);
const backendRoot = process.cwd();
const frontendRoot = normalize(process.env.FRONTEND_ROOT || join(backendRoot, "..", "frontend"));
const nurseStationDataPath = join(process.env.USERPROFILE || "C:\\Users\\twcl.ssa", "Desktop", "data.txt");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png"
};

const db = createRelationalStore();
const handleApi = createApiHandler({ db, nurseStationDataPath });

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

    const body = await readFile(target);
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
