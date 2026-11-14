import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Load .env.local for the API tests and the dev server they start (no dotenv dependency).
function loadEnvLocal() {
  let text = '';
  try {
    text = readFileSync('.env.local', 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2]!.replace(/^(['"])(.*)\1$/, '$2').replace(/\s+#.*$/, '');
    process.env[m[1]!] ??= value;
  }
}
loadEnvLocal();
// API tests assert template roadmaps; the webServer inherits this env.
process.env.ANTHROPIC_API_KEY = '';

export default defineConfig({
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
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
