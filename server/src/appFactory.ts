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
import { locationSearchHandler } from "./locationSearch.js";
import { messagesRouter } from "./messagesRouter.js";
import { notificationsRouter } from "./notificationsRouter.js";
import { messengerWebhookPost, messengerWebhookVerify } from "./messengerWebhook.js";
import { getResendInboundDiagnostics, resendWebhookPost } from "./resendWebhook.js";
import { myListingsHandler } from "./myListingsHandler.js";
import { propertiesRouter } from "./propertiesRouter.js";
import { savedSearchesRouter } from "./savedSearchesRouter.js";
import { uploadsRouter } from "./uploadsRouter.js";
import {
  getSmtpDiagnostics,
  getSmtpMode,
  OUTBOUND_SMTP_SETUP_HINT,
  smtpConfigured,
} from "./mailer.js";
import { backupRouter } from "./backup/backupRouter.js";
import { resolveUploadDir } from "./dataPaths.js";
import { injectFacebookAppId, injectListingShareOg, resolveListingShareOg } from "./listingShareOg.js";
import { sharePreviewBaseUrl } from "./publicBaseUrl.js";
import { injectRouteSeo, resolveRouteSeo } from "./routeSeo.js";
import { shareOgImageRouter } from "./shareOgImageRouter.js";
import { shareAiCopyRouter } from "./shareAiCopyRouter.js";
import { buildSitemapXml } from "./sitemap.js";
import { bindUsageAnalyticsDb } from "./usageAnalytics.js";

function normalizeCorsOrigins(origins: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of origins) {
    const o = raw.trim().replace(/\/+$/, "");
    if (!o || seen.has(o)) continue;
    seen.add(o);
    out.push(o);
  }
  return out;
}

export type CreateAppOptions = {
  /** When omitted, uses the same default list as `index.ts`. */
  corsOrigins?: string[];
  /** Label used in admin health diagnostics (e.g. SQLite file name). */
  databaseLabel?: string;
  /** Full database path for admin diagnostics (safe, no secrets). */
  databasePath?: string;
  /** Instance identifier (helps diagnose multi-instance / non-persistent DB). */
  instanceId?: string;
  /**
   * Absolute path to the Vite `dist` folder (must contain `index.html`).
   * When set, the API process also serves the SPA and assets on the same origin so
   * `POST /api/...` hits Express instead of a static CDN returning 405.
   */
  webDistDir?: string;
};

