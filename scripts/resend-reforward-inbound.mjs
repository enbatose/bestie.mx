#!/usr/bin/env node
/**
 * Re-forward recent Resend inbound emails to contacto@bestie.mx's forward target.
 *
 * Use when Facebook/Meta validation mail landed in Resend but the webhook forward
 * failed (e.g. missing RESEND_RECEIVING_API_KEY) or Gmail never showed the forward.
 *
 * Composes a NEW message (fetches the original body via GET /emails/receiving/:id,
 * then sends with `emails.send`) instead of Resend's raw `emails.receiving.forward` —
 * that raw forward hides the real external sender behind `Bestie Contacto
 * <contacto@bestie.mx>`, which is exactly what made a phishing "Meta suspension"
 * email look legitimate. The composed message always shows the real original
 * sender in the subject (`[Externo: ...]`) and a warning banner in the body.
 *
 * Env (server/.env): RESEND_RECEIVING_API_KEY or RESEND_ADMIN_API_KEY (full_access)
 * Optional: RESEND_CONTACT_FORWARD_TO, RESEND_CONTACT_FORWARD_FROM (defaults to
 * Bestie <no-reply@bestie.mx> — never contacto@bestie.mx, to avoid disguising the sender)
 *
 * Usage:
 *   node --env-file=server/.env scripts/resend-reforward-inbound.mjs
 *   node --env-file=server/.env scripts/resend-reforward-inbound.mjs --dry-run
 *   node --env-file=server/.env scripts/resend-reforward-inbound.mjs --limit=25
 *   node --env-file=server/.env scripts/resend-reforward-inbound.mjs --meta-only
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
const require = createRequire(resolve(root, "server", "package.json"));
const { Resend } = require("resend");

const CONTACT = "contacto@bestie.mx";
const DEFAULT_TO = "batani.enrique@gmail.com";
const META_FROM_RE = /facebookmail\.com|business\.facebook\.com|meta\.com/i;

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
  return (toList ?? []).some((t) => normalizeEmail(t) === CONTACT);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Fetch the full received email body (list() rows don't include html/text). */
async function fetchReceivedBody(apiKey, id) {
  const res = await fetch(`https://api.resend.com/emails/receiving/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    throw new Error(`GET /emails/receiving/${id} failed (status ${res.status})`);
  }
  return { html: body.html ?? null, text: body.text ?? null };
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const key = env.get("RESEND_RECEIVING_API_KEY") || env.get("RESEND_ADMIN_API_KEY");
if (!key) {
  console.error("Need RESEND_RECEIVING_API_KEY or RESEND_ADMIN_API_KEY in server/.env");
  console.error("Do not use sending-only RESEND_API_KEY for inbound forward.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const metaOnly = process.argv.includes("--meta-only");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = Math.min(50, Math.max(1, Number(limitArg?.split("=")[1] || 20)));
const forwardTo = env.get("RESEND_CONTACT_FORWARD_TO") || DEFAULT_TO;
const forwardFrom = env.get("RESEND_CONTACT_FORWARD_FROM") || "Bestie <no-reply@bestie.mx>";

const resend = new Resend(key);

console.log(`Listing up to ${limit} received emails…`);
let listed;
try {
  listed = await resend.emails.receiving.list({ limit });
} catch (e) {
  console.error("List failed:", e instanceof Error ? e.message : e);
  console.error("Hint: receiving APIs need full_access (RESEND_RECEIVING_API_KEY).");
  process.exit(1);
}

if (listed.error) {
  console.error("List failed:", listed.error.message);
  process.exit(1);
}

const rows = Array.isArray(listed.data?.data)
  ? listed.data.data
  : Array.isArray(listed.data)
    ? listed.data
    : [];
console.log(
  `Got ${rows.length}. Forward target: ${forwardTo}${dryRun ? " (dry-run)" : ""}${metaOnly ? " [meta-only]" : ""}`,
);

let matched = 0;
let forwarded = 0;
for (const row of rows) {
  const to = row.to ?? [];
  if (!shouldForward(to)) continue;
  if (metaOnly && !META_FROM_RE.test(String(row.from ?? ""))) continue;
  matched += 1;
  const id = row.id;
  const subject = String(row.subject ?? "").slice(0, 70);
  console.log(`\n→ ${id}`);
  console.log(`  from=${row.from} to=${to.join(",")} subject=${subject}`);
  if (dryRun) continue;
  try {
    const originalFrom = String(row.from ?? "").trim() || "(remitente desconocido)";
    const originalSubject = subject.trim() || "(sin asunto)";
    const { html, text } = await fetchReceivedBody(key, id);

    const bannerHtml =
      `<div style="font-family:Arial,sans-serif;border:2px solid #d93025;background:#fff3f2;` +
      `padding:12px 16px;margin-bottom:16px;border-radius:6px;color:#1c1e21;font-size:14px;line-height:1.5">` +
      `<strong>⚠️ Mensaje EXTERNO recibido en contacto@bestie.mx</strong><br/>` +
      `No fue enviado por Bestie ni por Meta — llegó de una dirección externa y se reenvía automáticamente.<br/>` +
      `<strong>Remitente original:</strong> ${escapeHtml(originalFrom)}<br/>` +
      `<strong>Asunto original:</strong> ${escapeHtml(originalSubject)}</div>`;
    const bannerText =
      `⚠️ MENSAJE EXTERNO recibido en contacto@bestie.mx — no fue enviado por Bestie ni por Meta.\n` +
      `Remitente original: ${originalFrom}\nAsunto original: ${originalSubject}\n${"-".repeat(48)}\n\n`;
    const fallbackNote = "(no se pudo cargar el contenido del mensaje; revisa resend.com/emails)";

    const { data, error } = await resend.emails.send({
      from: forwardFrom,
      to: forwardTo,
      subject: `[Externo: ${originalFrom}] ${originalSubject}`.slice(0, 250),
      html: `${bannerHtml}${html ?? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(text ?? fallbackNote)}</pre>`}`,
      text: `${bannerText}${text ?? fallbackNote}`,
    });
    if (error) throw new Error(error.message);
    forwarded += 1;
    console.log(`  forwarded id=${data?.id ?? "ok"} original_from=${originalFrom}`);
  } catch (e) {
    console.error(`  FORWARD FAILED: ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\nMatched ${matched}, forwarded ${forwarded}${dryRun ? " (dry-run)" : ""}.`);
process.exit(forwarded > 0 || dryRun || matched === 0 ? 0 : 1);
