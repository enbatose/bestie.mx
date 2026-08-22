import { spawnSync } from "node:child_process";

/**
 * Live read-only + PostHog publish-surface checks against Dev.
 * Dev must NOT send traffic to PostHog (production host allowlist).
 */
process.env.E2E_LIVE = "1";
process.env.E2E_BASE_URL = process.env.E2E_BASE_URL || "https://dev.bestie.mx";

const res = spawnSync(
  "npx",
  ["playwright", "test", "e2e/live-readonly.spec.ts", "e2e/posthog-publish.spec.ts"],
  {
    stdio: "inherit",
    shell: true,
    env: process.env,
  },
);
process.exit(res.status ?? 1);
