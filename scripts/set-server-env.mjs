#!/usr/bin/env node
/** Set or replace one key in server/.env without printing the value. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [key, ...rest] = process.argv.slice(2);
const value = rest.join(" ");
if (!key || !value) {
  console.error("Usage: node scripts/set-server-env.mjs KEY value");
  process.exit(1);
}

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "server", ".env");
if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
const prefix = `${key}=`;
let found = false;
const out = lines.map((line) => {
  if (line.startsWith(prefix) || line.match(new RegExp(`^\\s*${key}\\s*=`))) {
    found = true;
    return `${key}=${value}`;
  }
  return line;
});
if (!found) {
  if (out.length && out[out.length - 1] !== "") out.push("");
  out.push(`${key}=${value}`);
}
writeFileSync(envPath, out.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
console.log(`Set ${key} in server/.env`);
