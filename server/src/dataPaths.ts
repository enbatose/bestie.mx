import path from "node:path";

/**
 * When `UPLOAD_DIR` is unset, store files next to the SQLite DB so a mounted DB volume
 * keeps both listing data and image bytes (avoids ephemeral cwd vs persistent `/data/bestie.db`).
 */
export function resolveUploadDir(databasePath: string | undefined): string {
  const envDir = process.env.UPLOAD_DIR?.trim();
  if (envDir) return path.resolve(envDir);
  const rawDb = databasePath?.trim();
  if (rawDb) {
    const dbAbs = path.isAbsolute(rawDb) ? path.resolve(rawDb) : path.resolve(process.cwd(), rawDb);
    return path.join(path.dirname(dbAbs), "uploads");
  }
  return path.resolve(process.cwd(), "data", "uploads");
}
