import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { generateOutreachDiffusionComment } from "./outreachDiffusionGemini.js";

const generateLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 30 });

export function outreachDiffusionRouter(db: DatabaseSync) {
  const r = express.Router();

  function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!isAdminUser(db, uid)) {
      res.status(403).json({ error: "forbidden", message: "Admin only." });
      return;
    }
    next();
  }

  r.use(requireAdmin);
  r.use(express.json({ limit: "48kb" }));

  r.post("/generate", (req: Request, res: Response): void => {
    const ip = req.ip || "unknown";
    if (!generateLimiter(ip).ok) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    void (async () => {
      try {
        const body = req.body as {
          sharePath?: unknown;
          seekerName?: unknown;
          zoneRule?: unknown;
          placeHint?: unknown;
          exactCount?: unknown;
          similarCount?: unknown;
          extraCriteria?: unknown;
          previousText?: unknown;
        };
        const sharePath = typeof body.sharePath === "string" ? body.sharePath.trim().slice(0, 200) : "";
        if (!sharePath || !sharePath.includes("/busquedas/")) {
          res.status(400).json({ error: "invalid_share_path" });
          return;
        }
        const seekerName =
          typeof body.seekerName === "string" ? body.seekerName.trim().slice(0, 80) : "";
        const zoneRule =
          typeof body.zoneRule === "string" ? body.zoneRule.trim().slice(0, 120) : "";
        const placeHint =
          typeof body.placeHint === "string" ? body.placeHint.trim().slice(0, 160) : "";
        const previousText =
          typeof body.previousText === "string" ? body.previousText.trim().slice(0, 2000) : "";
        const exactCount =
          typeof body.exactCount === "number" && Number.isFinite(body.exactCount)
            ? Math.max(0, Math.floor(body.exactCount))
            : null;
        const similarCount =
          typeof body.similarCount === "number" && Number.isFinite(body.similarCount)
            ? Math.max(0, Math.floor(body.similarCount))
            : null;
        const extraCriteria = Array.isArray(body.extraCriteria)
          ? body.extraCriteria
              .filter((c): c is string => typeof c === "string")
              .map((c) => c.trim().slice(0, 80))
              .filter(Boolean)
              .slice(0, 4)
          : [];

        const result = await generateOutreachDiffusionComment({
          sharePath,
          seekerName: seekerName || null,
          zoneRule: zoneRule || null,
          placeHint: placeHint || null,
          exactCount,
          similarCount,
          extraCriteria,
          previousText: previousText || null,
          variantSeed: sharePath,
        });
        res.json({
          ok: true,
          text: result.text,
          source: result.source,
          model: result.model ?? null,
        });
      } catch (err) {
        console.error("[outreach-diffusion] generate failed", err);
        res.status(500).json({ error: "generation_failed" });
      }
    })();
  });

  return r;
}
