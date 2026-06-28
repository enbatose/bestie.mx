#!/usr/bin/env node
/** Keep first occurrence of each GODADDY_* variable in server/.env. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "server", ".env");
const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
const seen = new Set();
const out = [];

for (const line of lines) {
  const m = line.match(/^\s*(GODADDY_[A-Z0-9_]+)\s*=/);
  if (m) {
    const key = m[1];
    if (seen.has(key)) continue;
    seen.add(key);
  }
  out.push(line);
}

writeFileSync(envPath, out.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
console.log("Kept first occurrence of each GODADDY_* variable.");
