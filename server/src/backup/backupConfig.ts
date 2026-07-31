import { cleanEnv } from "../mailer.js";

/** IANA timezone for scheduled prod backups (DST-aware midnight). */
export const BACKUP_TIMEZONE = "America/Mexico_City";

/** Keep this many dated daily object-store snapshots. */
export const BACKUP_DAILY_RETENTION = 14;

/** Keep this many weekly object-store snapshots (written on Sundays). */
export const BACKUP_WEEKLY_RETENTION = 8;

/** Keep this many dated copies on the warm US-East volume. */
export const BACKUP_WARM_DAILY_RETENTION = 7;

export const BACKUP_OBJECT_PREFIX = "bestie-prod";
export const BACKUP_ARCHIVE_NAME = "bestie-data.tar.gz";
export const BACKUP_MANIFEST_NAME = "manifest.json";

export type BackupS3Config = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export function backupJobSecret(): string {
  return cleanEnv(process.env.BACKUP_JOB_SECRET);
}

export function backupAlertTo(): string {
  return (
    cleanEnv(process.env.BACKUP_ALERT_TO) ||
    cleanEnv(process.env.RESEND_CONTACT_FORWARD_TO) ||
    "batani.enrique@gmail.com"
  );
}

/** When unset, backup HTTP trigger is disabled (safe default). */
export function backupsEnabled(): boolean {
  return cleanEnv(process.env.BACKUP_ENABLED) === "1";
}

export function readBackupS3Config(): BackupS3Config | null {
  const endpoint =
    cleanEnv(process.env.BACKUP_S3_ENDPOINT) || cleanEnv(process.env.AWS_ENDPOINT_URL);
  const bucket =
    cleanEnv(process.env.BACKUP_S3_BUCKET) ||
    cleanEnv(process.env.AWS_S3_BUCKET_NAME) ||
    cleanEnv(process.env.BUCKET);
  const accessKeyId =
    cleanEnv(process.env.BACKUP_S3_ACCESS_KEY_ID) || cleanEnv(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey =
    cleanEnv(process.env.BACKUP_S3_SECRET_ACCESS_KEY) ||
    cleanEnv(process.env.AWS_SECRET_ACCESS_KEY);
  const region =
    cleanEnv(process.env.BACKUP_S3_REGION) || cleanEnv(process.env.AWS_REGION) || "auto";
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  const forcePathStyle =
    cleanEnv(process.env.BACKUP_S3_FORCE_PATH_STYLE) !== "0" &&
    cleanEnv(process.env.AWS_S3_FORCE_PATH_STYLE) !== "0";
  return { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle };
}

export function mexicoCityParts(now = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: string;
  dateKey: string;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BACKUP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  let hour = Number(parts.hour);
  // Some engines emit hour "24" at midnight.
  if (hour === 24) hour = 0;
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  return { year, month, day, hour, weekday: parts.weekday ?? "", dateKey };
}

/** True when local Mexico City clock is in the midnight hour (00:00–00:59). */
export function isMexicoCityMidnightHour(now = new Date()): boolean {
  return mexicoCityParts(now).hour === 0;
}

export function dailyObjectKey(dateKey: string): string {
  return `${BACKUP_OBJECT_PREFIX}/daily/${dateKey}/${BACKUP_ARCHIVE_NAME}`;
}

export function weeklyObjectKey(dateKey: string): string {
  return `${BACKUP_OBJECT_PREFIX}/weekly/${dateKey}/${BACKUP_ARCHIVE_NAME}`;
}

export function latestObjectKey(): string {
  return `${BACKUP_OBJECT_PREFIX}/latest/${BACKUP_ARCHIVE_NAME}`;
}

export function latestManifestKey(): string {
  return `${BACKUP_OBJECT_PREFIX}/latest/${BACKUP_MANIFEST_NAME}`;
}
