import { defineConfig } from '@playwright/test';

import { CATALOG_E2E } from './e2e-catalog/config.ts';

/**
 * Storefront catalog E2E (storefront-catalog): the production build against a real API on a
 * seeded `ite_e2e_store` database (recreated per run by e2e-catalog/reset-db.ts, before the API
 * starts and the storefront builds). The no-API suite in
 * playwright.config.ts stays separate and keeps proving the homepage needs no API.
 */
export default defineConfig({
  testDir: './e2e-catalog',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: CATALOG_E2E.webOrigin,
    // Local runs use the installed Google Chrome; CI installs Playwright's Chromium instead.
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ../web/e2e-catalog/reset-db.ts && node src/server.ts',
      cwd: '../api',
      url: `${CATALOG_E2E.apiUrl}/health`,
      reuseExistingServer: false,
      env: CATALOG_E2E.apiEnv,
    },
    {
      command: `next build && next start --port ${CATALOG_E2E.webPort}`,
      url: CATALOG_E2E.webOrigin,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        API_URL: CATALOG_E2E.apiUrl,
        SITE_URL: CATALOG_E2E.webOrigin,
        STOREFRONT_IMAGE_HOSTS: CATALOG_E2E.imageHosts,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
