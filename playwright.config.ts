import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'api', testDir: 'tests/api' },
    { name: 'iphone', testDir: 'tests/e2e', use: { ...devices['iPhone 14'] } },
    { name: 'pixel', testDir: 'tests/e2e', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm dev --port 3100',
    url: 'http://localhost:3100/api/health',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
