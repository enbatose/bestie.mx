import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { openDb } from "./db.js";
import { listingsRouter } from "./listingsRouter.js";
import { myListingsHandler } from "./myListingsHandler.js";

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

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Before DB + CORS so Railway healthchecks always get 200 even if SQLite init is slow or misconfigured.
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).type("text/plain").send("ok");
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  }),
);

const db = openDb(databasePath);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "bestie-mx-api", database: path.basename(databasePath) });
});

app.get("/api/my-listings", myListingsHandler(db));

app.use("/api/listings", listingsRouter(db));

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "not_found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`bestie.mx API listening on 0.0.0.0:${PORT}`);
  console.log(`SQLite: ${databasePath}`);
});
