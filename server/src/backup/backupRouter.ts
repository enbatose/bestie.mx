import { timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Router, type Request, type Response } from "express";
import { resolveUploadDir } from "../dataPaths.js";
import { backupJobSecret, backupsEnabled } from "./backupConfig.js";
import { runProductionBackup, sendBackupFailureAlert } from "./runProductionBackup.js";

function authorized(req: Request): boolean {
  const expected = backupJobSecret();
  if (!expected || expected.length < 16) return false;
  const header = String(req.headers.authorization ?? "");
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = String(req.headers["x-bestie-backup-secret"] ?? "").trim();
  const got = bearer || alt;
  if (!got || got.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function backupRouter(db: DatabaseSync, databasePath: string | undefined): Router {
  const router = Router();

  router.post("/run", (req: Request, res: Response) => {
    void (async () => {
      if (!authorized(req)) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      if (!backupsEnabled()) {
        res.status(503).json({ error: "backup_disabled" });
        return;
      }
      if (!databasePath) {
        res.status(500).json({ error: "database_path_missing" });
        return;
      }
      try {
        const result = await runProductionBackup({
          db,
          databasePath,
          uploadDir: resolveUploadDir(databasePath),
        });
        res.json(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[backup] run failed: ${message}`);
        await sendBackupFailureAlert("prod_backup_run", message);
        res.status(500).json({ error: "backup_failed", message });
      }
    })();
  });

  return router;
}
