import path from "node:path";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { openDb } from "./db.js";
import { listingsRouter } from "./listingsRouter.js";

const PORT = Number(process.env.PORT) || 3000;
const rawDbPath = process.env.DATABASE_PATH;
const databasePath = rawDbPath
  ? path.isAbsolute(rawDbPath)
    ? rawDbPath
    : path.resolve(process.cwd(), rawDbPath)
  : path.resolve(process.cwd(), "data", "bestie.db");

const corsOrigins = (process.env.CORS_ORIGINS ??
  "http://localhost:5173,https://bestie.mx,https://www.bestie.mx")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const db = openDb(databasePath);
const app = express();
app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(
  cors({
    origin: corsOrigins,
  }),
);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "bestie-mx-api", database: path.basename(databasePath) });
});

app.use("/api/listings", listingsRouter(db));

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "not_found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`bestie.mx API listening on 0.0.0.0:${PORT}`);
  console.log(`SQLite: ${databasePath}`);
});
