#!/usr/bin/env node
/** Push RESEND_API_KEY and EMAIL_FROM from server/.env to Railway. */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
if (!existsSync(envPath)) process.exit(1);

/** @param {string} key */
function getEnv(key) {
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  if (!line) return undefined;
  let v = line.slice(key.length + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v || undefined;
}

const apiKey = getEnv("RESEND_API_KEY");
const emailFrom = getEnv("EMAIL_FROM");
if (!apiKey || !emailFrom) {
  console.error("Need RESEND_API_KEY and EMAIL_FROM in server/.env");
  process.exit(1);
}

for (const [k, v] of [
  ["RESEND_API_KEY", apiKey],
  ["EMAIL_FROM", emailFrom],
]) {
  const args =
    /[\s<>"]/.test(v) && k === "EMAIL_FROM"
      ? ["variable", "set", k, "--stdin"]
      : ["variable", "set", `${k}=${v}`];
  const r = spawnSync("railway", args, {
    stdio: /[\s<>"]/.test(v) && k === "EMAIL_FROM" ? ["pipe", "inherit", "inherit"] : "inherit",
    input: /[\s<>"]/.test(v) && k === "EMAIL_FROM" ? v : undefined,
    shell: false,
    cwd: root,
  });
  if ((r.status ?? 1) !== 0) process.exit(r.status ?? 1);
  console.log(`Set ${k} on Railway`);
}
