import { expect, test } from '@playwright/test';

import { openCatalog } from './support.ts';

test.describe('storefront-catalog: Product page placeholder', () => {
  test('Product link from a card', async ({ page }) => {
    await openCatalog(page, '/shop?category=outerwear');
    await page.getByRole('link', { name: /Zip Hoodie/ }).click();
    await expect(page).toHaveURL(/\/products\/zip-hoodie$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Zip Hoodie' })).toBeVisible();
    await expect(page.locator('main')).toContainText(/Rp\s799\.000 – Rp\s829\.000/);
    await expect(page.getByText('Full product details are coming soon.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the shop' })).toHaveAttribute(
      'href',
      '/shop',
    );
    // No size selection or cart controls.
    await expect(page.locator('main').locator('button, select, input, form')).toHaveCount(0);

    // A sold-out product says so.
    await page.goto('/products/sold-out-tee');
    await expect(page.locator('main')).toContainText('Sold out');
  });

  test('Unavailable product page', async ({ page }) => {
    for (const slug of [
      'side-hustle-crewneck', // draft
      'budget-cut-shorts', // inactive
      'archived-jacket', // archived
      'no-such-product',
    ]) {
      const response = await page.goto(`/products/${slug}`);
      expect(response?.status(), slug).toBe(404);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    }
  });
});
