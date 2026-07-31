import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs from "node:fs";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import {
  BACKUP_DAILY_RETENTION,
  BACKUP_OBJECT_PREFIX,
  BACKUP_WEEKLY_RETENTION,
  type BackupS3Config,
  dailyObjectKey,
  latestManifestKey,
  latestObjectKey,
  weeklyObjectKey,
} from "./backupConfig.js";

export function createBackupS3Client(cfg: BackupS3Config): S3Client {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

export async function putBackupObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function putBackupFile(
  client: S3Client,
  bucket: string,
  key: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const body = await fs.promises.readFile(filePath);
  await putBackupObject(client, bucket, key, body, contentType);
}

export async function downloadBackupObject(
  client: S3Client,
  bucket: string,
  key: string,
  destPath: string,
): Promise<number> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`empty_body:${key}`);
  await fs.promises.mkdir(pathDirname(destPath), { recursive: true });
  const body = res.Body as Readable;
  await pipeline(body, createWriteStream(destPath));
  const st = await fs.promises.stat(destPath);
  return st.size;
}

function pathDirname(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(0, i) : ".";
}

async function listKeysWithPrefix(client: S3Client, bucket: string, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const obj of page.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

/** Delete dated folders under prefix/ keeping the newest `keep` date keys. */
export async function pruneDatedBackupPrefixes(
  client: S3Client,
  bucket: string,
  kind: "daily" | "weekly",
  keep: number,
): Promise<number> {
  const prefix = `${BACKUP_OBJECT_PREFIX}/${kind}/`;
  const keys = await listKeysWithPrefix(client, bucket, prefix);
  const byDate = new Map<string, string[]>();
  for (const key of keys) {
    const rest = key.slice(prefix.length);
    const dateKey = rest.split("/")[0];
    if (!dateKey) continue;
    const list = byDate.get(dateKey) ?? [];
    list.push(key);
    byDate.set(dateKey, list);
  }
  const dates = [...byDate.keys()].sort().reverse();
  const toDrop = dates.slice(keep);
  let deleted = 0;
  for (const dateKey of toDrop) {
    for (const key of byDate.get(dateKey) ?? []) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      deleted += 1;
    }
  }
  return deleted;
}

export async function uploadSnapshotArtifacts(opts: {
  client: S3Client;
  bucket: string;
  archivePath: string;
  manifestJson: string;
  dateKey: string;
  isSunday: boolean;
}): Promise<{ keys: string[]; prunedDaily: number; prunedWeekly: number }> {
  const keys = [dailyObjectKey(opts.dateKey), latestObjectKey(), latestManifestKey()];
  await putBackupFile(opts.client, opts.bucket, dailyObjectKey(opts.dateKey), opts.archivePath, "application/gzip");
  await putBackupFile(opts.client, opts.bucket, latestObjectKey(), opts.archivePath, "application/gzip");
  await putBackupObject(
    opts.client,
    opts.bucket,
    latestManifestKey(),
    opts.manifestJson,
    "application/json",
  );
  if (opts.isSunday) {
    const wk = weeklyObjectKey(opts.dateKey);
    await putBackupFile(opts.client, opts.bucket, wk, opts.archivePath, "application/gzip");
    keys.push(wk);
  }
  const prunedDaily = await pruneDatedBackupPrefixes(
    opts.client,
    opts.bucket,
    "daily",
    BACKUP_DAILY_RETENTION,
  );
  const prunedWeekly = await pruneDatedBackupPrefixes(
    opts.client,
    opts.bucket,
    "weekly",
    BACKUP_WEEKLY_RETENTION,
  );
  return { keys, prunedDaily, prunedWeekly };
}
