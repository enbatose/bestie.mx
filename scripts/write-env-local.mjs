#!/usr/bin/env node
/**
 * Writes bestie.mx/.env.local with VITE_API_URL for local API development.
 *
 * Usage:
 *   npm run env:local              → http://localhost:3000
 *   npm run env:local -- 3011      → http://localhost:3011
 */

import { writeFileSync } from "node:fs";
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

const line = `VITE_API_URL=http://localhost:${port}\n`;
writeFileSync(outFile, line, "utf8");
console.log(`Wrote ${outFile}`);
console.log(line.trim());
