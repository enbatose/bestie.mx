import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";
import { logOutboundMailHintIfDisabled, verifySmtpConnection } from "./mailer.js";

/** When `index.html` exists, API + SPA share one origin (see `createApp` `webDistDir`). */
function resolveWebDistDir(): string | undefined {
  const raw = process.env.WEB_DIST_DIR?.trim();
  const candidate = raw
    ? path.isAbsolute(raw)
      ? raw
      : path.resolve(process.cwd(), raw)
    : path.resolve(process.cwd(), "..", "dist");
  return fs.existsSync(path.join(candidate, "index.html")) ? candidate : undefined;
}

function resolveListenPort(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) return 3000;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : 3000;
}

const PORT = resolveListenPort();

/** On Railway, probes may use IPv6; binding only 0.0.0.0 can yield failing healthchecks. Override with LISTEN_HOST if needed. */
function resolveListenHost(): string {
  const override = process.env.LISTEN_HOST?.trim();
  if (override) return override;
  return process.env.RAILWAY_ENVIRONMENT ? "::" : "0.0.0.0";
}

const LISTEN_HOST = resolveListenHost();

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

app.listen(PORT, LISTEN_HOST, () => {
  console.log(`bestie.mx API listening on ${LISTEN_HOST}:${PORT}`);
  console.log(`SQLite: ${databasePath}`);
  if (webDistDir) {
    console.log(`[web] SPA + API same origin from ${webDistDir}`);
  }
  logOutboundMailHintIfDisabled();
  void verifySmtpConnection();
});
