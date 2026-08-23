import { spawnSync } from "node:child_process";

const base = process.argv[2]?.trim() || process.env.E2E_BASE_URL || "https://dev.bestie.mx";
process.env.E2E_LIVE = "1";
process.env.E2E_MESSAGING_LIVE = "1";
process.env.E2E_BASE_URL = base;
process.env.E2E_MSG_SEEKER_EMAIL = process.env.E2E_MSG_SEEKER_EMAIL || process.env.SMOKE_MSG_SEEKER_EMAIL;
process.env.E2E_MSG_SEEKER_PASSWORD = process.env.E2E_MSG_SEEKER_PASSWORD || process.env.SMOKE_MSG_SEEKER_PASSWORD;
process.env.E2E_MSG_PUBLISHER_EMAIL = process.env.E2E_MSG_PUBLISHER_EMAIL || process.env.SMOKE_MSG_PUBLISHER_EMAIL;
process.env.E2E_MSG_PUBLISHER_PASSWORD =
  process.env.E2E_MSG_PUBLISHER_PASSWORD || process.env.SMOKE_MSG_PUBLISHER_PASSWORD;
process.env.E2E_MSG_LISTING_ID = process.env.E2E_MSG_LISTING_ID || process.env.SMOKE_MSG_LISTING_ID;

const res = spawnSync("npx", ["playwright", "test", "e2e/messaging-live.spec.ts"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(res.status ?? 1);
