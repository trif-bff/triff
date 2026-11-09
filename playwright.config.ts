import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive/ },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://triff:triff@localhost:5432/triff_test",
      BETTER_AUTH_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET: "e2e-secret-0123456789abcdef0123456789",
      ANTHROPIC_API_KEY: "",
      AUTH_RATE_LIMIT: "off", // many sign-ups from one IP during the suite
      EMAIL_PROVIDER: "outbox", // emails stored in email_log so tests can follow the links
      ALLOW_TEST_OUTBOX: "1", // `next start` runs in production mode; allow the outbox ONLY here
    },
  },
});
