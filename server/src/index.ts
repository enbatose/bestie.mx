import fs from "node:fs";
import path from "node:path";
import { createApp } from "./appFactory.js";
import { openDb } from "./db.js";

const PORT = Number(process.env.PORT) || 3000;

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

const corsOrigins = (process.env.CORS_ORIGINS ??
  "http://localhost:5173,https://bestie.mx,https://www.bestie.mx")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const db = openDb(databasePath);

const app = createApp(db, {
  corsOrigins,
  databaseLabel: path.basename(databasePath),
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`bestie.mx API listening on 0.0.0.0:${PORT}`);
  console.log(`SQLite: ${databasePath}`);
});
