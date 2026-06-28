#!/usr/bin/env node
/**
 * Validate GoDaddy API credentials without printing secrets.
 *
 * Supports either:
 *   GODADDY_PRODUCTION_API_KEY + GODADDY_PRODUCTION_API_SECRET
 *   GODADDY_OTE_API_KEY + GODADDY_OTE_API_SECRET
 * or legacy single pair + GODADDY_API_BASE_URL (one environment only).
 *
 * Usage: node scripts/godaddy-validate.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");

/** @param {string} content */
function parseEnv(content) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    let v = trimmed.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    map.set(k, v);
  }
  return map;
}

/** @param {string} baseUrl @param {string} key @param {string} secret */
async function probe(baseUrl, key, secret) {
  const base = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/v1/domains?limit=5`, {
    headers: {
      Authorization: `sso-key ${key}:${secret}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text.slice(0, 200);
  }
  const domains = Array.isArray(body)
    ? body.map((d) => (typeof d === "string" ? d : d?.domain)).filter(Boolean)
    : [];
  return { status: res.status, ok: res.ok, domains, error: res.ok ? null : body };
}

function maskKey(name, value) {
  if (!value) return `${name}: (missing)`;
  const v = String(value);
  const tail = v.length >= 4 ? v.slice(-4) : "****";
  return `${name}: set (${v.length} chars, ends …${tail})`;
}

function reportDuplicateKeys(raw) {
  const counts = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const dups = [...counts.entries()].filter(([, n]) => n > 1);
  return dups;
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const raw = readFileSync(envPath, "utf8");
const env = parseEnv(raw);
const dups = reportDuplicateKeys(raw);

console.log(`Env file: ${envPath}\n`);

if (dups.length) {
  console.log("⚠ Duplicate keys in .env (Node --env-file keeps the LAST value only):");
  for (const [k, n] of dups) console.log(`  - ${k} appears ${n} times`);
  console.log("");
}

const pairs = [
  {
    label: "Production",
    baseUrl: "https://api.godaddy.com",
    key: env.get("GODADDY_PRODUCTION_API_KEY") ?? env.get("GODADDY_API_KEY"),
    secret: env.get("GODADDY_PRODUCTION_API_SECRET") ?? env.get("GODADDY_API_SECRET"),
  },
  {
    label: "OTE",
    baseUrl: "https://api.ote-godaddy.com",
    key: env.get("GODADDY_OTE_API_KEY"),
    secret: env.get("GODADDY_OTE_API_SECRET"),
  },
];

let failed = 0;

for (const p of pairs) {
  console.log(`── ${p.label} (${p.baseUrl}) ──`);
  console.log(maskKey("API key", p.key));
  console.log(maskKey("API secret", p.secret));

  if (!p.key || !p.secret) {
    console.log("Result: SKIPPED (credentials not found under expected variable names)\n");
    failed++;
    continue;
  }

  try {
    const result = await probe(p.baseUrl, p.key, p.secret);
    if (result.ok) {
      console.log(`Result: OK (HTTP ${result.status})`);
      if (result.domains.length) {
        console.log(`Domains (sample): ${result.domains.join(", ")}`);
      } else {
        console.log("Domains: (none returned — account may be empty in this environment)");
      }
    } else {
      console.log(`Result: FAILED (HTTP ${result.status})`);
      const errMsg =
        typeof result.error === "object" && result.error && "message" in result.error
          ? String(result.error.message)
          : JSON.stringify(result.error)?.slice(0, 240);
      if (errMsg) console.log(`Error: ${errMsg}`);
      failed++;
    }
  } catch (e) {
    console.log(`Result: FAILED (network)`);
    console.log(`Error: ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
  console.log("");
}

// Resend sanity (no secret values)
const resendKey = env.get("RESEND_API_KEY");
const resendAdminKey = env.get("RESEND_ADMIN_API_KEY");
const emailFrom = env.get("EMAIL_FROM");
console.log("── Resend (local mail) ──");
console.log(maskKey("RESEND_API_KEY", resendKey));
console.log(maskKey("RESEND_ADMIN_API_KEY", resendAdminKey));
console.log(`EMAIL_FROM: ${emailFrom ? emailFrom.replace(/[^\s@<>a-zA-Z0-9._-]/g, "") || "(set)" : "(missing)"}`);
if (resendAdminKey) {
  console.log("MCP admin: RESEND_ADMIN_API_KEY set (used by scripts/resend-mcp-launch.mjs)");
}

if (dups.some(([k]) => k.startsWith("GODADDY_"))) {
  console.log("\nRecommendation: use separate variable names in server/.env:");
  console.log("  GODADDY_PRODUCTION_API_KEY / GODADDY_PRODUCTION_API_SECRET");
  console.log("  GODADDY_OTE_API_KEY / GODADDY_OTE_API_SECRET");
  console.log("Remove duplicate GODADDY_API_KEY lines so both environments can be used.");
}

process.exit(failed > 0 ? 1 : 0);
