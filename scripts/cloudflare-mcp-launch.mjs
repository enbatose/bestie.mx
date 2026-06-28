#!/usr/bin/env node
/**
 * Start Cloudflare MCP (stdio) using credentials from server/.env.
 * Keeps secrets out of ~/.cursor/mcp.json.
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

const fileEnv = parseEnv(readFileSync(envPath, "utf8"));
const apiToken = fileEnv.get("CLOUDFLARE_API_TOKEN")?.trim();
const accountId = fileEnv.get("CLOUDFLARE_ACCOUNT_ID")?.trim();

if (!apiToken) {
  console.error("Set CLOUDFLARE_API_TOKEN in server/.env");
  process.exit(1);
}

const childEnv = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: apiToken,
  ...(accountId ? { CLOUDFLARE_ACCOUNT_ID: accountId } : {}),
};

const child = spawn("npx", ["-y", "@cloudflare/mcp-server-cloudflare", "run"], {
  stdio: "inherit",
  env: childEnv,
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
