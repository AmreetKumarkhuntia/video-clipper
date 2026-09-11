import { defineConfig, devices } from '@playwright/test';

const fixtureApiUrl = 'http://127.0.0.1:5151';
const webUrl = 'http://127.0.0.1:5012';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: 'temp/playwright-results',
  reporter: [['list'], ['html', { outputFolder: 'temp/playwright-report', open: 'never' }]],
  use: {
    baseURL: webUrl,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm exec tsx tests/e2e/support/fixtureServer.ts',
      url: `${fixtureApiUrl}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'pnpm exec vite --host 127.0.0.1 --port 5012',
      url: webUrl,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        API_INTERNAL_URL: fixtureApiUrl,
        API_ORIGIN: fixtureApiUrl,
      },
    },
  ],
});
