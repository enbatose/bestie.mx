import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { adminRouter } from "./adminRouter.js";
import { analyticsRouter } from "./analyticsRouter.js";
import { authRouter } from "./authRouter.js";
import { complianceRouter } from "./complianceRouter.js";
import { groupsRouter } from "./groupsRouter.js";
import { listingsRouter } from "./listingsRouter.js";
import { messagesRouter } from "./messagesRouter.js";
import { messengerWebhookPost, messengerWebhookVerify } from "./messengerWebhook.js";
import { myListingsHandler } from "./myListingsHandler.js";
import { propertiesRouter } from "./propertiesRouter.js";
import { uploadsRouter } from "./uploadsRouter.js";

export type CreateAppOptions = {
  /** When omitted, uses the same default list as `index.ts`. */
  corsOrigins?: string[];
  /** Shown in `GET /api/health` (e.g. SQLite file name). */
  databaseLabel?: string;
  /**
   * Absolute path to the Vite `dist` folder (must contain `index.html`).
   * When set, the API process also serves the SPA and assets on the same origin so
   * `POST /api/...` hits Express instead of a static CDN returning 405.
   */
  webDistDir?: string;
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

  app.get("/api/messenger/webhook", messengerWebhookVerify);
  app.post(
    "/api/messenger/webhook",
    express.raw({ type: "application/json", limit: "4mb" }),
    (req, res, next) => {
      void messengerWebhookPost(db)(req, res).catch(next);
    },
  );

  app.get("/api/my-listings", myListingsHandler(db));
  app.use("/api/listings", listingsRouter(db));
  app.use("/api/properties", propertiesRouter(db));

  const uploadDir =
    process.env.UPLOAD_DIR != null && process.env.UPLOAD_DIR.trim() !== ""
      ? path.resolve(process.env.UPLOAD_DIR.trim())
      : path.resolve(process.cwd(), "data", "uploads");
  app.use("/api/uploads", uploadsRouter({ uploadDir }));

  app.use("/api/auth", authRouter(db));
  app.use("/api/messages", messagesRouter(db));
  app.use("/api/admin", adminRouter(db));
  app.use("/api/groups", groupsRouter(db));
  app.use("/api/analytics", analyticsRouter(db));
  app.use("/api/compliance", complianceRouter());

  const spaDist = opts.webDistDir?.trim();
  if (spaDist) {
    const absDist = path.resolve(spaDist);
    const indexHtml = path.join(absDist, "index.html");
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(absDist, { index: false }));
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
          next();
          return;
        }
        if (req.path.startsWith("/api") || req.path === "/health") {
          next();
          return;
        }
        res.sendFile(indexHtml, (err) => {
          if (err) next(err);
        });
      });
    }
  }

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found" });
  });

  return app;
}
