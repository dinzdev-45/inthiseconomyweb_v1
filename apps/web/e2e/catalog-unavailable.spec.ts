import { expect, test } from '@playwright/test';

/** This suite runs without an API (playwright.config.ts), so the catalog cannot load. */
test('Catalog unavailable', async ({ page }) => {
  await page.goto('/shop?category=outerwear');
  await expect(page.getByRole('heading', { level: 1, name: 'Catalog unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute(
    'href',
    '/shop?category=outerwear',
  );
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  const text = (await page.locator('main').textContent()) ?? '';
  expect(text).not.toMatch(/fetch failed|ECONNREFUSED|127\.0\.0\.1|StoreApiError|stack|digest/i);
});
