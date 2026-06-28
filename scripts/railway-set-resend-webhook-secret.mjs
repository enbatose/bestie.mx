#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "server", ".env");
if (!existsSync(envPath)) process.exit(1);

const line = readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("RESEND_WEBHOOK_SECRET="));
if (!line) {
  console.error("RESEND_WEBHOOK_SECRET not in server/.env");
  process.exit(1);
}
const value = line.slice("RESEND_WEBHOOK_SECRET=".length).trim();
const r = spawnSync("railway", ["variable", "set", `RESEND_WEBHOOK_SECRET=${value}`], {
  stdio: "inherit",
  shell: false,
  cwd: resolve(dirname(fileURLToPath(import.meta.url)), ".."),
});
process.exit(r.status ?? 1);
