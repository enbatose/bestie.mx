#!/usr/bin/env node
/**
 * Start Resend MCP using keys from server/.env (no secrets in mcp.json).
 *
 * Prefers RESEND_ADMIN_API_KEY (full_access), falls back to RESEND_API_KEY.
 * Optional: SENDER_EMAIL_ADDRESS from EMAIL_FROM for send defaults.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");

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

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const apiKey = env.get("RESEND_ADMIN_API_KEY") ?? env.get("RESEND_API_KEY");
if (!apiKey) {
  console.error("Set RESEND_ADMIN_API_KEY (full_access) or RESEND_API_KEY in server/.env");
  process.exit(1);
}

const childEnv = {
  ...process.env,
  RESEND_API_KEY: apiKey,
};
const sender = env.get("SENDER_EMAIL_ADDRESS") ?? env.get("EMAIL_FROM");
if (sender) childEnv.SENDER_EMAIL_ADDRESS = sender;

const child = spawn("npx", ["-y", "resend-mcp"], {
  stdio: "inherit",
  env: childEnv,
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
