import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  workers: 1,
  outputDir: path.join(os.tmpdir(), 'codelily-e2e'),
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    channel: process.platform === 'win32' ? 'chrome' : undefined,
    headless: true,
    viewport: { width: 1440, height: 1100 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/health/live',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
