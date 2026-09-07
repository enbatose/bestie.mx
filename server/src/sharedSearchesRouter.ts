import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { isAdminUser } from "./adminAuth.js";
import { readAuthUserId } from "./jwtSession.js";
import { composeSharedSearch, type SharedSearchExtraction } from "./sharedSearchCompose.js";
import { extractSeekerSearchWithGemini } from "./sharedSearchGemini.js";
import { rowToApi } from "./savedSearchNotify.js";
import {
  createTemplateSharedSearch,
  findSharedSearchesByFacebookUrl,
  sharedSearchAdminPreview,
  sharedSearchMapLocation,
  sharedSearchPublicMeta,
  sharedSearchPublicView,
  subscribeToSharedSearch,
} from "./sharedSearches.js";

function jsonMw(limit = "256kb") {
  return express.json({ limit });
}

function listingSummary(listing: {
  id: string;
  title?: string;
  neighborhood?: string;
  city?: string;
  rentMxn?: number;
}) {
  return {
    id: listing.id,
    title: listing.title ?? "",
    neighborhood: listing.neighborhood ?? "",
    city: listing.city ?? "",
    rentMxn: listing.rentMxn ?? 0,
  };
}

export function sharedSearchesRouter(db: DatabaseSync) {
  const r = express.Router();

  function adminGuard(req: Request, res: Response, next: () => void): void {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    if (!isAdminUser(db, uid)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  }

  r.post("/admin/duplicate-check", adminGuard, jsonMw(), (req: Request, res: Response) => {
    const url = typeof req.body?.sourceFacebookUrl === "string" ? req.body.sourceFacebookUrl : "";
    const matches = findSharedSearchesByFacebookUrl(db, url).map((s) => ({
      id: s.id,
      label: s.label,
      sharePath: `/busquedas/${s.id}`,
      createdAt: s.created_at,
      seekerName: s.seeker_name,
    }));
    res.json({ ok: true, facebookMatches: matches });
  });

  r.post("/admin/extract", adminGuard, express.json({ limit: "30mb" }), (req: Request, res: Response) => {
    void (async () => {
      try {
        const body = req.body as {
          text?: string;
          images?: Array<{ mimeType: string; data: string }>;
          city?: string;
          seekerName?: string;
          seekerGender?: "female" | "male" | null;
        };
        const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : "Guadalajara";
        const seekerGender = body.seekerGender === "female" || body.seekerGender === "male" ? body.seekerGender : null;
        const ai = await extractSeekerSearchWithGemini({
          text: typeof body.text === "string" ? body.text : undefined,
          images: Array.isArray(body.images) ? body.images.slice(0, 2) : undefined,
          city,
          seekerName: typeof body.seekerName === "string" ? body.seekerName : undefined,
          seekerGender,
        });
        const composed = composeSharedSearch({
          city,
          seekerGender: seekerGender ?? ai.extraction.seekerGenderInferred ?? null,
          extraction: ai.extraction,
        });
        const preview = sharedSearchAdminPreview(db, composed);
        res.json({
          ok: true,
          extraction: ai.extraction,
          composed: {
            filters: composed.filters,
            location: composed.location,
            similar: composed.similar,
            label: composed.label,
            mainArea: composed.mainArea,
            qText: composed.qText,
          },
          insights: preview.insights,
          nonNegotiables: preview.nonNegotiables,
          exact: preview.exact.map(listingSummary),
          similar: preview.similar.map((row) => ({ ...listingSummary(row.listing), score: row.score })),
          exactCount: preview.exact.length,
          similarCount: preview.similar.length,
          quality: preview.quality,
          caption: preview.caption,
          zoneRule: preview.zoneRule,
        });
      } catch (err) {
        console.error("[shared-searches] extract", err);
        res.status(500).json({ error: "extraction_failed" });
      }
    })();
  });

  r.post("/admin", adminGuard, jsonMw("1mb"), (req: Request, res: Response) => {
    const adminId = readAuthUserId(req);
    if (!adminId) return;
    const body = req.body as {
      city?: unknown;
      seekerName?: unknown;
      seekerGender?: unknown;
      sourceFacebookUrl?: unknown;
      extraction?: unknown;
    };
    const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : "Guadalajara";
    const seekerName = typeof body.seekerName === "string" ? body.seekerName : "";
    const seekerGender = body.seekerGender === "female" || body.seekerGender === "male" ? body.seekerGender : null;
    const sourceFacebookUrl = typeof body.sourceFacebookUrl === "string" ? body.sourceFacebookUrl : "";
    const extraction = (
      body.extraction && typeof body.extraction === "object" ? body.extraction : {}
    ) as SharedSearchExtraction;
    try {
      const created = createTemplateSharedSearch(db, {
        adminUserId: adminId,
        city,
        seekerName,
        seekerGender,
        sourceFacebookUrl,
        extraction,
      });
      res.status(201).json({
        ok: true,
        id: created.share.id,
        sharePath: created.sharePath,
        shareUrl: created.sharePath,
        caption: created.caption,
        label: created.share.label,
        exactCount: created.exactCount,
        similarCount: created.similarCount,
        similarHighCount: created.similarHighCount,
        quality: created.quality,
        insights: created.composed.insights,
        nonNegotiables: created.composed.nonNegotiables,
        zoneRule: created.zoneRule,
        reused: created.reused,
      });
    } catch (err) {
      console.error("[shared-searches] create", err);
      res.status(500).json({ error: "create_failed" });
    }
  });

  r.get("/:id/meta", (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const meta = sharedSearchPublicMeta(db, id);
    if (!meta) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(meta);
  });

  r.get("/:id", (req: Request, res: Response) => {
    const id = String(req.params.id ?? "").trim();
    const uid = readAuthUserId(req);
    const view = sharedSearchPublicView(db, id, uid);
    if (!view) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(view);
  });

  r.post("/:id/subscribe", jsonMw(), (req: Request, res: Response) => {
    const uid = readAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    const id = String(req.params.id ?? "").trim();
    const enableNotify = req.body?.enableNotify === true;
    void (async () => {
      try {
        const result = await subscribeToSharedSearch(db, uid, id, { enableNotify });
        res.json({
          id: result.share.id,
          sharePath: `/busquedas/${result.share.id}`,
          redirectedSlug: result.redirectedSlug ?? null,
          subscribedNow: result.subscribedNow,
          savedSearch: rowToApi(result.savedSearch),
          exactCount: result.exact.length,
          similarCount: result.similar.length,
          listings: {
            exact: result.exact,
            similar: result.similar.map((row) => row.listing),
          },
          location: sharedSearchMapLocation(result.share),
          filters: JSON.parse(result.share.filters_json),
        });
      } catch (e) {
        const code = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
        if (code === "not_found") {
          res.status(404).json({ error: "not_found" });
          return;
        }
        if (code === "limit_reached") {
          res.status(400).json({ error: "limit_reached", message: "Máximo de búsquedas guardadas alcanzado." });
          return;
        }
        console.error("[shared-searches] subscribe", e);
        res.status(500).json({ error: "subscribe_failed" });
      }
    })();
  });

  return r;
}
