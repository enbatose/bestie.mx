#!/usr/bin/env node
/**
 * Vite production build for Playwright E2E.
 * Clears VITE_API_URL so the SPA uses same-origin `/api` (not local .env.local :3000).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  VITE_API_URL: "",
  // Keep analytics off in the e2e bundle unless explicitly set.
  VITE_POSTHOG_PROJECT_TOKEN: process.env.VITE_POSTHOG_PROJECT_TOKEN || "",
};

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const res = spawnSync(npm, ["exec", "--", "vite", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env,
});
process.exit(res.status ?? 1);
