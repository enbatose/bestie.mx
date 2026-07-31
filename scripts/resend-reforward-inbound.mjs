#!/usr/bin/env node
/**
 * Re-forward recent Resend inbound emails that match contacto@ (or support aliases).
 *
 * Use when Facebook/Meta validation mail landed in Resend but the webhook forward
 * failed (e.g. sending-only API key) or Gmail never showed the forward.
 *
 * Env (server/.env): RESEND_RECEIVING_API_KEY or RESEND_ADMIN_API_KEY (full_access)
 * Optional: RESEND_CONTACT_FORWARD_TO, RESEND_CONTACT_FORWARD_FROM
 *
 * Usage:
 *   node --env-file=server/.env scripts/resend-reforward-inbound.mjs
 *   node --env-file=server/.env scripts/resend-reforward-inbound.mjs --dry-run
 *   node --env-file=server/.env scripts/resend-reforward-inbound.mjs --limit=25
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");

const CONTACT = "contacto@bestie.mx";
const EXTRA = ["soporte@bestie.mx", "support@bestie.mx", "privacy@bestie.mx"];
const DEFAULT_TO = "batani.enrique@gmail.com";

/** @param {string} content */
function parseEnv(content) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let v = trimmed.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    map.set(trimmed.slice(0, eq).trim(), v);
  }
  return map;
}

function normalizeEmail(value) {
  const trimmed = String(value ?? "").trim();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle?.[1] ?? trimmed).trim().toLowerCase();
}

function shouldForward(toList) {
  const targets = new Set([CONTACT, ...EXTRA]);
  return (toList ?? []).some((t) => targets.has(normalizeEmail(t)));
}

/**
 * @param {string} key
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function resendApi(key, path, init = {}) {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text.slice(0, 300) };
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body && "message" in body
        ? String(body.message)
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const key =
  env.get("RESEND_RECEIVING_API_KEY") ||
  env.get("RESEND_ADMIN_API_KEY") ||
  env.get("RESEND_API_KEY");
if (!key) {
  console.error("Need RESEND_RECEIVING_API_KEY or RESEND_ADMIN_API_KEY in server/.env");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = Math.min(50, Math.max(1, Number(limitArg?.split("=")[1] || 20)));
const forwardTo = env.get("RESEND_CONTACT_FORWARD_TO") || DEFAULT_TO;
const forwardFrom =
  env.get("RESEND_CONTACT_FORWARD_FROM") || `Bestie Contacto <${CONTACT}>`;

console.log(`Listing up to ${limit} received emails…`);
let listed;
try {
  listed = await resendApi(key, `/emails/receiving?limit=${limit}`);
} catch (e) {
  console.error("List failed:", e instanceof Error ? e.message : e);
  console.error("Hint: receiving APIs need full_access (RESEND_RECEIVING_API_KEY).");
  process.exit(1);
}

const rows = Array.isArray(listed?.data) ? listed.data : [];
console.log(`Got ${rows.length}. Forward target: ${forwardTo}${dryRun ? " (dry-run)" : ""}`);

let matched = 0;
let forwarded = 0;
for (const row of rows) {
  const to = row.to ?? [];
  if (!shouldForward(to)) continue;
  matched += 1;
  const id = row.id;
  const subject = String(row.subject ?? "").slice(0, 70);
  console.log(`\n→ ${id}`);
  console.log(`  from=${row.from} to=${to.join(",")} subject=${subject}`);
  if (dryRun) continue;
  try {
    const fwd = await resendApi(key, `/emails/receiving/${id}/forward`, {
      method: "POST",
      body: JSON.stringify({ from: forwardFrom, to: forwardTo }),
    });
    forwarded += 1;
    console.log(`  forwarded id=${fwd?.id ?? "ok"}`);
  } catch (e) {
    console.error(`  FORWARD FAILED: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\nMatched ${matched}, forwarded ${forwarded}${dryRun ? " (dry-run)" : ""}.`);
process.exit(0);
