import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import multer from "multer";
import { getOrCreatePublisherId, readPublisherIdFromRequest } from "./session.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function extForMime(m: string): string {
  if (m === "image/jpeg") return ".jpg";
  if (m === "image/png") return ".png";
  if (m === "image/webp") return ".webp";
  return ".bin";
}

const SAFE_NAME = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(jpg|jpeg|png|webp)$/i;

export type UploadsRouterOptions = {
  uploadDir: string;
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
    if (!fs.existsSync(fp)) {
      res.status(404).end();
      return;
    }
    const lower = filename.toLowerCase();
    if (lower.endsWith(".png")) res.type("image/png");
    else if (lower.endsWith(".webp")) res.type("image/webp");
    else res.type("image/jpeg");
    res.sendFile(fp);
  });

  return r;
}
