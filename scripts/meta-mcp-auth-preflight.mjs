#!/usr/bin/env node
/**
 * Safe preflight for Cursor's Meta DevTools MCP OAuth.
 *
 * Cursor owns the real OAuth callback on localhost/127.0.0.1:8787. This script
 * never starts a callback server and never reads OAuth callback URLs. It only
 * checks for local states that are known to make Cursor's listener unavailable.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import { join } from "node:path";

const EXPECTED_META_URL = "https://mcp.facebook.com/devtools";
const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_PORT = 8787;

function printSection(title) {
  console.log(`\n-- ${title} --`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

async function canBindCallbackPort() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      resolve({ ok: false, code: error?.code ?? "UNKNOWN" });
    });
    server.once("listening", () => {
      server.close(() => resolve({ ok: true }));
    });
    server.listen(CALLBACK_PORT, CALLBACK_HOST);
  });
}

function latestMetaAttempt() {
  const appData = process.env.APPDATA;
  if (!appData) return null;

  const attemptsDir = join(appData, "Cursor", "User", "globalStorage", "mcp-oauth-attempts");
  if (!existsSync(attemptsDir)) return null;

  const attempts = readdirSync(attemptsDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(join(attemptsDir, name)))
    .filter((attempt) => {
      if (!attempt || typeof attempt !== "object") return false;
      return (
        String(attempt.identifier ?? "").includes("user-meta-devtools") ||
        attempt.serverUrl === EXPECTED_META_URL ||
        attempt.transportServerUrl === EXPECTED_META_URL
      );
    })
    .sort((a, b) => Number(b.createdAtMs ?? 0) - Number(a.createdAtMs ?? 0));

  return attempts[0] ?? null;
}

function formatAge(createdAtMs) {
  const created = Number(createdAtMs);
  if (!Number.isFinite(created) || created <= 0) return "unknown age";

  const seconds = Math.max(0, Math.round((Date.now() - created) / 1000));
  if (seconds < 90) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

const failures = [];
const warnings = [];

console.log("Bestie - Meta DevTools MCP auth preflight");
console.log("This does not handle OAuth codes or start a callback listener.");

printSection("Cursor MCP config");
const mcpPath = join(os.homedir(), ".cursor", "mcp.json");
const mcp = existsSync(mcpPath) ? readJson(mcpPath) : null;
const meta = mcp?.mcpServers?.["meta-devtools"];

if (!meta) {
  failures.push("Missing `meta-devtools` in `%USERPROFILE%\\.cursor\\mcp.json`.");
  console.log("FAIL: meta-devtools is not configured.");
} else if (meta.type !== "http" || meta.url !== EXPECTED_META_URL) {
  failures.push("`meta-devtools` should be an HTTP MCP server at https://mcp.facebook.com/devtools.");
  console.log(`FAIL: meta-devtools points to ${meta.url ?? "(missing url)"}.`);
} else {
  console.log("OK: meta-devtools is configured for the official Meta DevTools MCP endpoint.");
}

printSection("Callback port");
const port = await canBindCallbackPort();
if (!port.ok) {
  failures.push(
    `Port ${CALLBACK_PORT} on ${CALLBACK_HOST} is already in use (${port.code}); Cursor cannot bind its OAuth callback listener.`,
  );
  console.log(`FAIL: ${CALLBACK_HOST}:${CALLBACK_PORT} is already in use (${port.code}).`);
  console.log("Close the process using that port, then retry Connect in Cursor.");
} else {
  console.log(`OK: ${CALLBACK_HOST}:${CALLBACK_PORT} is free for Cursor to bind during OAuth.`);
}

printSection("Last Meta OAuth attempt");
const attempt = latestMetaAttempt();
if (!attempt) {
  console.log("OK: no previous Meta OAuth attempt was found.");
} else {
  const owner = attempt.owner?.workspaceId ?? "(unknown)";
  console.log(`Last attempt owner: ${owner}`);
  console.log(`Last attempt age: ${formatAge(attempt.createdAtMs)}`);

  if (owner === "empty-window") {
    warnings.push(
      "The latest Meta OAuth attempt came from Cursor's empty window. Start Connect from the bestie.mx project window instead.",
    );
    console.log("WARN: the latest attempt was started from an empty Cursor window.");
  } else {
    console.log("OK: the latest attempt was not owned by Cursor's empty window.");
  }
}

printSection("Recommended Connect flow");
console.log("1. Keep this `bestie.mx` project window open and focused.");
console.log("2. In this same window, open Cursor Settings -> Tools & MCP.");
console.log("3. Use `meta-devtools` -> Connect.");
console.log("4. If the browser lands on 127.0.0.1 and fails, replace only the host with `localhost` and keep the path/query.");
console.log("5. Do not paste callback URLs or OAuth codes into chat.");

if (warnings.length) {
  printSection("Warnings");
  for (const warning of warnings) console.log(`WARN: ${warning}`);
}

if (failures.length) {
  printSection("Result");
  for (const failure of failures) console.log(`FAIL: ${failure}`);
  process.exit(1);
}

printSection("Result");
console.log("PASS: local preflight checks passed. Cursor still owns the listener during Connect.");
