#!/usr/bin/env node
/**
 * Validate Resend API keys from server/.env (no secrets printed).
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
          return `${name} (${status})`;
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

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const emailFrom = env.get("EMAIL_FROM");
const webhook = env.get("RESEND_WEBHOOK_SECRET");

console.log(`Env file: ${envPath}\n`);
console.log(`EMAIL_FROM: ${emailFrom ?? "(missing)"}`);
console.log(maskKey("RESEND_WEBHOOK_SECRET", webhook));
console.log("");

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

process.exit(adminOk ? 0 : 1);
