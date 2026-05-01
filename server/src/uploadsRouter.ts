import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type Request, type Response } from "express";
import multer from "multer";
import { getOrCreatePublisherId, readPublisherIdFromRequest } from "./session.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/svg+xml", "image/bmp"]);

function extForMime(m: string): string {
  if (m === "image/jpeg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  if (m === "image/gif") return ".gif";
  if (m === "image/avif") return ".avif";
  if (m === "image/svg+xml") return ".svg";
  if (m === "image/bmp") return ".bmp";
  return ".bin";
}

const SAFE_NAME = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(jpg|jpeg|png|webp|gif|avif|svg|bmp)$/i;

export type UploadsRouterOptions = {
  uploadDir: string;
  db?: DatabaseSync;
};

/**
 * POST / (multipart field `file`) — authenticated publisher; returns `{ url }`.
 * GET /:filename — public image bytes.
 */
export function uploadsRouter(opts: UploadsRouterOptions) {
  const uploadDir = path.resolve(opts.uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED.has(file.mimetype)) cb(null, true);
      else cb(new Error("invalid_mimetype"));
    },
  });

  const r = express.Router();

  r.post("/", upload.single("file"), (req: Request, res: Response) => {
    void (readPublisherIdFromRequest(req) ?? getOrCreatePublisherId(req, res));
    const f = req.file;
    if (!f?.buffer?.length) {
      res.status(400).json({ error: "file_required" });
      return;
    }
    const ext = extForMime(f.mimetype);
    const name = `${randomUUID()}${ext}`;
    const dest = path.join(uploadDir, name);
    try {
      fs.writeFileSync(dest, f.buffer);
      opts.db
        ?.prepare(
          `INSERT OR REPLACE INTO upload_blobs (filename, mime_type, bytes, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(name, f.mimetype, f.buffer, new Date().toISOString());
    } catch {
      res.status(500).json({ error: "write_failed" });
      return;
    }
    res.status(201).json({ url: `/api/uploads/${name}` });
  });

  r.get("/:filename", (req: Request, res: Response) => {
    const filename = path.basename(req.params.filename ?? "");
    if (!SAFE_NAME.test(filename)) {
      res.status(400).json({ error: "invalid_name" });
      return;
    }
    const fp = path.join(uploadDir, filename);
    if (!fp.startsWith(uploadDir)) {
      res.status(400).end();
      return;
    }
    const lower = filename.toLowerCase();
    const fallbackType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : lower.endsWith(".gif")
          ? "image/gif"
          : lower.endsWith(".avif")
            ? "image/avif"
            : lower.endsWith(".svg")
              ? "image/svg+xml"
              : lower.endsWith(".bmp")
                ? "image/bmp"
                : "image/jpeg";
    if (fs.existsSync(fp)) {
      res.type(fallbackType);
      res.sendFile(fp);
      return;
    }

    const row = opts.db
      ?.prepare(`SELECT mime_type, bytes FROM upload_blobs WHERE filename = ?`)
      .get(filename) as { mime_type?: unknown; bytes?: unknown } | undefined;
    if (!row?.bytes) {
      res.status(404).end();
      return;
    }
    res.type(typeof row.mime_type === "string" ? row.mime_type : fallbackType);
    res.send(Buffer.from(row.bytes as Uint8Array));
  });

  return r;
}
