import { spawnSync } from "node:child_process";

process.env.E2E_LIVE = "1";
process.env.E2E_BASE_URL = process.env.E2E_BASE_URL || "https://dev.bestie.mx";

const res = spawnSync("npx", ["playwright", "test", "e2e/live-readonly.spec.ts"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(res.status ?? 1);
