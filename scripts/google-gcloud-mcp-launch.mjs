#!/usr/bin/env node
/**
 * Start @google-cloud/gcloud-mcp (stdio) — natural-language gcloud from Cursor.
 * Requires Google Cloud SDK: https://cloud.google.com/sdk/docs/install
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

const gcloud = gcloudBin();
if (!gcloud) {
  console.error("gcloud CLI not found.");
  console.error("Install: winget install Google.CloudSDK");
  console.error("Then: gcloud auth login && gcloud auth application-default login");
  process.exit(1);
}

/** @type {Record<string, string>} */
const childEnv = { ...process.env };
const gcloudDir = gcloud.replace(/\\gcloud\.cmd$/i, "");
if (!childEnv.PATH?.toLowerCase().includes("google-cloud-sdk")) {
  childEnv.PATH = `${gcloudDir};${childEnv.PATH ?? ""}`;
}
if (existsSync(envPath)) {
  const fileEnv = parseEnv(readFileSync(envPath, "utf8"));
  const project = fileEnv.get("GOOGLE_CLOUD_PROJECT_ID")?.trim();
  if (project) {
    childEnv.GOOGLE_CLOUD_PROJECT = project;
    childEnv.CLOUDSDK_CORE_PROJECT = project;
  }
}

const child = spawn("npx", ["-y", "@google-cloud/gcloud-mcp"], {
  stdio: "inherit",
  env: childEnv,
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
