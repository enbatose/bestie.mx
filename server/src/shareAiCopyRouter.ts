import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { canWritePropertyByRequest, hasPublisherOrAdminSession } from "./propertyRequestAccess.js";
import { createSlidingWindowLimiter } from "./rateLimit.js";
import { resolvePropertyIdFromRouteParam, resolveRoomIdFromRouteParam } from "./resolveListingRouteId.js";
import {
  getOrCreateShareAiCopy,
  publisherIdForShareTarget,
  saveShareAiCopy,
} from "./shareAiCopyService.js";
import type { ShareAiScope } from "./shareAiCopyPrompt.js";

function parseScope(v: unknown): ShareAiScope | null {
  return v === "property" || v === "room" ? v : null;
}

export function shareAiCopyRouter(db: DatabaseSync) {
  const router = express.Router();
  const jsonMw = express.json({ limit: "64kb" });
  const generateLimiter = createSlidingWindowLimiter({ windowMs: 60_000, max: 20 });

  router.post("/generate", jsonMw, async (req: Request, res: Response) => {
    if (!hasPublisherOrAdminSession(db, req)) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const limited = generateLimiter(req.ip ?? "ip");
    if (!limited.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: limited.retryAfterMs });
      return;
    }
    const scope = parseScope(req.body?.scope);
    if (!scope) {
      res.status(400).json({ error: "invalid_scope" });
      return;
    }
    let propertyId =
      typeof req.body?.propertyId === "string" ? req.body.propertyId.trim() : null;
    let roomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim() : null;
    if (scope === "property" && propertyId) {
      propertyId = resolvePropertyIdFromRouteParam(db, propertyId) ?? propertyId;
    }
    if (scope === "room" && roomId) {
      roomId = resolveRoomIdFromRouteParam(db, roomId) ?? roomId;
    }
    const publisherId = publisherIdForShareTarget(db, { scope, propertyId, roomId });
    if (!publisherId || !canWritePropertyByRequest(db, req, publisherId)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const force = Boolean(req.body?.force);
    try {
      const result = await getOrCreateShareAiCopy(db, { scope, propertyId, roomId, force });
      if (!result) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(result);
    } catch (err) {
      console.error("[share-ai] generate", err);
      res.status(500).json({ error: "generate_failed" });
    }
  });

  router.patch("/", jsonMw, (req: Request, res: Response) => {
    if (!hasPublisherOrAdminSession(db, req)) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const scope = parseScope(req.body?.scope);
    if (!scope) {
      res.status(400).json({ error: "invalid_scope" });
      return;
    }
    let propertyId =
      typeof req.body?.propertyId === "string" ? req.body.propertyId.trim() : null;
    let roomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim() : null;
    if (scope === "property" && propertyId) {
      propertyId = resolvePropertyIdFromRouteParam(db, propertyId) ?? propertyId;
    }
    if (scope === "room" && roomId) {
      roomId = resolveRoomIdFromRouteParam(db, roomId) ?? roomId;
    }
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    if (!text.trim()) {
      res.status(400).json({ error: "empty_text" });
      return;
    }
    const publisherId = publisherIdForShareTarget(db, { scope, propertyId, roomId });
    if (!publisherId || !canWritePropertyByRequest(db, req, publisherId)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const result = saveShareAiCopy(db, { scope, propertyId, roomId, text });
    if (!result) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(result);
  });

  return router;
}
