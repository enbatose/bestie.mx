import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { canWritePropertyByRequest, hasPublisherOrAdminSession } from "./propertyRequestAccess.js";
import { sharePreviewBaseUrl } from "./publicBaseUrl.js";
import { createSlidingWindowLimiter, type RateLimitResult } from "./rateLimit.js";
import { resolvePropertyIdFromRouteParam, resolveRoomIdFromRouteParam } from "./resolveListingRouteId.js";
import {
  SHARE_AI_FORCE_MAX_PER_HOUR,
  SHARE_AI_GENERATE_IP_MAX_PER_MIN,
  SHARE_AI_GENERATE_PUB_MAX_PER_MIN,
  SHARE_AI_PATCH_MAX_PER_MIN,
} from "./shareAiCopyLimits.js";
import {
  getOrCreateShareAiCopy,
  publisherIdForShareTarget,
  saveShareAiCopy,
} from "./shareAiCopyService.js";
import type { ShareAiScope } from "./shareAiCopyPrompt.js";

function parseScope(v: unknown): ShareAiScope | null {
  return v === "property" || v === "room" ? v : null;
}

function firstRateLimitFailure(...results: RateLimitResult[]): RateLimitResult {
  for (const r of results) {
    if (!r.ok) return r;
  }
  return { ok: true };
}

export function shareAiCopyRouter(db: DatabaseSync) {
  const router = express.Router();
  const jsonMw = express.json({ limit: "64kb" });
  const generateIpLimiter = createSlidingWindowLimiter({
    windowMs: 60_000,
    max: SHARE_AI_GENERATE_IP_MAX_PER_MIN,
  });
  const generatePubLimiter = createSlidingWindowLimiter({
    windowMs: 60_000,
    max: SHARE_AI_GENERATE_PUB_MAX_PER_MIN,
  });
  const forceRegenLimiter = createSlidingWindowLimiter({
    windowMs: 60 * 60_000,
    max: SHARE_AI_FORCE_MAX_PER_HOUR,
  });
  const patchLimiter = createSlidingWindowLimiter({
    windowMs: 60_000,
    max: SHARE_AI_PATCH_MAX_PER_MIN,
  });

  router.post("/generate", jsonMw, async (req: Request, res: Response) => {
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
    const publisherId = publisherIdForShareTarget(db, { scope, propertyId, roomId });
    if (!publisherId || !canWritePropertyByRequest(db, req, publisherId)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const force = Boolean(req.body?.force);
    const ipKey = req.ip ?? "ip";
    const limited = firstRateLimitFailure(
      generateIpLimiter(ipKey),
      generatePubLimiter(`pub:${publisherId}`),
      ...(force ? [forceRegenLimiter(`force:${publisherId}`)] : []),
    );
    if (!limited.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: limited.retryAfterMs });
      return;
    }

    const baseUrl = sharePreviewBaseUrl(req);
    try {
      const result = await getOrCreateShareAiCopy(db, { scope, propertyId, roomId, force, baseUrl });
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
    const patchLimited = patchLimiter(`patch:${publisherId}`);
    if (!patchLimited.ok) {
      res.status(429).json({ error: "rate_limited", retryAfterMs: patchLimited.retryAfterMs });
      return;
    }
    const result = saveShareAiCopy(db, {
      scope,
      propertyId,
      roomId,
      text,
      baseUrl: sharePreviewBaseUrl(req),
    });
    if (!result) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(result);
  });

  return router;
}
