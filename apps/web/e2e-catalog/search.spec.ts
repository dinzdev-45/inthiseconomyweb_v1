import { expect, test } from '@playwright/test';

import { cardNames, cards, openCatalog } from './support.ts';

test.describe('storefront-catalog: Search page', () => {
  test('Search for a product', async ({ page }) => {
    await page.goto('/search');
    const search = page.getByRole('search');
    await search.getByLabel('Search products').fill('hoodie');
    await search.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/[?&]q=hoodie(&|$)/);
    await expect(page.locator('main [data-result-count]')).toHaveText('3 products');
    expect((await cardNames(page)).sort()).toEqual([
      'Overdraft Hoodie',
      'Two Tone Hoodie',
      'Zip Hoodie',
    ]);
    await expect(search.getByLabel('Search products')).toHaveValue('hoodie');

    // Sort applies to search results too.
    await search.getByLabel('Sort by').selectOption('price-asc');
    await search.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(page.locator('main [data-result-count]')).toBeVisible();
    expect(await cardNames(page)).toEqual(['Two Tone Hoodie', 'Zip Hoodie', 'Overdraft Hoodie']);
  });

  test('Search with no results', async ({ page }) => {
    await page.goto('/search?q=no-such-garment');
    await expect(page.getByText('Nothing matched “no-such-garment”.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute(
      'href',
      '/shop',
    );
    await expect(cards(page)).toHaveCount(0);
  });

  test('Empty search', async ({ page }) => {
    // The header's Search link leads here.
    await openCatalog(page, '/shop');
    await page.getByRole('banner').getByRole('link', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole('search').getByLabel('Search products')).toHaveValue('');
    await expect(page.getByText('Search the catalog by product name.')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  });
});
