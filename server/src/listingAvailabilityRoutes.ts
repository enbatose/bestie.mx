import type { Express, Request, Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import express from "express";
import {
  applyAvailabilityAction,
  ensureListingAvailabilitySchema,
  lookupAvailabilityCode,
  parseAvailabilityActionPath,
  type AvailabilityAction,
} from "./listingAvailability.js";
import { availabilityPromptPage, availabilityResultPage } from "./listingAvailabilityPage.js";

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

function handle(
  db: DatabaseSync,
  req: Request,
  res: Response,
  action: AvailabilityAction,
  code: string,
  mutate: boolean,
): void {
  const found = lookupAvailabilityCode(db, code);
  if (!found || found.action !== action) {
    sendHtml(res, 404, availabilityResultPage({ outcome: "invalid" }));
    return;
  }
  if (!mutate) {
    const meta = loadPlace(db, found.propertyId);
    if (!meta) {
      sendHtml(res, 404, availabilityResultPage({ outcome: "invalid" }));
      return;
    }
    sendHtml(
      res,
      200,
      availabilityPromptPage({
        action,
        title: meta.title,
        place: meta.place,
        formAction: req.path,
      }),
    );
    return;
  }
  const result = applyAvailabilityAction(db, found.propertyId, action);
  if (!result.ok) {
    sendHtml(res, 409, availabilityResultPage({ outcome: "invalid" }));
    return;
  }
  sendHtml(res, 200, availabilityResultPage({ outcome: result.outcome, title: result.title }));
}

/** Short confirm/pause links for SMS and email. GET shows a button; POST performs the action. */
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
      handle(db, req, res, action, code, false);
    });
    app.post(`${prefix}/:code`, parseBody, (req: Request, res: Response) => {
      const parsed = parseAvailabilityActionPath(req.path);
      const code = String(req.params.code ?? parsed?.code ?? "");
      if (!parsed || parsed.action !== action) {
        sendHtml(res, 404, availabilityResultPage({ outcome: "invalid" }));
        return;
      }
      handle(db, req, res, action, code, true);
    });
  };
  mount("confirm", "/c");
  mount("pause", "/p");
}
