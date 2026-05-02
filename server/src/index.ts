import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";
import { logOutboundMailHintIfDisabled, verifySmtpConnection } from "./mailer.js";

/** When `index.html` exists, API + SPA share one origin (see `createApp` `webDistDir`). */
function resolveWebDistDir(): string | undefined {
  const raw = process.env.WEB_DIST_DIR?.trim();
  /** `dist/index.js` lives in `server/dist/`; Vite output is sibling `../dist` from `server/`. */
  const serverPackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const candidate = raw
    ? path.isAbsolute(raw)
      ? raw
      : path.resolve(process.cwd(), raw)
    : path.resolve(serverPackageRoot, "..", "dist");
  return fs.existsSync(path.join(candidate, "index.html")) ? candidate : undefined;
}

function resolveListenPort(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) {
    // Railway injects PORT at runtime; if it is missing, web healthchecks still target 8080 by default.
    const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID);
    return onRailway ? 8080 : 3000;
  }
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : 3000;
}

const PORT = resolveListenPort();

/** Prefer env path; if that directory is not writable (e.g. /data without a volume), use ./data/bestie.db */
function resolveWritableDatabasePath(): string {
  const raw = process.env.DATABASE_PATH;
  const primary =
    raw != null && raw !== ""
      ? path.isAbsolute(raw)
        ? raw
        : path.resolve(process.cwd(), raw)
      : path.resolve(process.cwd(), "data", "bestie.db");

  try {
    fs.mkdirSync(path.dirname(primary), { recursive: true });
    fs.accessSync(path.dirname(primary), fs.constants.W_OK);
    return primary;
  } catch (err) {
    const fallback = path.resolve(process.cwd(), "data", "bestie.db");
    console.warn(
      `[db] Could not use ${primary} (${err instanceof Error ? err.message : String(err)}); using ${fallback}`,
    );
    fs.mkdirSync(path.dirname(fallback), { recursive: true });
    return fallback;
  }
}

const databasePath = resolveWritableDatabasePath();
const instanceId =
  process.env.RAILWAY_SERVICE_INSTANCE_ID?.trim() ||
  process.env.RENDER_INSTANCE_ID?.trim() ||
  process.env.FLY_ALLOC_ID?.trim() ||
  randomUUID().slice(0, 12);

const corsOrigins = (process.env.CORS_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://bestie.mx,https://www.bestie.mx")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const db = openDb(databasePath);

const webDistDir = resolveWebDistDir();

const app = createApp(db, {
  corsOrigins,
  databaseLabel: path.basename(databasePath),
  databasePath,
  instanceId,
  ...(webDistDir ? { webDistDir } : {}),
});

/** When set, bind this host; otherwise use Node’s default (dual-stack when the OS supports it). */
const listenHost = process.env.LISTEN_HOST?.trim();

const server = http.createServer(app);
server.on("error", (err) => {
  console.error("[boot] HTTP server failed to bind:", err);
  process.exit(1);
});
if (listenHost) {
  server.listen(PORT, listenHost, onListen);
} else {
  // No host → Node picks :: or 0.0.0.0; avoids IPv4-only bind missing Railway’s IPv6 probes.
  server.listen(PORT, onListen);
}

function onListen() {
  console.log(
    `[boot] PORT env=${process.env.PORT ?? "(unset)"} bind=${listenHost ?? "(node default)"} → listening on ${PORT}`,
  );
  console.log(`bestie.mx API listening on port ${PORT}`);
  console.log(`SQLite: ${databasePath}`);
  if (webDistDir) {
    console.log(`[web] SPA + API same origin from ${webDistDir}`);
  }
  logOutboundMailHintIfDisabled();
  void verifySmtpConnection();
}
