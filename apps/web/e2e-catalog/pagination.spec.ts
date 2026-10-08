import { expect, test } from '@playwright/test';

import { cardNames, cards, openCatalog } from './support.ts';

test.describe('storefront-catalog: Shop pagination', () => {
  test('Paginate the shop', async ({ page }) => {
    await openCatalog(page, '/shop');
    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    await expect(pagination.getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const first = await cardNames(page);
    await pagination.getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/[?&]page=2(&|$)/);
    await expect(cards(page)).toHaveCount(6);
    await expect(pagination.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const second = await cardNames(page);
    expect(second.filter((name) => first.includes(name))).toEqual([]);

    // With filters and a sort, page links keep them.
    await openCatalog(page, '/shop?category=apparel&sort=price-asc');
    await page
      .getByRole('navigation', { name: 'Pagination' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/category=apparel/);
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('form[action="/shop"]').getByLabel('Sort by')).toHaveValue(
      'price-asc',
    );
  });

  test('Shop page beyond the last', async ({ page }) => {
    await openCatalog(page, '/shop?page=9');
    await expect(page.getByText('There are no products on page 9.')).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    const back = page.getByRole('link', { name: 'Go to page 1' });
    await expect(back).toHaveAttribute('href', '/shop');
    await back.click();
    await expect(cards(page)).toHaveCount(24);
  });
});
