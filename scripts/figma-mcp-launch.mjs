#!/usr/bin/env node
/**
 * Start figma-developer-mcp (stdio) using key from server/.env (no secrets in mcp.json).
 *
 * Requirements:
 * 1. Generate a Figma Personal Access Token at Figma -> Account Settings -> Personal Access Tokens
 * 2. Set FIGMA_API_KEY=your_token in server/.env
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
const apiKey = env.get("FIGMA_API_KEY");
if (!apiKey) {
  console.error("Set FIGMA_API_KEY in server/.env");
  process.exit(1);
}

const childEnv = {
  ...process.env,
  FIGMA_API_KEY: apiKey,
};

const child = spawn("npx", ["-y", "figma-developer-mcp", "--stdio"], {
  stdio: "inherit",
  env: childEnv,
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
