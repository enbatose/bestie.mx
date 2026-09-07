import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import { readAuthUserId } from "./jwtSession.js";
import {
  renderUnsubscribeConfirmationHtml,
  renderUnsubscribeNotFoundHtml,
  renderUnsubscribePromptHtml,
} from "./emails/savedSearchEmail.js";
import {
  autoLabelFromSearch,
  enableSavedSearchNotify,
  generateUnsubscribeToken,
  newSavedSearchId,
  rowToApi,
  type SavedSearchRow,
} from "./savedSearchNotify.js";
import {
  neighborhoodsForSavedSearchCard,
  parseSavedSearchFilters,
  parseSavedSearchLocation,
  resolveSavedSearchMatches,
  sourceKindFromShare,
  zoneRuleForSavedSearch,
  type SavedSearchLocationSnapshot,
} from "./savedSearchMatch.js";
import { MAX_SAVED_SEARCHES_PER_USER } from "./savedSearchSchema.js";
import { fetchPublishedListings } from "./publishedListingsQuery.js";
import type { SearchFilters } from "./searchFilters.js";
import { forkSharedSearchOnEdit } from "./sharedSearches.js";

function jsonMw() {
  return express.json({ limit: "256kb" });
}

function isoNow(): string {
  return new Date().toISOString();
}

function requireUser(req: Request, res: Response): string | null {
  const uid = readAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return uid;
}

function loadOwned(db: DatabaseSync, userId: string, id: string): SavedSearchRow | null {
  const row = db.prepare(`SELECT * FROM saved_searches WHERE id = ? AND user_id = ?`).get(id, userId) as
    | SavedSearchRow
    | undefined;
  return row ?? null;
}

function parseBodyFilters(raw: unknown): SearchFilters | null {
  if (raw == null || typeof raw !== "object") return null;
  return raw as SearchFilters;
}

function parseBodyLocation(raw: unknown): SavedSearchLocationSnapshot | null {
  if (raw == null || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.cityCode !== "string" || !o.cityCode.trim()) return null;
  if (typeof o.lat !== "number" || typeof o.lng !== "number" || typeof o.zoom !== "number") return null;
  const neighborhoods = Array.isArray(o.neighborhoods)
    ? o.neighborhoods
        .filter(
          (n): n is { name: string; lat: number; lng: number } =>
            n != null &&
            typeof n === "object" &&
            typeof (n as { name?: unknown }).name === "string" &&
            typeof (n as { lat?: unknown }).lat === "number" &&
            typeof (n as { lng?: unknown }).lng === "number",
        )
        .map((n) => ({ name: n.name.trim(), lat: n.lat, lng: n.lng }))
    : [];
  return {
    cityCode: o.cityCode.trim(),
    ...(typeof o.cityLabel === "string" ? { cityLabel: o.cityLabel.trim() } : {}),
    neighborhoods,
    lat: o.lat,
    lng: o.lng,
    zoom: o.zoom,
  };
}

type SaveSearchBody = {
  label?: unknown;
  cityCode?: unknown;
  filters?: unknown;
  location?: unknown;
  searchUrl?: unknown;
  enableEmailNotify?: unknown;
};

function parseSavePayload(body: SaveSearchBody): {
  filters: SearchFilters;
  location: SavedSearchLocationSnapshot;
  cityCode: string;
  searchUrl: string;
} | null {
  const filters = parseBodyFilters(body.filters);
  const location = parseBodyLocation(body.location);
  const cityCode =
    typeof body.cityCode === "string" && body.cityCode.trim()
      ? body.cityCode.trim()
      : location?.cityCode;
  const searchUrl = typeof body.searchUrl === "string" ? body.searchUrl.trim() : "";
  if (!filters || !location || !cityCode || !searchUrl.startsWith("/buscar")) return null;
  return { filters, location, cityCode, searchUrl };
}

