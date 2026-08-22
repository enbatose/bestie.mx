import { spawnSync } from "node:child_process";

/**
 * Live PostHog publish-surface checks against Prod.
 * Prod (bestie.mx / www) SHOULD initialize PostHog on /publicar and /borrador.
 * Read-only: does not publish listings or create accounts.
 */
process.env.E2E_LIVE = "1";
process.env.E2E_BASE_URL = process.env.E2E_BASE_URL || "https://www.bestie.mx";

const res = spawnSync("npx", ["playwright", "test", "e2e/posthog-publish.spec.ts"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(res.status ?? 1);
