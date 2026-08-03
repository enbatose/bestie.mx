import type { DatabaseSync } from "node:sqlite";
import { sendTransactionalEmail } from "../mailer.js";
import {
  BACKUP_TIMEZONE,
  backupAlertTo,
  backupsEnabled,
  mexicoCityParts,
  readBackupS3Config,
} from "./backupConfig.js";
import { createLocalDataSnapshot, removeSnapshotWorkDir } from "./createLocalSnapshot.js";
import { createBackupS3Client, uploadSnapshotArtifacts } from "./backupS3.js";

export type BackupRunResult = {
  ok: true;
  dateKey: string;
  keys: string[];
  archiveBytes: number;
  archiveSha256: string;
  prunedDaily: number;
  prunedWeekly: number;
  durationMs: number;
};

export async function sendBackupFailureAlert(reason: string, detail?: string): Promise<void> {
  const to = backupAlertTo();
  const text = [
    "El respaldo nocturno de Bestie (prod) falló.",
    "",
    `reason=${reason}`,
    detail ? `detail=${detail.slice(0, 2000)}` : "",
    "",
    "Revisa logs del servicio bestie-prod / bestie-backup en Railway.",
  ]
    .filter(Boolean)
    .join("\n");
  await sendTransactionalEmail({
    to,
    subject: "[Bestie] Falló el respaldo diario de producción",
    text,
    html: `<p>El respaldo nocturno de Bestie (prod) falló.</p><p><code>reason=${reason}</code></p>${
      detail ? `<pre>${detail.slice(0, 2000).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] ?? c))}</pre>` : ""
    }`,
    tags: [
      { name: "category", value: "backup_alert" },
      { name: "product", value: "bestie" },
    ],
  });
}

/**
 * Snapshot SQLite + uploads and push to the off-volume object store.
 * Idempotent for the same calendar day (overwrites that day's key + latest).
 */
export async function runProductionBackup(opts: {
  db: DatabaseSync;
  databasePath: string;
  uploadDir: string;
  /** When true, skip BACKUP_ENABLED gate (cron already decided). */
  force?: boolean;
}): Promise<BackupRunResult> {
  const started = Date.now();
  if (!opts.force && !backupsEnabled()) {
    throw new Error("backup_disabled");
  }
  const s3cfg = readBackupS3Config();
  if (!s3cfg) throw new Error("backup_s3_not_configured");

  const { dateKey, weekday } = mexicoCityParts();
  const isSunday = weekday === "Sun";
  const snapshot = await createLocalDataSnapshot({
    db: opts.db,
    databasePath: opts.databasePath,
    uploadDir: opts.uploadDir,
    dateKey,
    timezone: BACKUP_TIMEZONE,
  });

  try {
    const client = createBackupS3Client(s3cfg);
    const uploaded = await uploadSnapshotArtifacts({
      client,
      bucket: s3cfg.bucket,
      archivePath: snapshot.archivePath,
      manifestJson: snapshot.manifestJson,
      dateKey,
      isSunday,
    });
    return {
      ok: true,
      dateKey,
      keys: uploaded.keys,
      archiveBytes: snapshot.manifest.archiveBytes,
      archiveSha256: snapshot.manifest.archiveSha256,
      prunedDaily: uploaded.prunedDaily,
      prunedWeekly: uploaded.prunedWeekly,
      durationMs: Date.now() - started,
    };
  } finally {
    await removeSnapshotWorkDir(snapshot.workDir);
  }
}
