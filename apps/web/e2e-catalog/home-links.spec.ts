import { expect, test } from '@playwright/test';

import { CATALOG_E2E } from './config.ts';
import { cards } from './support.ts';

test.describe('storefront-catalog: Homepage to catalog', () => {
  test('Shop all from the homepage', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'SHOP ALL' }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(cards(page)).toHaveCount(24);

    // The header's Shop link leads here too.
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Shop', exact: true }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('Homepage card to a product page', async ({ page }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith(CATALOG_E2E.apiUrl)) apiRequests.push(request.url());
    });
    await page.goto('/');
    await page
      .getByRole('link', { name: /Overdraft Hoodie/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/products\/overdraft-hoodie$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Overdraft Hoodie' })).toBeVisible();
    // The browser never calls the API; that the homepage needs no API at all is proven by the
    // no-API suite ("Homepage does not depend on the API").
    expect(apiRequests).toEqual([]);
  });
});
