import type { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import express, { type Request, type Response } from "express";
import { getBlogArticleById } from "./blogDto.js";
import {
  SHARE_OG_IMAGE_VERSION,
  composeBrandedShareImage,
  readUploadBytes,
  resolveShareOgSourceFilename,
  uploadFilenameFromListingPath,
} from "./shareOgImage.js";

export type ShareOgImageRouterOpts = {
  db: DatabaseSync;
  uploadDir: string;
};

/**
 * GET /api/share-og/anuncio/:ref.jpg — branded room cover for social scrapers.
 * GET /api/share-og/propiedad/:ref.jpg — branded property cover.
 * GET /api/share-og/blog/:id.jpg — branded blog cover.
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
    await sendBranded(req, res, bytes);
  }

  async function handleBlog(req: Request, res: Response) {
    const raw = String(req.params.ref ?? "").replace(/\.jpe?g$/i, "").trim();
    const article = getBlogArticleById(opts.db, decodeURIComponent(raw));
    if (!article || article.status !== "published" || !article.cover_image_url) {
      res.status(404).type("text/plain").send("not_found");
      return;
    }
    const localName = uploadFilenameFromListingPath(article.cover_image_url);
    let bytes: Buffer | null = null;
    if (localName) {
      bytes = readUploadBytes(opts.uploadDir, opts.db, localName);
    } else if (/^https?:\/\//i.test(article.cover_image_url)) {
      try {
        const imgRes = await fetch(article.cover_image_url, {
          headers: { "User-Agent": "BestieMXBlog/1.0 (contacto@bestie.mx)" },
          signal: AbortSignal.timeout(15_000),
        });
        if (imgRes.ok) {
          bytes = Buffer.from(await imgRes.arrayBuffer());
        }
      } catch {
        bytes = null;
      }
    }
    if (!bytes) {
      res.status(404).type("text/plain").send("image_missing");
      return;
    }
    await sendBranded(req, res, bytes);
  }

  async function sendBranded(req: Request, res: Response, bytes: Buffer) {
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
  r.get("/blog/:ref", (req, res) => {
    void handleBlog(req, res);
  });

  return r;
}
