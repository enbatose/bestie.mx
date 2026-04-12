import type { DatabaseSync } from "node:sqlite";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { listingsRouter } from "./listingsRouter.js";
import { myListingsHandler } from "./myListingsHandler.js";
import { propertiesRouter } from "./propertiesRouter.js";

export type CreateAppOptions = {
  /** When omitted, uses the same default list as `index.ts`. */
  corsOrigins?: string[];
  /** Shown in `GET /api/health` (e.g. SQLite file name). */
  databaseLabel?: string;
};

export function createApp(db: DatabaseSync, opts: CreateAppOptions = {}): express.Application {
  const databaseLabel = opts.databaseLabel ?? "in-process";
  const corsOrigins =
    opts.corsOrigins ??
    (process.env.CORS_ORIGINS ?? "http://localhost:5173,https://bestie.mx,https://www.bestie.mx")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

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

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, service: "bestie-mx-api", database: databaseLabel });
  });

  app.get("/api/my-listings", myListingsHandler(db));
  app.use("/api/listings", listingsRouter(db));
  app.use("/api/properties", propertiesRouter(db));

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found" });
  });

  return app;
}