export function createApp(db: DatabaseSync, opts: CreateAppOptions = {}): express.Application {
  bindUsageAnalyticsDb(db);
  const databaseLabel = opts.databaseLabel ?? "in-process";
  const databasePath = opts.databasePath;
  const instanceId = opts.instanceId;
  const corsOrigins = normalizeCorsOrigins(
    opts.corsOrigins ??
      (process.env.CORS_ORIGINS ??
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,https://bestie.mx,https://www.bestie.mx,https://dev.bestie.mx")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
  );

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.locals.healthDiagnostics = () => {
    const smtp = getSmtpDiagnostics();
    const inbound = getResendInboundDiagnostics();
    return {
      ok: true,
      service: "bestie-mx-api",
      database: databaseLabel,
      smtpConfigured: smtpConfigured(),
      smtp: {
        mode: getSmtpMode(),
        configured: smtp.configured,
        verifyOk: smtp.verifyOk,
        verifiedAt: smtp.verifiedAt,
        verifyError: smtp.verifyError,
        ...(getSmtpMode() === "off" ? { setupHint: OUTBOUND_SMTP_SETUP_HINT } : {}),
      },
      resendInbound: {
        webhookConfigured: inbound.webhookConfigured,
        receivingKeyConfigured: inbound.receivingKeyConfigured,
        receivingProbeOk: inbound.receivingProbeOk,
        receivingProbeError: inbound.receivingProbeError,
        receivingProbedAt: inbound.receivingProbedAt,
        spfOk: inbound.spfOk,
        spfTxt: inbound.spfTxt,
        spfProbedAt: inbound.spfProbedAt,
        forwardTo: inbound.forwardTo,
        inboundAddresses: inbound.inboundAddresses,
      },
      ...(databasePath ? { databasePath } : {}),
      ...(instanceId ? { instanceId } : {}),
    };
  };

  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = (req.headers.host ?? "").split(":")[0]?.toLowerCase();
    if (host === "bestie.mx") {
      res.redirect(301, `https://www.bestie.mx${req.originalUrl || "/"}`);
      return;
    }
    next();
  });

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
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[cors] blocked origin: ${origin}; allowed: ${corsOrigins.join(", ")}`);
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.get("/api/health", (_req: Request, res: Response) => {
    // Public probe only — diagnostics moved to GET /api/admin/health
    res.json({
      ok: true,
      service: "bestie-mx-api",
    });
  });

  app.get("/api/messenger/webhook", messengerWebhookVerify);
  app.post(
    "/api/messenger/webhook",
    express.raw({ type: "application/json", limit: "4mb" }),
    (req, res, next) => {
      void messengerWebhookPost(db)(req, res).catch(next);
    },
  );

  app.post(
    "/api/resend/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    (req, res, next) => {
      void resendWebhookPost(req, res).catch(next);
    },
  );

  app.get("/api/my-listings", myListingsHandler(db));
  app.get("/api/location-search", (req: Request, res: Response) => {
    void locationSearchHandler(req, res);
  });
  app.use("/api/listings", listingsRouter(db));
  app.use("/api/properties", propertiesRouter(db));
  app.use("/api/share-copy", shareAiCopyRouter(db));

  const uploadDir = resolveUploadDir(databasePath);
  app.use("/api/uploads", uploadsRouter({ db, uploadDir }));
  app.use("/api/share-og", shareOgImageRouter({ db, uploadDir }));

  app.use("/api/auth", authRouter(db));
  app.use("/api/messages", messagesRouter(db));
  app.use("/api/notifications", notificationsRouter(db));
  app.use("/api/saved-searches", savedSearchesRouter(db));
  app.use("/api/admin", adminRouter(db));
  app.use("/api/groups", groupsRouter(db));
  app.use("/api/analytics", analyticsRouter(db));
  app.use("/api/compliance", complianceRouter());
  app.use("/api/internal/backup", backupRouter(db, databasePath));

  const spaDist = opts.webDistDir?.trim();
  if (spaDist) {
    const absDist = path.resolve(spaDist);
    const indexHtmlPath = path.join(absDist, "index.html");
    if (fs.existsSync(indexHtmlPath)) {
      let indexHtmlCache: string | null = null;
      const readIndexHtml = (): string => {
        if (indexHtmlCache == null) {
          indexHtmlCache = fs.readFileSync(indexHtmlPath, "utf8");
        }
        return indexHtmlCache;
      };

      // Dynamic sitemap (listings + marketing URLs) — before static so it wins over a file in dist.
      app.get("/sitemap.xml", (req: Request, res: Response) => {
        try {
          const xml = buildSitemapXml(db, sharePreviewBaseUrl(req));
          res
            .status(200)
            .type("application/xml")
            .set("Cache-Control", "public, max-age=300")
            .send(xml);
        } catch (err) {
          console.error("[sitemap]", err);
          res.status(500).type("text/plain").send("sitemap_error");
        }
      });

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

        // Per-listing Open Graph for WhatsApp / Messenger / Facebook scrapers.
        // Base must match the request host so Dev images are not pointed at Prod.
        const og = resolveListingShareOg(db, req.path, sharePreviewBaseUrl(req));
        if (og) {
          try {
            const html = injectListingShareOg(readIndexHtml(), og);
            res.status(200).type("html").send(html);
            return;
          } catch (err) {
            next(err);
            return;
          }
        }

        // Marketing / city routes: keyword-focused title/description/canonical for crawlers.
        const routeSeo = resolveRouteSeo(req.path);
        if (routeSeo) {
          try {
            let html = injectRouteSeo(readIndexHtml(), routeSeo, sharePreviewBaseUrl(req));
            html = injectFacebookAppId(html);
            res.status(200).type("html").send(html);
            return;
          } catch (err) {
            next(err);
            return;
          }
        }

        // Non-listing SPA routes: still attach fb:app_id when configured.
        try {
          const html = injectFacebookAppId(readIndexHtml());
          res.status(200).type("html").send(html);
        } catch (err) {
          next(err);
        }
      });
    }
  }

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not_found" });
  });

  return app;
}
