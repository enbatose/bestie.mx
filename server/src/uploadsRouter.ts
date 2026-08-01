import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { getOrCreatePublisherId, readPublisherIdFromRequest } from "./session.js";
import { extForUploadMime, normalizeDeclaredImageMime, resolveUploadMime } from "./imageMime.js";

const SAFE_NAME = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(jpg|jpeg|png|webp|gif|avif|bmp)$/i;

export type UploadsRouterOptions = {
  uploadDir: string;
  db?: DatabaseSync;
};

function uploadErrorMessage(err: unknown): { status: number; error: string; message: string } {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return {
        status: 400,
        error: "file_too_large",
        message: "La imagen supera el máximo de 12 MB.",
      };
    }
    return { status: 400, error: "upload_failed", message: "No se pudo subir el archivo." };
  }
  const msg = err instanceof Error ? err.message : "";
  if (msg === "invalid_mimetype") {
    return {
      status: 400,
      error: "invalid_mimetype",
      message: "Formato de imagen no soportado. Usa JPG, PNG o WebP.",
    };
  }
  return { status: 400, error: "upload_failed", message: "No se pudo subir el archivo." };
}

/**
 * POST / (multipart field `file`) — authenticated publisher; returns `{ url }`.
 * GET /:filename — public image bytes.
 */
export function uploadsRouter(opts: UploadsRouterOptions) {
  const uploadDir = path.resolve(opts.uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const m = normalizeDeclaredImageMime(file.mimetype);
      // Accept empty / octet-stream / any image/* — bytes are sniffed in the handler.
      // WhatsApp and Android galleries often omit MIME or send image/jpg.
      if (!m || m === "application/octet-stream" || m === "binary/octet-stream" || m.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("invalid_mimetype"));
      }
    },
  });

  const r = express.Router();

  r.post(
    "/",
    (req: Request, res: Response, next: NextFunction) => {
      upload.single("file")(req, res, (err: unknown) => {
        if (err) {
          const body = uploadErrorMessage(err);
          res.status(body.status).json({ error: body.error, message: body.message });
          return;
        }
        next();
      });
    },
    (req: Request, res: Response) => {
      void (readPublisherIdFromRequest(req) ?? getOrCreatePublisherId(req, res));
      const f = req.file;
      if (!f?.buffer?.length) {
        res.status(400).json({ error: "file_required" });
        return;
      }
      const mime = resolveUploadMime(f.mimetype, f.buffer);
      if (!mime) {
        res.status(400).json({
          error: "invalid_mimetype",
          message: "Formato de imagen no soportado. Usa JPG, PNG o WebP.",
        });
        return;
      }
      const ext = extForUploadMime(mime);
      const name = `${randomUUID()}${ext}`;
      const dest = path.join(uploadDir, name);
      try {
        fs.writeFileSync(dest, f.buffer);
        opts.db
          ?.prepare(
            `INSERT OR REPLACE INTO upload_blobs (filename, mime_type, bytes, created_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(name, mime, f.buffer, new Date().toISOString());
      } catch {
        res.status(500).json({ error: "write_failed" });
        return;
      }
      res.status(201).json({ url: `/api/uploads/${name}` });
    },
  );

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
    if (lower.endsWith(".svg")) {
      res.status(404).end();
      return;
    }
    const fallbackType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : lower.endsWith(".gif")
          ? "image/gif"
          : lower.endsWith(".avif")
            ? "image/avif"
            : lower.endsWith(".bmp")
              ? "image/bmp"
              : "image/jpeg";
    if (fs.existsSync(fp)) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:");
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
    const mime = typeof row.mime_type === "string" ? row.mime_type : fallbackType;
    if (mime === "image/svg+xml" || lower.endsWith(".svg")) {
      res.status(404).end();
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:");
    res.type(mime);
    res.send(Buffer.from(row.bytes as Uint8Array));
  });

  return r;
}
