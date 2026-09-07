import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import { isAdminUser } from "./adminAuth.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { generateOutreachInvitation } from "./outreachInvitationGemini.js";

const generateLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 30 });

export function outreachInvitationRouter(db: DatabaseSync) {
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
  r.use(express.json({ limit: "32kb" }));

  r.post("/generate", (req: Request, res: Response): void => {
    const ip = req.ip || "unknown";
    if (!generateLimiter(ip).ok) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    void (async () => {
      try {
        const body = req.body as { publisherName?: unknown; previousText?: unknown };
        const publisherName =
          typeof body.publisherName === "string" ? body.publisherName.trim().slice(0, 80) : "";
        const previousText =
          typeof body.previousText === "string" ? body.previousText.trim().slice(0, 2000) : "";
        const result = await generateOutreachInvitation({
          publisherName: publisherName || null,
          previousText: previousText || null,
        });
        res.json({
          ok: true,
          text: result.text,
          source: result.source,
          model: result.model ?? null,
        });
      } catch (err) {
        console.error("[outreach-invitation] generate failed", err);
        res.status(500).json({ error: "generation_failed" });
      }
    })();
  });

  return r;
}
