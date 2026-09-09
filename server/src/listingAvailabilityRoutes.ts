import type { Express, Request, Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import express from "express";
import {
  availabilityClaimUrl,
  confirmRoomStillFree,
  ensureListingAvailabilitySchema,
  listAvailabilityRoomChoices,
  lookupAvailabilityCode,
  markRoomRented,
  parseAvailabilityActionPath,
  type AvailabilityAction,
} from "./listingAvailability.js";
import {
  availabilityEmailApplyPage,
  availabilityPromptPage,
  availabilityResultPage,
} from "./listingAvailabilityPage.js";

function sendHtml(res: Response, status: number, html: string): void {
  res
    .status(status)
    .set("Cache-Control", "no-store")
    .type("html")
    .send(html);
}

function loadPlace(db: DatabaseSync, propertyId: string): { title: string; place: string } | null {
  const row = db
    .prepare(`SELECT title, city, neighborhood FROM properties WHERE id = ?`)
    .get(propertyId) as { title: string | null; city: string | null; neighborhood: string | null } | undefined;
  if (!row) return null;
  const place = [row.neighborhood, row.city].filter((s) => String(s ?? "").trim()).join(" · ");
  return { title: String(row.title ?? "").trim() || "Anuncio sin título", place };
}

function intentFrom(req: Request, action: AvailabilityAction): "confirm" | "rented" {
  const raw = String(req.body?.intent ?? "").trim();
  if (raw === "confirm" || raw === "rented") return raw;
  return action === "pause" ? "rented" : "confirm";
}

function roomIdFrom(req: Request): string | null {
  const raw = String(req.body?.roomId ?? "").trim();
  return raw || null;
}

function isEmailChoice(req: Request): boolean {
  const raw = req.query.e;
  return raw === "1" || (Array.isArray(raw) && raw.includes("1"));
}

function handleGet(db: DatabaseSync, req: Request, res: Response, action: AvailabilityAction, code: string): void {
  const found = lookupAvailabilityCode(db, code);
  if (!found || found.action !== action) {
    sendHtml(res, 404, availabilityResultPage({ outcome: "invalid" }));
    return;
  }
  if (isEmailChoice(req)) {
    sendHtml(res, 200, availabilityEmailApplyPage({ intent: action === "pause" ? "rented" : "confirm" }));
    return;
  }
  const meta = loadPlace(db, found.propertyId);
  if (!meta) {
    sendHtml(res, 404, availabilityResultPage({ outcome: "invalid" }));
    return;
  }
  sendHtml(
    res,
    200,
    availabilityPromptPage({
      title: meta.title,
      place: meta.place,
      rooms: listAvailabilityRoomChoices(db, found.propertyId),
      claimUrl: null,
    }),
  );
}

function handlePost(db: DatabaseSync, req: Request, res: Response, action: AvailabilityAction, code: string): void {
  const found = lookupAvailabilityCode(db, code);
  if (!found || found.action !== action) {
    sendHtml(res, 404, availabilityResultPage({ outcome: "invalid" }));
    return;
  }
  const intent = intentFrom(req, action);
  const roomId = roomIdFrom(req);
  if (roomId && !listAvailabilityRoomChoices(db, found.propertyId).some((room) => room.id === roomId)) {
    sendHtml(res, 409, availabilityResultPage({ outcome: "invalid" }));
    return;
  }
  const result =
    intent === "confirm"
      ? confirmRoomStillFree(db, found.propertyId, roomId)
      : markRoomRented(db, found.propertyId, roomId);
  if (!result.ok) {
    sendHtml(res, 409, availabilityResultPage({ outcome: "invalid" }));
    return;
  }
  sendHtml(
    res,
    200,
    availabilityResultPage({
      outcome: result.outcome,
      title: result.title,
      claimUrl: availabilityClaimUrl(db, found.propertyId),
    }),
  );
}

/** Short links. SMS GET shows both choices. Email `?e=1` applies the button they already tapped. */
export function installListingAvailabilityRoutes(app: Express, db: DatabaseSync): void {
  ensureListingAvailabilitySchema(db);
  const parseBody = express.urlencoded({ extended: false });
  const mount = (action: AvailabilityAction, prefix: "/c" | "/p") => {
    app.get(`${prefix}/:code`, (req: Request, res: Response) => {
      const parsed = parseAvailabilityActionPath(req.path);
      const code = String(req.params.code ?? parsed?.code ?? "");
      if (!parsed || parsed.action !== action) {
        sendHtml(res, 404, availabilityResultPage({ outcome: "invalid" }));
        return;
      }
      handleGet(db, req, res, action, code);
    });
    app.post(`${prefix}/:code`, parseBody, (req: Request, res: Response) => {
      const parsed = parseAvailabilityActionPath(req.path);
      const code = String(req.params.code ?? parsed?.code ?? "");
      if (!parsed || parsed.action !== action) {
        sendHtml(res, 404, availabilityResultPage({ outcome: "invalid" }));
        return;
      }
      handlePost(db, req, res, action, code);
    });
  };
  mount("confirm", "/c");
  mount("pause", "/p");
}
