import { expect, test, type Page } from '@playwright/test';

import { cardNames, openCatalog, resultCount } from './support.ts';

const filters = (page: Page) => page.locator('form[action="/shop"]');
const apply = async (page: Page) => {
  await filters(page).getByRole('button', { name: 'Apply' }).click();
  await expect(resultCount(page)).toBeVisible();
};
/** Card prices as numbers (the lowest price for "From" cards). */
const prices = async (page: Page) =>
  (await page.locator('main ul.grid > li p.tabular-nums').allTextContents()).map((text) =>
    Number(text.replace(/\D/g, '')),
  );

test.describe('storefront-catalog: Filters and sorting', () => {
  test('Filter the shop by category', async ({ page }) => {
    await openCatalog(page, '/shop');
    await filters(page).getByLabel('Category').selectOption('outerwear');
    await apply(page);
    await expect(page).toHaveURL(/[?&]category=outerwear(&|$)/);
    expect((await cardNames(page)).sort()).toEqual(['Layoff Parka', 'Zip Hoodie']);
    await expect(resultCount(page)).toHaveText('2 products');
    await expect(
      page.getByRole('link', { name: 'Remove filter: Category Outerwear' }),
    ).toBeVisible();
  });

  test('Combine shop filters', async ({ page }) => {
    await openCatalog(page, '/shop');
    await filters(page).getByLabel('Size').selectOption('M');
    await filters(page).getByLabel('Color').selectOption('black');
    await filters(page).getByLabel('In stock only').check();
    await apply(page);
    // In stock in size M black: not "Sold Out Tee" (sold out) or "Last Black Tee" (M is at 0).
    expect(await cardNames(page)).toEqual(['Two Tone Hoodie', 'Rent Due Coach Jacket']);
    for (const chip of ['Size M', 'Color Black', 'In stock only']) {
      await expect(page.getByRole('link', { name: `Remove filter: ${chip}` })).toBeVisible();
    }
  });

  test('Sort the shop', async ({ page }) => {
    await openCatalog(page, '/shop');
    await filters(page).getByLabel('Sort by').selectOption('price-asc');
    await apply(page);
    await expect(page).toHaveURL(/[?&]sort=price-asc(&|$)/);
    const shown = await prices(page);
    expect(shown).toEqual([...shown].sort((a, b) => a - b));
    expect((await cardNames(page))[0]).toBe('Last Black Tee');
  });

  test('Filters reset to the first page', async ({ page }) => {
    await openCatalog(page, '/shop?page=2');
    await expect(page.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await filters(page).getByLabel('Sort by').selectOption('price-desc');
    await apply(page);
    expect(new URL(page.url()).searchParams.get('page')).toBeNull();
    await expect(page.getByRole('link', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // Removing a filter chip also starts again at page 1.
    await openCatalog(page, '/shop?category=apparel&page=2');
    await page.getByRole('link', { name: 'Remove filter: Category Apparel' }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('Shareable catalog URL', async ({ page }) => {
    const url = '/shop?category=apparel&availability=in-stock&sort=price-desc&page=2';
    await openCatalog(page, url);
    const names = await cardNames(page);
    expect(names.length).toBeGreaterThan(0);
    const assertView = async () => {
      expect(await cardNames(page)).toEqual(names);
      await expect(filters(page).getByLabel('Category')).toHaveValue('apparel');
      await expect(filters(page).getByLabel('In stock only')).toBeChecked();
      await expect(filters(page).getByLabel('Sort by')).toHaveValue('price-desc');
      await expect(
        page.getByRole('link', { name: 'Remove filter: Category Apparel' }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    };
    await assertView();

    await page.reload();
    await expect(resultCount(page)).toBeVisible();
    await assertView();

    // A new tab with the same URL.
    const other = await page.context().newPage();
    await openCatalog(other, url);
    expect(await cardNames(other)).toEqual(names);
    await other.close();

    // Another view, then back.
    await page.getByRole('link', { name: 'Remove filter: In stock only' }).click();
    await expect(page).not.toHaveURL(/availability/);
    await page.goBack();
    await expect(page).toHaveURL(/availability=in-stock/);
    await expect(resultCount(page)).toBeVisible();
    await assertView();
  });
});

test.describe('storefront-catalog: Catalog states', () => {
  test('Invalid filter in the URL', async ({ page }) => {
    await openCatalog(page, '/shop?sort=popular&size=M%20L');
    await expect(page.locator('[data-ignored-notice]')).toContainText('ignored');
    await expect(resultCount(page)).toHaveText('30 products');
    expect((await cardNames(page))[0]).toBe('Zip Hoodie');
    await expect(filters(page).getByLabel('Sort by')).toHaveValue('');
    await expect(page.locator('[data-active-filters]')).toHaveCount(0);
  });
});
