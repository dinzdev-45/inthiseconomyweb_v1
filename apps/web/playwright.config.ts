import { defineConfig } from '@playwright/test';

const PORT = 3100;

/**
 * Storefront E2E (storefront-homepage). Runs the production build with no API:
 * API_URL points at a port where nothing listens, so the suite proves the
 * storefront does not depend on the API where it shouldn't.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Local runs use the installed Google Chrome; CI installs Playwright's Chromium instead.
    ...(process.env.CI ? {} : { channel: 'chrome' }),
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `next build && next start --port ${PORT}`,
    // Wait for the port: without an API, `/` may legitimately answer with an error status.
    port: PORT,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      API_URL: 'http://127.0.0.1:4999',
      NEXT_TELEMETRY_DISABLED: '1',
      // Enables the test-only /e2e-fixtures pages (404 everywhere else).
      STOREFRONT_E2E_FIXTURES: '1',
    },
  },
});
