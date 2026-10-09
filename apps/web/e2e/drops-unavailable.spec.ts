import { expect, test } from '@playwright/test';

/** This suite runs without an API (playwright.config.ts), so drops cannot load. */
test('Drops unavailable', async ({ page }) => {
  await page.goto('/drops');
  await expect(page.getByRole('heading', { level: 1, name: 'Drops unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/drops');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  const text = (await page.locator('main').textContent()) ?? '';
  expect(text).not.toMatch(/fetch failed|ECONNREFUSED|127\.0\.0\.1|StoreApiError|stack|digest/i);
});
