import { defineConfig } from '@playwright/test';

import { E2E } from './e2e/config.ts';

/**
 * Section 7 smoke test: the built admin app against a real API and a
 * dedicated `ite_e2e` database (recreated per run by global setup).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: E2E.adminOrigin,
    // Local runs use the installed Google Chrome; CI installs Playwright's Chromium instead.
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node src/server.ts',
      cwd: '../api',
      url: `${E2E.apiUrl}/health`,
      reuseExistingServer: false,
      env: E2E.apiEnv,
    },
    {
      command: `next build && next start --port ${E2E.adminPort}`,
      url: `${E2E.adminOrigin}/login`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: { API_URL: E2E.apiUrl, NEXT_TELEMETRY_DISABLED: '1' },
    },
  ],
});
