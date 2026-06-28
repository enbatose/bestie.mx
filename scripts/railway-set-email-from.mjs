#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
const line = readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("EMAIL_FROM="));
if (!line) process.exit(1);
let v = line.slice("EMAIL_FROM=".length).trim();
if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);

const r = spawnSync("railway", ["variable", "set", "EMAIL_FROM", "--stdin"], {
  input: v,
  stdio: ["pipe", "inherit", "inherit"],
  cwd: root,
});
process.exit(r.status ?? 1);
