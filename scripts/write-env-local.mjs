#!/usr/bin/env node
/**
 * Writes/merges bestie.mx/.env.local: always sets VITE_API_URL; preserves other keys
 * (e.g. VITE_GOOGLE_MAPS_API_KEY) so running this script does not wipe them.
 *
 * Usage:
 *   npm run env:local              → http://localhost:3000
 *   npm run env:local -- 3011      → http://localhost:3011
 *
 * Optional — also set the Google browser key when merging (PowerShell):
 *   $env:VITE_GOOGLE_MAPS_API_KEY="AIza..."; npm run env:local
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outFile = resolve(root, ".env.local");

const raw = process.argv[2] ?? process.env.API_PORT ?? "3000";
const port = Number.parseInt(String(raw), 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${raw}. Use 1–65535, e.g. npm run env:local -- 3000`);
  process.exit(1);
}

/**
 * @param {string} content
 * @returns {{ map: Map<string, string>, order: string[] }}
 */
function parseEnv(content) {
  const map = new Map();
  const order = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    let body = trimmed;
    if (body.startsWith("export ")) body = body.slice(7).trim();
    const eq = body.indexOf("=");
    if (eq === -1) continue;
    const k = body.slice(0, eq).trim();
    let v = body.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!map.has(k)) order.push(k);
    map.set(k, v);
  }
  return { map, order };
}

/**
 * @param {Map<string, string>} map
 * @param {string[]} order
 */
function serializeEnv(map, order) {
  const lines = [];
  for (const k of order) {
    const v = map.get(k);
    if (v === undefined) continue;
    if (/[\s#"'`\\]/.test(v)) {
      const escaped = String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      lines.push(`${k}="${escaped}"`);
    } else {
      lines.push(`${k}=${v}`);
    }
  }
  return lines.join("\n") + "\n";
}

let map = new Map();
let order = [];

if (existsSync(outFile)) {
  try {
    const parsed = parseEnv(readFileSync(outFile, "utf8"));
    map = parsed.map;
    order = [...parsed.order];
  } catch {
    /* ignore corrupt file */
  }
}

function setKey(k, v) {
  if (!map.has(k)) order.push(k);
  map.set(k, v);
}

setKey("VITE_API_URL", `http://localhost:${port}`);

const googleKey = process.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
if (googleKey) setKey("VITE_GOOGLE_MAPS_API_KEY", googleKey);

writeFileSync(outFile, serializeEnv(map, order), "utf8");
console.log(`Wrote ${outFile}`);
console.log(`VITE_API_URL=http://localhost:${port}`);
if (googleKey) console.log("VITE_GOOGLE_MAPS_API_KEY=(set from environment)");
