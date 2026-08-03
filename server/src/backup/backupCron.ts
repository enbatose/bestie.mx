import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { sendTransactionalEmail } from "../mailer.js";
import {
  BACKUP_ARCHIVE_NAME,
  BACKUP_WARM_DAILY_RETENTION,
  backupAlertTo,
  isMexicoCityMidnightHour,
  latestManifestKey,
  latestObjectKey,
  mexicoCityParts,
  readBackupS3Config,
} from "./backupConfig.js";
import { createBackupS3Client, downloadBackupObject } from "./backupS3.js";

const execFileAsync = promisify(execFile);

async function alert(reason: string, detail?: string): Promise<void> {
  const to = backupAlertTo();
  await sendTransactionalEmail({
    to,
    subject: "[Bestie] Falló el respaldo diario de producción",
    text: `reason=${reason}\n${detail ?? ""}`,
    html: `<p><code>reason=${reason}</code></p><pre>${(detail ?? "").slice(0, 2000)}</pre>`,
    tags: [
      { name: "category", value: "backup_alert" },
      { name: "product", value: "bestie" },
    ],
  });
}

async function pruneWarmDaily(archiveRoot: string): Promise<void> {
  if (!fs.existsSync(archiveRoot)) return;
  const dates = (await fs.promises.readdir(archiveRoot))
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort()
    .reverse();
  for (const dateKey of dates.slice(BACKUP_WARM_DAILY_RETENTION)) {
    await fs.promises.rm(path.join(archiveRoot, dateKey), { recursive: true, force: true });
  }
}

/**
 * Cron entry for `bestie-backup` (US East warm volume).
 * Runs only during Mexico City midnight hour (Railway cron is UTC-only).
 */
export async function runBackupCronJob(): Promise<number> {
  const force = process.env.BACKUP_CRON_FORCE === "1";
  if (!force && !isMexicoCityMidnightHour()) {
    const parts = mexicoCityParts();
    console.log(
      `[backup-cron] skip: Mexico City hour=${parts.hour} (need 0); date=${parts.dateKey}`,
    );
    return 0;
  }

  const s3cfg = readBackupS3Config();
  if (!s3cfg) {
    console.error("[backup-cron] BACKUP_S3_* not configured");
    await alert("warm_s3_not_configured");
    return 1;
  }

  const secret = (process.env.BACKUP_JOB_SECRET ?? "").trim();
  const triggerUrl = (process.env.BACKUP_TRIGGER_URL ?? "").trim();
  if (!secret || !triggerUrl) {
    console.error("[backup-cron] BACKUP_JOB_SECRET or BACKUP_TRIGGER_URL missing");
    await alert("warm_trigger_misconfigured");
    return 1;
  }

  console.log(`[backup-cron] triggering ${triggerUrl}`);
  const triggerRes = await fetch(triggerUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
  });
  const triggerBody = await triggerRes.text();
  if (triggerRes.status === 503) {
    let disabled = false;
    try {
      disabled = (JSON.parse(triggerBody) as { error?: string }).error === "backup_disabled";
    } catch {
      /* ignore */
    }
    if (disabled) {
      console.log("[backup-cron] prod reports backup_disabled — soft skip");
      return 0;
    }
  }
  if (!triggerRes.ok) {
    console.error(
      `[backup-cron] trigger failed status=${triggerRes.status} body=${triggerBody.slice(0, 500)}`,
    );
    await alert(
      "warm_trigger_failed",
      `status=${triggerRes.status} body=${triggerBody.slice(0, 1500)}`,
    );
    return 1;
  }
  console.log(`[backup-cron] trigger ok: ${triggerBody.slice(0, 400)}`);

  const dataRoot = (process.env.BACKUP_DATA_DIR ?? "/data").trim() || "/data";
  const latestDir = path.join(dataRoot, "latest");
  const dailyRoot = path.join(dataRoot, "daily");
  await fs.promises.mkdir(latestDir, { recursive: true });
  await fs.promises.mkdir(dailyRoot, { recursive: true });

  const client = createBackupS3Client(s3cfg);
  const archivePath = path.join(latestDir, BACKUP_ARCHIVE_NAME);
  const manifestPath = path.join(latestDir, "manifest.json");
  const bytes = await downloadBackupObject(client, s3cfg.bucket, latestObjectKey(), archivePath);
  await downloadBackupObject(client, s3cfg.bucket, latestManifestKey(), manifestPath);
  console.log(`[backup-cron] downloaded latest archive bytes=${bytes}`);

  const extractDir = path.join(latestDir, "extracted");
  await fs.promises.rm(extractDir, { recursive: true, force: true });
  await fs.promises.mkdir(extractDir, { recursive: true });
  await execFileAsync("tar", ["-xzf", archivePath, "-C", extractDir], {
    maxBuffer: 32 * 1024 * 1024,
  });

  const { dateKey } = mexicoCityParts();
  const dayDir = path.join(dailyRoot, dateKey);
  await fs.promises.rm(dayDir, { recursive: true, force: true });
  await fs.promises.cp(latestDir, dayDir, { recursive: true });
  await pruneWarmDaily(dailyRoot);

  const marker = path.join(dataRoot, "LAST_OK");
  await fs.promises.writeFile(
    marker,
    `${new Date().toISOString()}\ndateKey=${dateKey}\nbytes=${bytes}\n`,
    "utf8",
  );
  console.log(`[backup-cron] warm volume updated dateKey=${dateKey}`);
  return 0;
}
