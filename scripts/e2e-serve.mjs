#!/usr/bin/env node
/**
 * Boots an isolated Bestie stack for Playwright:
 * - temporary SQLite DB (SEED_DEMO_ON_EMPTY=1)
 * - serves Vite `dist` + API on one origin
 *
 * Never points at Dev/Prod data.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.E2E_PORT || 4177);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bestie-e2e-"));
const dbPath = path.join(tmpRoot, "e2e.db");
const distDir = path.join(root, "dist");
const serverDist = path.join(root, "server", "dist", "index.js");

function runNpm(args) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const res = spawnSync(npm, args, { cwd: root, stdio: "inherit", shell: true, env: process.env });
  return res.status ?? 1;
}

if (!fs.existsSync(serverDist)) {
  console.log("[e2e-serve] building server…");
  if (runNpm(["run", "server:build"]) !== 0) process.exit(1);
}
if (!fs.existsSync(path.join(distDir, "index.html")) || process.env.E2E_FORCE_BUILD === "1") {
  console.log("[e2e-serve] building Vite SPA (same-origin API)…");
  if (runNpm(["run", "build:e2e"]) !== 0) process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(port),
  LISTEN_HOST: "127.0.0.1",
  DATABASE_PATH: dbPath,
  WEB_DIST_DIR: distDir,
  SEED_DEMO_ON_EMPTY: "1",
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET || "e2e-auth-jwt-secret-32chars-minimum!",
  CORS_ORIGINS: `http://127.0.0.1:${port},http://localhost:${port}`,
  RATE_LIMIT_POST_LISTINGS_MAX: "10000",
  RATE_LIMIT_LOGIN_MAX: "10000",
  RATE_LIMIT_REGISTER_MAX: "10000",
  // HTTP localhost cannot store Secure cookies; keep sessions working for E2E.
  TEST_DISABLE_SECURE_COOKIE: "1",
};

console.log(`[e2e-serve] tmp DB ${dbPath}`);
console.log(`[e2e-serve] http://127.0.0.1:${port}`);

const child = spawn(process.execPath, [serverDist], {
  cwd: path.join(root, "server"),
  env,
  stdio: "inherit",
});

let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  try {
    child.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
};

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});
child.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 1);
});
