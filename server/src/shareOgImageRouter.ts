import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import express, { type Request, type Response } from "express";
import {
  SHARE_OG_IMAGE_VERSION,
  composeBrandedShareImage,
  readUploadBytes,
  resolveShareOgSourceFilename,
} from "./shareOgImage.js";

export type ShareOgImageRouterOpts = {
  db: DatabaseSync;
  uploadDir: string;
};

/**
 * GET /api/share-og/anuncio/:ref.jpg — branded room cover for social scrapers.
 * GET /api/share-og/propiedad/:ref.jpg — branded property cover.
 */
export function shareOgImageRouter(opts: ShareOgImageRouterOpts) {
  const r = express.Router();

  async function handle(kind: "anuncio" | "propiedad", req: Request, res: Response) {
    const raw = String(req.params.ref ?? "");
    const filename = resolveShareOgSourceFilename(opts.db, { kind, refParam: raw });
    if (!filename) {
      res.status(404).type("text/plain").send("not_found");
      return;
    }
    const bytes = readUploadBytes(opts.uploadDir, opts.db, filename);
    if (!bytes) {
      res.status(404).type("text/plain").send("image_missing");
      return;
    }

    try {
      const jpeg = await composeBrandedShareImage(bytes);
      const etag = `"${SHARE_OG_IMAGE_VERSION}-${createHash("sha1").update(jpeg).digest("hex").slice(0, 16)}"`;
      if (req.get("if-none-match") === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("ETag", etag);
      res.type("image/jpeg");
      res.send(jpeg);
    } catch (err) {
      console.error("[share-og] compose failed", err);
      res.status(500).type("text/plain").send("compose_failed");
    }
  }

  r.get("/anuncio/:ref", (req, res) => {
    void handle("anuncio", req, res);
  });
  r.get("/propiedad/:ref", (req, res) => {
    void handle("propiedad", req, res);
  });

  return r;
}
