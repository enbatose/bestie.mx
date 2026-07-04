#!/usr/bin/env node
/**
 * Validate Google integrations for Bestie (OAuth, Maps, Developer Knowledge MCP, gcloud).
 * Does not print secret values.
 */
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

function mask(name, value) {
  if (!value?.trim()) return `${name}: (missing)`;
  const v = String(value).trim();
  const tail = v.length >= 4 ? v.slice(-4) : "****";
  return `${name}: set (${v.length} chars, ends …${tail})`;
}

function gcloudBin() {
  const candidates = [
    `${process.env.LOCALAPPDATA ?? ""}\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd`,
    "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd",
    `${process.env.ProgramFiles ?? "C:\\Program Files"}\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd`,
  ].filter((p) => p && !p.includes("\\\\Google"));
  for (const bin of candidates) {
    if (existsSync(bin)) return bin;
  }
  return null;
}

/** @param {string} label @param {string} url @param {Record<string, string>} [headers] */
async function probeHttp(label, url, headers = {}) {
  console.log(`── ${label} ──`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
    });
    const ok = res.ok;
    console.log(`Result: ${ok ? "OK" : "FAILED"} (HTTP ${res.status})`);
    if (!ok) {
      const text = (await res.text()).slice(0, 200);
      if (text) console.log(`Body: ${text}`);
    }
    console.log("");
    return ok;
  } catch (e) {
    console.log("Result: FAILED (network)");
    console.log(`Error: ${e instanceof Error ? e.message : String(e)}\n`);
    return false;
  }
}

console.log("Bestie — Google integration validation\n");
console.log(`Env file: ${existsSync(envPath) ? envPath : "(missing)"}\n`);

/** @type {Map<string, string>} */
const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : new Map();

console.log("Local env (server/.env):");
console.log(mask("GOOGLE_OAUTH_CLIENT_ID", env.get("GOOGLE_OAUTH_CLIENT_ID")));
console.log(mask("GOOGLE_OAUTH_CLIENT_SECRET", env.get("GOOGLE_OAUTH_CLIENT_SECRET")));
console.log(mask("GOOGLE_OAUTH_REDIRECT_URI", env.get("GOOGLE_OAUTH_REDIRECT_URI")));
console.log(mask("GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY", env.get("GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY")));
console.log(mask("VITE_GOOGLE_MAPS_EMBED_KEY", env.get("VITE_GOOGLE_MAPS_EMBED_KEY")));
console.log(`GOOGLE_CLOUD_PROJECT_ID: ${env.get("GOOGLE_CLOUD_PROJECT_ID")?.trim() || "(missing)"}`);
console.log("");

const gcloud = gcloudBin();
console.log("── gcloud CLI ──");
if (!gcloud) {
  console.log("Result: NOT FOUND");
  console.log("Install: winget install Google.CloudSDK");
  console.log("Then restart terminal and run: gcloud auth application-default login\n");
} else {
  console.log(`Result: OK (found at ${gcloud})\n`);
}

console.log("── Production Google OAuth (/api/auth/google/enabled) ──");
try {
  const res = await fetch("https://www.bestie.mx/api/auth/google/enabled");
  const j = await res.json();
  const enabled = j && typeof j === "object" && "enabled" in j ? j.enabled : undefined;
  console.log(`Result: HTTP ${res.status}, enabled=${String(enabled)}\n`);
} catch (e) {
  console.log(`Result: FAILED — ${e instanceof Error ? e.message : String(e)}\n`);
}

await probeHttp("Maps Code Assist MCP", "https://mapscodeassist.googleapis.com/mcp");

const dkKey = env.get("GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY")?.trim();
if (dkKey) {
  await probeHttp("Developer Knowledge MCP", "https://developerknowledge.googleapis.com/mcp", {
    "X-Goog-Api-Key": dkKey,
  });
} else {
  console.log("── Developer Knowledge MCP ──");
  console.log("Result: SKIPPED (set GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY in server/.env)");
  console.log("");
  console.log("Setup (after gcloud is installed):");
  console.log("  gcloud services enable developerknowledge.googleapis.com --project=YOUR_PROJECT");
  console.log('  gcloud services api-keys create --project=YOUR_PROJECT --display-name="Bestie Dev Knowledge MCP"');
  console.log("  Restrict the key to API: developerknowledge.googleapis.com");
  console.log("  Add GOOGLE_DEVELOPER_KNOWLEDGE_API_KEY=... to server/.env\n");
}

console.log("Notes:");
console.log("- VITE_GOOGLE_MAPS_EMBED_KEY is baked at Docker build on Railway (see Dockerfile).");
console.log("- Google OAuth secrets on Railway were set separately from local .env.");
console.log("- Reload Cursor after MCP config changes (Settings → Tools & MCP).");

process.exit(0);
