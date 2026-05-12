import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/clipEditor',
  testMatch: '*.spec.ts',
  outputDir: 'temp/playwright-results',
  use: {
    baseURL: 'http://localhost:5002',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run web:dev',
    url: 'http://localhost:5002',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
