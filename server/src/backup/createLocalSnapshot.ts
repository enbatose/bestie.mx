import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { backup } from "node:sqlite";
import type { DatabaseSync } from "node:sqlite";

const execFileAsync = promisify(execFile);

export type BackupManifest = {
  createdAt: string;
  dateKey: string;
  timezone: string;
  databasePath: string;
  uploadDir: string;
  archiveBytes: number;
  archiveSha256: string;
  dbBytes: number;
  uploadFileCount: number;
};

export type LocalSnapshotResult = {
  workDir: string;
  archivePath: string;
  manifest: BackupManifest;
  manifestJson: string;
};

function countFilesRecursive(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  const walk = (d: string) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else n += 1;
    }
  };
  walk(dir);
  return n;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve());
  });
  return hash.digest("hex");
}

/**
 * Consistent online SQLite backup + uploads tree packed into a gzip tar.
 * Caller must delete `workDir` when done.
 */
export async function createLocalDataSnapshot(opts: {
  db: DatabaseSync;
  databasePath: string;
  uploadDir: string;
  dateKey: string;
  timezone: string;
}): Promise<LocalSnapshotResult> {
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "bestie-backup-"));
  const payloadDir = path.join(workDir, "payload");
  await fs.promises.mkdir(payloadDir, { recursive: true });

  const dbOut = path.join(payloadDir, "bestie.db");
  await backup(opts.db, dbOut);

  const uploadsSrc = opts.uploadDir;
  const uploadsDest = path.join(payloadDir, "uploads");
  if (fs.existsSync(uploadsSrc)) {
    await fs.promises.cp(uploadsSrc, uploadsDest, { recursive: true, force: true });
  } else {
    await fs.promises.mkdir(uploadsDest, { recursive: true });
  }

  const dbBytes = (await fs.promises.stat(dbOut)).size;
  const uploadFileCount = countFilesRecursive(uploadsDest);
  const manifestDraft: Omit<BackupManifest, "archiveBytes" | "archiveSha256"> = {
    createdAt: new Date().toISOString(),
    dateKey: opts.dateKey,
    timezone: opts.timezone,
    databasePath: opts.databasePath,
    uploadDir: opts.uploadDir,
    dbBytes,
    uploadFileCount,
  };
  await fs.promises.writeFile(
    path.join(payloadDir, "manifest.json"),
    `${JSON.stringify({ ...manifestDraft, archiveBytes: 0, archiveSha256: "" }, null, 2)}\n`,
    "utf8",
  );

  const archivePath = path.join(workDir, "bestie-data.tar.gz");
  await execFileAsync("tar", ["-czf", archivePath, "-C", payloadDir, "."], {
    maxBuffer: 32 * 1024 * 1024,
  });

  const archiveBytes = (await fs.promises.stat(archivePath)).size;
  const archiveSha256 = await sha256File(archivePath);
  const manifest: BackupManifest = {
    ...manifestDraft,
    archiveBytes,
    archiveSha256,
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  // Final manifest (with checksums) is uploaded separately as latest/manifest.json.

  return { workDir, archivePath, manifest, manifestJson };
}

export async function removeSnapshotWorkDir(workDir: string): Promise<void> {
  await fs.promises.rm(workDir, { recursive: true, force: true });
}
