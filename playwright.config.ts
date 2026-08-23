import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 4177);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const isLive = Boolean(process.env.E2E_LIVE);

/** Shared ignore: live suite only when E2E_LIVE; mutating isolated specs never against live. */
const projectIgnore = isLive
  ? [
      /publisher-draft/,
      /auth\.spec/,
      /messaging\.spec/,
      ...(process.env.E2E_MESSAGING_LIVE ? [] : [/messaging-live/]),
    ]
  : [/live-readonly/, /messaging-live/];

/**
 * Local E2E (default): isolated temp DB via `npm run e2e:serve`.
 * Live read-only: E2E_LIVE=1 E2E_BASE_URL=https://dev.bestie.mx (no writes).
 *
 * Projects: Desktop Chrome + Mobile Chrome (Pixel 5). Bestie’s primary UX is mobile;
 * every default-suite flow runs on both viewports.
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
      testIgnore: projectIgnore,
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
      testIgnore: projectIgnore,
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
