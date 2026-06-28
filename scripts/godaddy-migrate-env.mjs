#!/usr/bin/env node
/**
 * Split duplicate GODADDY_* lines into PRODUCTION vs OTE named vars.
 * Reads server/.env in order; does not print secrets.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "server", ".env");
if (!existsSync(envPath)) process.exit(1);

const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
/** @type {{ key?: string, secret?: string, base?: string }[]} */
const blocks = [];
let current = {};

for (const line of lines) {
  const m = line.match(/^\s*(GODADDY_API_KEY|GODADDY_API_SECRET|GODADDY_API_BASE_URL)\s*=\s*(.*)$/);
  if (!m) continue;
  const [, k, v] = m;
  let val = v.trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (k === "GODADDY_API_KEY") {
    if (current.key) blocks.push(current);
    current = { key: val };
  } else if (k === "GODADDY_API_SECRET") {
    current.secret = val;
  } else if (k === "GODADDY_API_BASE_URL") {
    current.base = val;
    blocks.push(current);
    current = {};
  }
}
if (current.key) blocks.push(current);

if (blocks.length < 2) {
  const hasProd = env.has("GODADDY_PRODUCTION_API_KEY");
  const hasOte = env.has("GODADDY_OTE_API_KEY");
  if (hasProd && hasOte) {
    console.log("Already migrated (GODADDY_PRODUCTION_* and GODADDY_OTE_* present).");
    process.exit(0);
  }
  console.log("No duplicate GODADDY blocks to migrate.");
  process.exit(0);
}

const prod = blocks.find((b) => b.base?.includes("ote") === false && b.base?.includes("godaddy.com"));
const ote = blocks.find((b) => b.base?.includes("ote-godaddy.com"));

if (!prod?.key || !prod?.secret || !ote?.key || !ote?.secret) {
  console.error("Could not identify both Production and OTE credential blocks.");
  process.exit(1);
}

const out = [];
let inGodaddy = false;
for (const line of lines) {
  if (/^\s*GODADDY_API_(KEY|SECRET|BASE_URL)\s*=/.test(line)) {
    if (!inGodaddy) {
      inGodaddy = true;
      out.push("");
      out.push("# GoDaddy API — Production (live bestie.mx DNS)");
      out.push(`GODADDY_PRODUCTION_API_KEY=${prod.key}`);
      out.push(`GODADDY_PRODUCTION_API_SECRET=${prod.secret}`);
      out.push("");
      out.push("# GoDaddy API — OTE sandbox (test only)");
      out.push(`GODADDY_OTE_API_KEY=${ote.key}`);
      out.push(`GODADDY_OTE_API_SECRET=${ote.secret}`);
      out.push("");
      out.push("# Default for scripts/godaddy-api.mjs (production)");
      out.push(`GODADDY_API_KEY=${prod.key}`);
      out.push(`GODADDY_API_SECRET=${prod.secret}`);
      out.push("GODADDY_API_BASE_URL=https://api.godaddy.com");
    }
    continue;
  }
  inGodaddy = false;
  out.push(line);
}

writeFileSync(envPath, out.join("\n").replace(/\n{3,}/g, "\n\n"), "utf8");
console.log("Migrated server/.env → GODADDY_PRODUCTION_* + GODADDY_OTE_* (no duplicate keys).");
