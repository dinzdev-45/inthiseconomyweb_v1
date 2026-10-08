import { expect, test } from '@playwright/test';

import { openCatalog, resultCount, seriousViolations, tabTo } from './support.ts';

test.describe('storefront-catalog: Catalog accessibility', () => {
  test('Catalog accessibility scan', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const url of [
      '/shop',
      '/shop?category=apparel&size=M&color=black&availability=in-stock&sort=price-asc',
      '/shop?size=XXXL', // no results
      '/search',
      '/search?q=hoodie',
    ]) {
      await page.goto(url);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await seriousViolations(page), url).toEqual([]);
    }

    // Small screens, with the filter disclosure open.
    await page.setViewportSize({ width: 375, height: 812 });
    await openCatalog(page, '/shop?category=apparel');
    expect(await seriousViolations(page), 'mobile').toEqual([]);
    await page.getByText('Filter and sort').click();
    expect(await seriousViolations(page), 'mobile, filters open').toEqual([]);
  });

  test('Keyboard catalog navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCatalog(page, '/shop');
    const form = page.locator('form[action="/shop"]');

    // Filters and sort: choose by typing (type-to-select works on every platform; arrow keys
    // open the picker on macOS), toggle with Space, submit with Enter.
    await tabTo(page, form.getByLabel('Category'));
    await page.keyboard.type('Outerwear');
    await expect(form.getByLabel('Category')).toHaveValue('outerwear');
    await tabTo(page, form.getByLabel('In stock only'));
    await page.keyboard.press('Space');
    await expect(form.getByLabel('In stock only')).toBeChecked();
    await tabTo(page, form.getByLabel('Sort by'));
    await page.keyboard.type('Price, low');
    await expect(form.getByLabel('Sort by')).toHaveValue('price-asc');
    await tabTo(page, form.getByRole('button', { name: 'Apply' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/availability=in-stock/);
    await expect(page).toHaveURL(/sort=price-asc/);
    await expect(page).toHaveURL(/category=outerwear/);
    await expect(resultCount(page)).toBeVisible();

    // Removing a filter chip.
    await tabTo(page, page.getByRole('link', { name: 'Remove filter: In stock only' }));
    await page.keyboard.press('Enter');
    await expect(page).not.toHaveURL(/availability/);

    // Pagination and a product card.
    await openCatalog(page, '/shop');
    await tabTo(
      page,
      page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: 'Next' }),
    );
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/page=2/);
    await expect(resultCount(page)).toBeVisible();
    const card = page.locator('main ul.grid > li a').first();
    const href = await card.getAttribute('href');
    await tabTo(page, card);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });
});
