#!/usr/bin/env node
/**
 * Validate Resend API keys from server/.env and probe inbound receiving (no secrets printed).
 *
 * Usage: npm run resend:validate
 * Optional: RESEND_VALIDATE_LIST=1 to list recent received emails (needs full_access key).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "server", ".env");

/** @param {string} content */
function parseEnv(content) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
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

function maskKey(name, value) {
  if (!value) return `${name}: (missing)`;
  const v = String(value);
  const tail = v.length >= 4 ? v.slice(-4) : "****";
  return `${name}: set (${v.length} chars, ends …${tail})`;
}

/** @param {string} label @param {string | undefined} key */
async function probe(label, key) {
  console.log(`── ${label} ──`);
  console.log(maskKey("key", key));
  if (!key) {
    console.log("Result: SKIPPED\n");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text.slice(0, 200);
    }
    if (!res.ok) {
      const msg =
        typeof body === "object" && body && "message" in body
          ? String(body.message)
          : JSON.stringify(body)?.slice(0, 200);
      if (
        label.includes("sending") &&
        res.status === 401 &&
        msg.toLowerCase().includes("only send")
      ) {
        console.log(`Result: OK (HTTP ${res.status} — sending-only key, as expected)`);
        console.log("");
        return true;
      }
      console.log(`Result: FAILED (HTTP ${res.status})`);
      if (msg) console.log(`Error: ${msg}`);
      console.log("");
      return false;
    }
    const domains = Array.isArray(body?.data)
      ? body.data.map((d) => {
          const name = d?.name ?? d?.domain ?? "?";
          const status = d?.status ?? "unknown";
          const receiving = d?.receiving ?? d?.capabilities?.receiving;
          return receiving != null ? `${name} (${status}, receiving=${receiving})` : `${name} (${status})`;
        })
      : [];
    console.log(`Result: OK (HTTP ${res.status})`);
    if (domains.length) {
      console.log(`Domains: ${domains.join(", ")}`);
    } else {
      console.log("Domains: (none yet — add bestie.mx in Resend dashboard)");
    }
    console.log("");
    return true;
  } catch (e) {
    console.log("Result: FAILED (network)");
    console.log(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    return false;
  }
}

/** @param {string | undefined} key */
async function probeReceivingList(key) {
  console.log("── Receiving inbox (recent) ──");
  if (!key) {
    console.log("Result: SKIPPED (need RESEND_RECEIVING_API_KEY or RESEND_ADMIN_API_KEY)\n");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails/receiving?limit=10", {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const msg =
        typeof body === "object" && body && "message" in body
          ? String(body.message)
          : text.slice(0, 200);
      console.log(`Result: FAILED (HTTP ${res.status})`);
      if (msg) console.log(`Error: ${msg}`);
      if (res.status === 401) {
        console.log("Hint: receiving.list requires full_access — set RESEND_RECEIVING_API_KEY");
      }
      console.log("");
      return false;
    }
    const rows = Array.isArray(body?.data) ? body.data : [];
    console.log(`Result: OK (${rows.length} recent)`);
    for (const row of rows) {
      const to = Array.isArray(row?.to) ? row.to.join(",") : "?";
      const from = row?.from ?? "?";
      const subject = String(row?.subject ?? "(no subject)").slice(0, 60);
      const created = row?.created_at ?? "?";
      console.log(`  ${created}  to=${to}  from=${from}  subject=${subject}`);
    }
    if (!rows.length) {
      console.log("  (empty — no inbound mail stored, or none in the last page)");
    }
    console.log("");
    return true;
  } catch (e) {
    console.log("Result: FAILED (network)");
    console.log(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    return false;
  }
}

/** Check public DNS for Resend SPF on send.bestie.mx */
async function probeSpfDns() {
  console.log("── DNS SPF send.bestie.mx ──");
  try {
    const res = await fetch(
      "https://cloudflare-dns.com/dns-query?name=send.bestie.mx&type=TXT",
      { headers: { accept: "application/dns-json" } },
    );
    const body = await res.json();
    const answers = Array.isArray(body?.Answer)
      ? body.Answer.map((a) => String(a.data ?? "").replace(/^"|"$/g, ""))
      : [];
    const expected = "v=spf1 include:amazonses.com ~all";
    const ok = answers.some((t) => t.includes("include:amazonses.com"));
    console.log(`TXT: ${answers.join(" | ") || "(none)"}`);
    if (ok) {
      console.log(`Result: OK (includes amazonses.com)`);
    } else {
      console.log(`Result: FAILED — expected "${expected}"`);
      console.log("Fix: npm run cloudflare:setup");
      console.log("  or Cloudflare DNS → edit TXT send → v=spf1 include:amazonses.com ~all");
    }
    console.log("");
    return ok;
  } catch (e) {
    console.log("Result: FAILED (network)");
    console.log(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    return false;
  }
}

if (!existsSync(envPath)) {
  console.warn(`Missing ${envPath} — running DNS + production health checks only.\n`);
  const spfOk = await probeSpfDns();
  try {
    const res = await fetch("https://www.bestie.mx/api/health");
    const j = await res.json();
    console.log("── Production /api/health ──");
    console.log(`smtp.mode=${j?.smtp?.mode} verifyOk=${j?.smtp?.verifyOk}`);
    console.log(
      `resendInbound: webhook=${j?.resendInbound?.webhookConfigured ?? "?"} receivingKey=${j?.resendInbound?.receivingKeyConfigured ?? "?"} forwardTo=${j?.resendInbound?.forwardTo ?? "?"}`,
    );
    console.log("");
  } catch (e) {
    console.warn(`Health check failed: ${e instanceof Error ? e.message : e}\n`);
  }
  process.exit(spfOk ? 0 : 1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const emailFrom = env.get("EMAIL_FROM");
const webhook = env.get("RESEND_WEBHOOK_SECRET");
const receivingKey =
  env.get("RESEND_RECEIVING_API_KEY") ||
  env.get("RESEND_ADMIN_API_KEY");

console.log(`Env file: ${envPath}\n`);
console.log(`EMAIL_FROM: ${emailFrom ?? "(missing)"}`);
console.log(maskKey("RESEND_WEBHOOK_SECRET", webhook));
console.log(maskKey("RESEND_RECEIVING_API_KEY", env.get("RESEND_RECEIVING_API_KEY")));
console.log(`RESEND_CONTACT_FORWARD_TO: ${env.get("RESEND_CONTACT_FORWARD_TO") ?? "(default batani.enrique@gmail.com)"}`);
console.log("");

const spfOk = await probeSpfDns();
const adminOk = await probe("RESEND_ADMIN_API_KEY (full access)", env.get("RESEND_ADMIN_API_KEY"));
const sendKey = env.get("RESEND_API_KEY");
const sendOk =
  sendKey && sendKey !== env.get("RESEND_ADMIN_API_KEY")
    ? await probe("RESEND_API_KEY (sending)", sendKey)
    : (console.log("── RESEND_API_KEY (sending) ──"),
      sendKey
        ? (console.log(maskKey("key", sendKey)),
          console.log("Result: OK (same key as admin — OK for local dev)\n"),
          true)
        : (console.log("Result: SKIPPED (not set; Railway uses this for production sends)\n"), false));

const listOk =
  process.env.RESEND_VALIDATE_LIST === "1" || process.argv.includes("--list")
    ? await probeReceivingList(receivingKey)
    : (console.log("── Receiving inbox ──"),
      console.log("Skipped (pass --list or RESEND_VALIDATE_LIST=1 to list recent inbound)\n"),
      true);

const ok = adminOk && spfOk && listOk;
process.exit(ok ? 0 : 1);
