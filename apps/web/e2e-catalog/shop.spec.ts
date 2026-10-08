import { expect, test } from '@playwright/test';

import { cardNames, cards, openCatalog, resultCount } from './support.ts';

test.describe('storefront-catalog: Shop page', () => {
  test('Shop shows active products', async ({ page }) => {
    await openCatalog(page, '/shop');
    await expect(page.getByRole('heading', { level: 1, name: 'Shop' })).toBeVisible();
    const first = await cardNames(page);
    // Newest first: the most recently activated fixture.
    expect(first[0]).toBe('Zip Hoodie');
    await openCatalog(page, '/shop?page=2');
    const all = [...first, ...(await cardNames(page))];
    expect(all).toHaveLength(30);
    for (const hidden of [
      'Side Hustle Crewneck', // draft
      'Budget Cut Shorts', // inactive
      'Archived Jacket', // archived
    ]) {
      expect(all).not.toContain(hidden);
    }
  });

  test('Shop result count', async ({ page }) => {
    await openCatalog(page, '/shop');
    await expect(resultCount(page)).toHaveText('30 products');
    await expect(cards(page)).toHaveCount(24);
  });
});
