import { expect, test, type Page } from '@playwright/test';

import { CATALOG_E2E } from './config.ts';
import { openCatalog, openProduct } from './support.ts';

const colorGroup = (page: Page) => page.getByRole('region', { name: /^Color:/ });
const sizeGroup = (page: Page) => page.getByRole('region', { name: /^Size/ });
const galleryColors = (page: Page) =>
  page
    .locator('[data-gallery-item]')
    .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.color ?? ''));
const sizeItem = (page: Page, code: string) => sizeGroup(page).locator(`li[data-size="${code}"]`);
const price = (page: Page) => page.locator('[data-price-block] p').first();
const availability = (page: Page) => page.locator('[data-availability]');

test.describe('storefront-product-detail: Product page', () => {
  test('Product page from a catalog card', async ({ page }) => {
    await openCatalog(page, '/search?q=overdraft');
    await page.getByRole('link', { name: /Overdraft Hoodie/ }).click();
    await expect(page).toHaveURL(/\/products\/overdraft-hoodie$/);
    await expect(page.locator('[data-price-block]')).toBeVisible();

    const main = page.locator('main');
    await expect(page.getByRole('heading', { level: 1, name: 'Overdraft Hoodie' })).toBeVisible();
    await expect(main).toContainText('Apparel');
    await expect(price(page)).toHaveText(/^Rp\s899\.000$/);
    await expect(page.getByRole('region', { name: 'Product images' })).toBeVisible();
    await expect(colorGroup(page)).toContainText('Washed Black');
    await expect(sizeGroup(page).getByRole('link')).toHaveText(['S', 'M', 'L', 'XL']);
    await expect(main).toContainText('Heavyweight fleece hoodie.');
    await expect(page.getByRole('link', { name: 'Back to the shop' })).toHaveAttribute(
      'href',
      '/shop',
    );
    // An "Add to cart" control, and no quantity or wishlist controls.
    await expect(main.locator('[data-add-to-cart] button')).toHaveText('Select a size');
    await expect(main.locator('select, input:not([type="hidden"])')).toHaveCount(0);
    await expect(main).not.toContainText(/wishlist|quantity/i);
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

test.describe('storefront-product-detail: Product gallery', () => {
  test('Gallery follows the selected color', async ({ page }) => {
    await openProduct(page, '/products/two-tone-hoodie?color=off-white');
    expect(await galleryColors(page)).toEqual(['off-white', '']);
    await openProduct(page, '/products/two-tone-hoodie?color=black');
    expect(await galleryColors(page)).toEqual(['black', '']);
  });

  test('Product without images', async ({ page }) => {
    await openProduct(page, '/products/bare-tee');
    const items = page.locator('[data-gallery-item]');
    await expect(items).toHaveCount(1);
    await expect(items.locator('img')).toHaveCount(0);
    const ratio = await items
      .locator('[data-media="placeholder"]')
      .evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
    expect(ratio).toBeCloseTo(0.8, 2);
  });
});

test.describe('storefront-product-detail: Color and size selection', () => {
  test('Choose a color', async ({ page }) => {
    await openProduct(page, '/products/two-tone-hoodie');
    await colorGroup(page)
      .getByRole('link', { name: /Off-White/ })
      .click();
    await expect(page).toHaveURL(/[?&]color=off-white(&|$)/);
    await expect(colorGroup(page).getByRole('link', { name: /Off-White/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(colorGroup(page)).toHaveAccessibleName('Color: Off-White');
    await expect.poll(() => galleryColors(page)).toEqual(['off-white', '']);
    // L exists in off-white (sold out), so it is a link now.
    await expect(sizeItem(page, 'L').getByRole('link')).toHaveCount(1);
  });

  test('Choose a size', async ({ page }) => {
    await openProduct(page, '/products/two-tone-hoodie?color=off-white');
    await sizeGroup(page).getByRole('link', { name: 'M', exact: true }).click();
    await expect(page).toHaveURL(/color=off-white&size=M$/);
    const m = sizeItem(page, 'M').getByRole('link');
    await expect(m).toHaveAttribute('aria-current', 'true');
    await expect(sizeGroup(page)).toHaveAccessibleName('Size: M');

    await page.reload();
    await expect(sizeItem(page, 'M').getByRole('link')).toHaveAttribute('aria-current', 'true');

    await sizeItem(page, 'L').getByRole('link').click();
    await expect(page).toHaveURL(/size=L$/);
    await page.goBack();
    await expect(page).toHaveURL(/size=M$/);
    await expect(sizeItem(page, 'M').getByRole('link')).toHaveAttribute('aria-current', 'true');
  });

  test('Sold-out size', async ({ page }) => {
    await openProduct(page, '/products/two-tone-hoodie?color=off-white');
    const l = sizeItem(page, 'L').getByRole('link');
    await expect(l).toContainText('Sold out');
    await l.click();
    await expect(page).toHaveURL(/size=L$/);
    await expect(availability(page)).toHaveText('Sold out');
  });

  test('Combination that does not exist', async ({ page }) => {
    await openProduct(page, '/products/two-tone-hoodie?color=black');
    const l = sizeItem(page, 'L');
    await expect(l).toHaveAttribute('data-state', 'unavailable');
    await expect(l.getByRole('link')).toHaveCount(0);
    await expect(l).toContainText('not available in Black');
  });

  test('Default selection', async ({ page }) => {
    // Charcoal is first by name but sold out in every size.
    await openProduct(page, '/products/zip-hoodie');
    await expect(colorGroup(page)).toHaveAccessibleName('Color: Stone Grey');
    await expect(colorGroup(page).getByRole('link', { name: /Charcoal/ })).toContainText(
      'Sold out',
    );
    await expect(sizeGroup(page)).toHaveAccessibleName('Size');
    await expect(sizeGroup(page).locator('[aria-current]')).toHaveCount(0);

    // A product with a single size has it selected.
    await openProduct(page, '/products/allowance-cap');
    await expect(sizeItem(page, 'OS').getByRole('link')).toHaveAttribute('aria-current', 'true');
  });

  test('Invalid selection in the URL', async ({ page }) => {
    const response = await openProduct(page, '/products/two-tone-hoodie?color=purple&size=M%20L');
    expect(response?.status()).toBe(200);
    await expect(colorGroup(page)).toHaveAccessibleName('Color: Black');
    await expect(sizeGroup(page).locator('[aria-current]')).toHaveCount(0);
  });
});

test.describe('storefront-product-detail: Price and availability', () => {
  test('Price of the selected variant', async ({ page }) => {
    await openProduct(page, '/products/zip-hoodie?color=stone-grey&size=M');
    await expect(price(page)).toHaveText(/^Rp\s829\.000$/);
    await expect(availability(page)).toHaveText('In stock');
  });

  test('Price before choosing a size', async ({ page }) => {
    await openProduct(page, '/products/zip-hoodie');
    await expect(price(page)).toHaveText(/^From Rp\s799\.000$/);
    await expect(availability(page)).toHaveCount(0);
  });

  test('Sold-out product', async ({ page }) => {
    await openProduct(page, '/products/sold-out-tee');
    await expect(availability(page)).toHaveText('Sold out');
    const sizes = sizeGroup(page).locator('li');
    await expect(sizes).toHaveCount(2);
    for (const item of await sizes.all()) await expect(item).toContainText('Sold out');
    await expect(page.locator('main')).not.toContainText(/\d+ (left|in stock)/i);
  });
});

test.describe('storefront-product-detail: Size guide', () => {
  test('Open the size guide', async ({ page }) => {
    await openProduct(page, '/products/overdraft-hoodie');
    const summary = page.locator('[data-size-guide] summary');
    const table = page.locator('[data-size-guide] table');
    await expect(table).toBeHidden();

    await summary.click();
    await expect(table).toBeVisible();
    await summary.click();
    await expect(table).toBeHidden();

    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(table).toBeVisible();
    await page.keyboard.press('Space');
    await expect(table).toBeHidden();
  });

  test("Size guide matches the product's sizes", async ({ page }) => {
    const headers = async (url: string) => {
      await openProduct(page, url);
      await page.locator('[data-size-guide] summary').click();
      return page.locator('[data-size-guide] thead th').allTextContents();
    };
    expect(await headers('/products/overdraft-hoodie')).toEqual([
      'Size',
      'Chest (cm)',
      'Length (cm)',
      'Sleeve (cm)',
    ]);
    await expect(page.locator('[data-size-guide] tbody th')).toHaveText(['S', 'M', 'L', 'XL']);
    expect(await headers('/products/minimum-wage-cargo')).toEqual([
      'Size',
      'Waist (cm)',
      'Inseam (cm)',
      'Leg opening (cm)',
    ]);
    await expect(page.locator('[data-size-guide] caption')).toBeVisible();
  });

  test('One-size product', async ({ page }) => {
    await openProduct(page, '/products/allowance-cap');
    await expect(sizeItem(page, 'OS').getByRole('link')).toHaveAttribute('aria-current', 'true');
    await page.locator('[data-size-guide] summary').click();
    await expect(page.locator('[data-size-guide]')).toContainText('This item is one size.');
  });
});

test.describe('storefront-product-detail: Product page SEO', () => {
  /** An attribute of an optional head element: null when it is absent (no waiting). */
  const optional = async (page: Page, selector: string, name: string) => {
    const element = page.locator(selector);
    return (await element.count()) ? element.getAttribute(name) : null;
  };
  const canonical = (page: Page) => optional(page, 'link[rel="canonical"]', 'href');
  const robots = (page: Page) => optional(page, 'meta[name="robots"]', 'content');

  test('Product page metadata', async ({ page }) => {
    await openProduct(page, '/products/overdraft-hoodie');
    expect(await page.title()).toBe('Overdraft Hoodie · InThisEconomy');
    const description = await optional(page, 'meta[name="description"]', 'content');
    expect(description).toBe('Heavyweight fleece hoodie.');
    expect(description!.length).toBeLessThanOrEqual(160);
    expect(await canonical(page)).toBe(`${CATALOG_E2E.webOrigin}/products/overdraft-hoodie`);
    expect((await robots(page)) ?? '').not.toMatch(/noindex/);

    // Without a description, a generic one.
    await openProduct(page, '/products/bare-tee');
    expect(await optional(page, 'meta[name="description"]', 'content')).toBe(
      'Bare Tee from InThisEconomy.',
    );
  });

  test('Selection does not change the canonical URL', async ({ page }) => {
    await openProduct(page, '/products/two-tone-hoodie?color=off-white&size=M');
    expect(await canonical(page)).toBe(`${CATALOG_E2E.webOrigin}/products/two-tone-hoodie`);
    expect((await robots(page)) ?? '').not.toMatch(/noindex/);
  });
});
