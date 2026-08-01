import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 4177);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const isLive = Boolean(process.env.E2E_LIVE);

/**
 * Local E2E (default): isolated temp DB via `npm run e2e:serve`.
 * Live read-only: E2E_LIVE=1 E2E_BASE_URL=https://dev.bestie.mx (no writes).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "es-MX",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: isLive ? [/publisher-draft/, /auth\.spec/] : [/live-readonly/],
    },
  ],
  webServer: isLive
    ? undefined
    : {
        command: "node scripts/e2e-serve.mjs",
        url: `${baseURL}/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          E2E_PORT: String(port),
        },
      },
});
