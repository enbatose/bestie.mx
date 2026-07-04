#!/usr/bin/env node
/**
 * Bridge Cursor (stdio) → Google Developer Knowledge MCP (HTTP).
 * Reads GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY from server/.env (no secrets in mcp.json).
 *
 * Enable API: gcloud services enable developerknowledge.googleapis.com
 * Create key:  gcloud services api-keys create --display-name="Bestie Dev Knowledge MCP"
 *               then restrict to developerknowledge.googleapis.com
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "server", ".env");
const MCP_URL = "https://developerknowledge.googleapis.com/mcp";

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
  console.error("Add GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY=... (see server/.env.example)");
  process.exit(1);
}

const fileEnv = parseEnv(readFileSync(envPath, "utf8"));
const apiKey = fileEnv.get("GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY")?.trim();
if (!apiKey) {
  console.error("Set GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY in server/.env");
  console.error("Run: npm run google:validate  (prints setup steps)");
  process.exit(1);
}

const child = spawn(
  "npx",
  ["-y", "mcp-remote", MCP_URL, "--header", `X-Goog-Api-Key:${apiKey}`],
  {
    stdio: "inherit",
    env: process.env,
    shell: true,
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