function countSavedNonDrafts(db: DatabaseSync, userId: string): number {
  return (
    db
      .prepare(`SELECT COUNT(*) AS c FROM saved_searches WHERE user_id = ? AND is_draft = 0`)
      .get(userId) as { c: number }
  ).c;
}

function loadUserDraft(db: DatabaseSync, userId: string): SavedSearchRow | null {
  const row = db
    .prepare(`SELECT * FROM saved_searches WHERE user_id = ? AND is_draft = 1 LIMIT 1`)
    .get(userId) as SavedSearchRow | undefined;
  return row ?? null;
}

function upsertUserDraft(
  db: DatabaseSync,
  userId: string,
  payload: {
    filters: SearchFilters;
    location: SavedSearchLocationSnapshot;
    cityCode: string;
    searchUrl: string;
  },
): SavedSearchRow {
  const filtersJson = JSON.stringify(payload.filters);
  const locationJson = JSON.stringify(payload.location);
  const now = isoNow();
  const label = autoLabelFromSearch(payload.location, payload.filters, new Date(now));
  const existing = loadUserDraft(db, userId);

  if (existing) {
    db.prepare(
      `UPDATE saved_searches
       SET label = ?, city_code = ?, filters_json = ?, location_json = ?, search_url = ?, updated_at = ?
       WHERE id = ?`,
    ).run(label, payload.cityCode, filtersJson, locationJson, payload.searchUrl, now, existing.id);
    return {
      ...existing,
      label,
      city_code: payload.cityCode,
      filters_json: filtersJson,
      location_json: locationJson,
      search_url: payload.searchUrl,
      updated_at: now,
    };
  }

  const row: SavedSearchRow = {
    id: newSavedSearchId(),
    user_id: userId,
    label,
    city_code: payload.cityCode,
    filters_json: filtersJson,
    location_json: locationJson,
    search_url: payload.searchUrl,
    email_notify_enabled: 0,
    unsubscribe_token: generateUnsubscribeToken(),
    last_notified_at: null,
    is_draft: 1,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO saved_searches (
      id, user_id, label, city_code, filters_json, location_json, search_url,
      email_notify_enabled, unsubscribe_token, last_notified_at, is_draft, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, 1, ?, ?)`,
  ).run(
    row.id,
    row.user_id,
    row.label,
    row.city_code,
    row.filters_json,
    row.location_json,
    row.search_url,
    row.unsubscribe_token,
    row.created_at,
    row.updated_at,
  );
  return row;
}

export function savedSearchesRouter(db: DatabaseSync) {
  const r = express.Router();

  /** Public unsubscribe: GET confirms; POST (and Gmail one-click) disables. Before /:id. */
  r.get("/unsubscribe/:token", (req: Request, res: Response) => {
    const token = String(req.params.token ?? "").trim();
    if (!token) {
      res.status(404).type("html").send(renderUnsubscribeNotFoundHtml());
      return;
    }
    const row = db
      .prepare(`SELECT id, label FROM saved_searches WHERE unsubscribe_token = ?`)
      .get(token) as { id: string; label: string } | undefined;
    if (!row) {
      res.status(404).type("html").send(renderUnsubscribeNotFoundHtml());
      return;
    }
    res.status(200).type("html").send(renderUnsubscribePromptHtml(row.label, token));
  });

  r.post("/unsubscribe/:token", express.urlencoded({ extended: false }), (req: Request, res: Response) => {
    const token = String(req.params.token ?? "").trim();
    if (!token) {
      res.status(404).type("html").send(renderUnsubscribeNotFoundHtml());
      return;
    }
    const row = db
      .prepare(`SELECT id, label FROM saved_searches WHERE unsubscribe_token = ?`)
      .get(token) as { id: string; label: string } | undefined;
    if (!row) {
      res.status(404).type("html").send(renderUnsubscribeNotFoundHtml());
      return;
    }
    const now = isoNow();
    db.prepare(
      `UPDATE saved_searches SET email_notify_enabled = 0, updated_at = ? WHERE id = ?`,
    ).run(now, row.id);
    res.status(200).type("html").send(renderUnsubscribeConfirmationHtml(row.label));
  });

  r.get("/", (req: Request, res: Response) => {
    const uid = requireUser(req, res);
    if (!uid) return;
    const rows = db
      .prepare(
        `SELECT * FROM saved_searches WHERE user_id = ? AND is_draft = 0 ORDER BY updated_at DESC`,
      )
      .all(uid) as SavedSearchRow[];
    const published = fetchPublishedListings(db);
    const shareIds = [
      ...new Set(rows.map((r) => r.share_id?.trim()).filter((id): id is string => Boolean(id))),
    ];
    const similarByShare = new Map<string, string>();
    const kindByShare = new Map<string, string>();
    if (shareIds.length) {
      const ph = shareIds.map(() => "?").join(",");
      const shares = db
        .prepare(`SELECT id, similar_json, kind FROM shared_searches WHERE id IN (${ph})`)
        .all(...shareIds) as { id: string; similar_json: string; kind: string }[];
      for (const s of shares) {
        similarByShare.set(s.id, s.similar_json);
        kindByShare.set(s.id, s.kind);
      }
    }
    res.json(
      rows.map((row) => {
        let matchCount: number | undefined;
        let similarCount: number | undefined;
        let areaNeighborhoods: string[] | undefined;
        let filters: ReturnType<typeof parseSavedSearchFilters> | undefined;
        let location: ReturnType<typeof parseSavedSearchLocation> | undefined;
        let zoneRule: string | undefined;
        try {
          filters = parseSavedSearchFilters(row.filters_json);
          location = parseSavedSearchLocation(row.location_json);
          const similarJson = row.share_id ? similarByShare.get(row.share_id) ?? null : null;
          const matches = resolveSavedSearchMatches(published, filters, location, similarJson);
          matchCount = matches.exact.length;
          similarCount = matches.similarCount;
          areaNeighborhoods = neighborhoodsForSavedSearchCard(
            db,
            filters,
            location,
            published,
            similarJson,
          );
          zoneRule = zoneRuleForSavedSearch(filters, location, similarJson);
        } catch {
          matchCount = undefined;
          similarCount = undefined;
          areaNeighborhoods = undefined;
          zoneRule = undefined;
        }
        const shareKind = row.share_id ? kindByShare.get(row.share_id) ?? null : null;
        return {
          ...rowToApi(row, matchCount, areaNeighborhoods, similarCount),
          ...(filters ? { filters } : {}),
          ...(location ? { location } : {}),
          ...(zoneRule ? { zoneRule } : {}),
          sourceKind: sourceKindFromShare(shareKind, row.share_id),
          ...(shareKind ? { shareKind } : {}),
        };
      }),
    );
  });

  r.get("/draft", (req: Request, res: Response) => {
    const uid = requireUser(req, res);
    if (!uid) return;
    const draft = loadUserDraft(db, uid);
    if (!draft) {
      res.json(null);
      return;
    }
    res.json(rowToApi(draft));
  });

  r.put("/draft", jsonMw(), (req: Request, res: Response) => {
    const uid = requireUser(req, res);
    if (!uid) return;
    const parsed = parseSavePayload(req.body as SaveSearchBody);
    if (!parsed) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const row = upsertUserDraft(db, uid, parsed);
    res.json(rowToApi(row));
  });

  r.post("/draft/promote", jsonMw(), (req: Request, res: Response) => {
    const uid = requireUser(req, res);
    if (!uid) return;
    const draft = loadUserDraft(db, uid);
    if (!draft) {
      res.status(404).json({ error: "no_draft" });
      return;
    }

    const body = req.body as { label?: unknown };
    const now = isoNow();
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 200)
        : draft.label;

    if (countSavedNonDrafts(db, uid) >= MAX_SAVED_SEARCHES_PER_USER) {
      res.status(400).json({ error: "limit_reached", message: "Máximo de búsquedas guardadas alcanzado." });
      return;
    }

    db.prepare(`UPDATE saved_searches SET label = ?, is_draft = 0, updated_at = ? WHERE id = ?`).run(
      label,
      now,
      draft.id,
    );
    const row = loadOwned(db, uid, draft.id)!;
    res.json(rowToApi(row));
  });

  r.post("/", jsonMw(), async (req: Request, res: Response) => {
    const uid = requireUser(req, res);
    if (!uid) return;

    const count = countSavedNonDrafts(db, uid);
    if (count >= MAX_SAVED_SEARCHES_PER_USER) {
      res.status(400).json({ error: "limit_reached", message: "Máximo de búsquedas guardadas alcanzado." });
      return;
    }

    const body = req.body as {
      label?: unknown;
      cityCode?: unknown;
      filters?: unknown;
      location?: unknown;
      searchUrl?: unknown;
      enableEmailNotify?: unknown;
    };

    const filters = parseBodyFilters(body.filters);
    const location = parseBodyLocation(body.location);
    const cityCode =
      typeof body.cityCode === "string" && body.cityCode.trim()
        ? body.cityCode.trim()
        : location?.cityCode;
    const searchUrl = typeof body.searchUrl === "string" ? body.searchUrl.trim() : "";

    if (!filters || !location || !cityCode || !searchUrl.startsWith("/buscar")) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }

    const filtersJson = JSON.stringify(filters);
    const locationJson = JSON.stringify(location);

    const dup = db
      .prepare(
        `SELECT * FROM saved_searches WHERE user_id = ? AND is_draft = 0 AND filters_json = ? AND location_json = ? LIMIT 1`,
      )
      .get(uid, filtersJson, locationJson) as SavedSearchRow | undefined;

    const now = isoNow();
    let row: SavedSearchRow;

    if (dup) {
      const label =
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim().slice(0, 200)
          : dup.label;
      db.prepare(`UPDATE saved_searches SET label = ?, search_url = ?, updated_at = ? WHERE id = ?`).run(
        label,
        searchUrl,
        now,
        dup.id,
      );
      row = { ...dup, label, search_url: searchUrl, updated_at: now };
    } else {
      const id = newSavedSearchId();
      const label =
        typeof body.label === "string" && body.label.trim()
          ? body.label.trim().slice(0, 200)
          : autoLabelFromSearch(location, filters);
      row = {
        id,
        user_id: uid,
        label,
        city_code: cityCode,
        filters_json: filtersJson,
        location_json: locationJson,
        search_url: searchUrl,
        email_notify_enabled: 0,
        unsubscribe_token: generateUnsubscribeToken(),
        last_notified_at: null,
        is_draft: 0,
        created_at: now,
        updated_at: now,
      };
      db.prepare(
        `INSERT INTO saved_searches (
          id, user_id, label, city_code, filters_json, location_json, search_url,
          email_notify_enabled, unsubscribe_token, last_notified_at, is_draft, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, 0, ?, ?)`,
      ).run(
        row.id,
        row.user_id,
        row.label,
        row.city_code,
        row.filters_json,
        row.location_json,
        row.search_url,
        row.unsubscribe_token,
        row.created_at,
        row.updated_at,
      );
    }

    const enableEmailNotify = body.enableEmailNotify === true;
    let notifyResult: Awaited<ReturnType<typeof enableSavedSearchNotify>> | undefined;
    if (enableEmailNotify) {
      notifyResult = await enableSavedSearchNotify(db, uid, row.id);
      if (!notifyResult.ok && notifyResult.error === "email_required") {
        res.status(201).json({
          ...rowToApi(loadOwned(db, uid, row.id)!),
          emailNotifyEnabled: false,
          emailError: "email_required",
        });
        return;
      }
      row = loadOwned(db, uid, row.id)!;
    }

    res.status(dup ? 200 : 201).json({
      ...rowToApi(row),
      ...(notifyResult?.replacedPrevious ? { replacedPrevious: notifyResult.replacedPrevious } : {}),
      ...(notifyResult && enableEmailNotify ? { emailSent: notifyResult.emailSent } : {}),
    });
  });

  r.patch("/:id", jsonMw(), async (req: Request, res: Response) => {
    const uid = requireUser(req, res);
    if (!uid) return;
    const id = String(req.params.id ?? "");
    const row = loadOwned(db, uid, id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const body = req.body as SaveSearchBody & { emailNotifyEnabled?: unknown };
    const now = isoNow();

    if (typeof body.label === "string" && body.label.trim()) {
      db.prepare(`UPDATE saved_searches SET label = ?, updated_at = ? WHERE id = ?`).run(
        body.label.trim().slice(0, 200),
        now,
        id,
      );
    }

    // Editing a saved search's filters from "Mis Búsquedas": keep filters_json/location_json in
    // sync with search_url so match counts and email alerts reflect the new criteria.
    const editFilters = parseBodyFilters(body.filters);
    const editLocation = parseBodyLocation(body.location);
    const editSearchUrl = typeof body.searchUrl === "string" ? body.searchUrl.trim() : "";
    const urlOk = editSearchUrl.startsWith("/buscar") || editSearchUrl.startsWith("/busquedas/");
    if (editFilters && editLocation && (urlOk || row.share_id)) {
      let searchUrl = urlOk ? editSearchUrl : row.search_url;
      let shareId = row.share_id ?? null;
      let locationToStore = editLocation;
      const fork = forkSharedSearchOnEdit(db, uid, row, {
        filters: editFilters,
        location: editLocation,
        searchUrl,
      });
      if (fork) {
        searchUrl = fork.searchUrl;
        shareId = fork.shareId;
        locationToStore = fork.location;
      }
      db.prepare(
        `UPDATE saved_searches
         SET filters_json = ?, location_json = ?, search_url = ?, city_code = ?, share_id = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        JSON.stringify(editFilters),
        JSON.stringify(locationToStore),
        searchUrl,
        locationToStore.cityCode,
        shareId,
        now,
        id,
      );
    }

    if (body.emailNotifyEnabled === true) {
      const result = await enableSavedSearchNotify(db, uid, id);
      if (!result.ok) {
        if (result.error === "email_required") {
          res.status(400).json({ error: "email_required" });
          return;
        }
        res.status(404).json({ error: "not_found" });
        return;
      }
      const updated = loadOwned(db, uid, id)!;
      res.json({
        ...rowToApi(updated),
        ...(result.replacedPrevious ? { replacedPrevious: result.replacedPrevious } : {}),
        emailSent: result.emailSent,
      });
      return;
    }

    if (body.emailNotifyEnabled === false) {
      db.prepare(
        `UPDATE saved_searches SET email_notify_enabled = 0, updated_at = ? WHERE id = ?`,
      ).run(now, id);
    }

    const updated = loadOwned(db, uid, id)!;
    res.json(rowToApi(updated));
  });

  r.post("/:id/enable-notify", jsonMw(), async (req: Request, res: Response) => {
    const uid = requireUser(req, res);
    if (!uid) return;
    const id = String(req.params.id ?? "");
    const result = await enableSavedSearchNotify(db, uid, id);
    if (!result.ok) {
      if (result.error === "email_required") {
        res.status(400).json({ error: "email_required" });
        return;
      }
      res.status(404).json({ error: "not_found" });
      return;
    }
    const row = loadOwned(db, uid, id)!;
    res.json({
      ...rowToApi(row),
      ...(result.replacedPrevious ? { replacedPrevious: result.replacedPrevious } : {}),
      emailSent: result.emailSent,
    });
  });

  r.delete("/:id", (req: Request, res: Response) => {
    const uid = requireUser(req, res);
    if (!uid) return;
    const id = String(req.params.id ?? "");
    const row = loadOwned(db, uid, id);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    db.prepare(`DELETE FROM saved_searches WHERE id = ?`).run(id);
    res.status(204).end();
  });

  return r;
}
