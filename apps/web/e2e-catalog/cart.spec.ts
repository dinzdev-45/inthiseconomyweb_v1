import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { CATALOG_E2E } from './config.ts';
import { openProduct } from './support.ts';

const addButton = (page: Page) => page.locator('[data-add-to-cart] button');
const message = (page: Page) => page.locator('main [data-cart-message]');
const lines = (page: Page) => page.locator('main ul > li[data-line-status]');
const subtotal = (page: Page) => page.locator('[data-subtotal]');

/** Adds the variant at `url` (a product page with color and size) and waits for /cart. */
async function add(page: Page, url: string) {
  await openProduct(page, url);
  await addButton(page).click();
  await expect(page).toHaveURL(/\/cart\?added=/);
}

test.describe('storefront-cart: Add to cart', () => {
  test('Add the selected variant', async ({ page }) => {
    await add(page, '/products/two-tone-hoodie?color=off-white&size=M');
    await expect(message(page)).toHaveText('Added Two Tone Hoodie (Off-White, M) to your cart.');
    await expect(lines(page)).toHaveCount(1);
    await expect(lines(page).getByLabel(/Quantity for Two Tone Hoodie/)).toHaveValue('1');
  });

  test('No size selected', async ({ page }) => {
    await openProduct(page, '/products/two-tone-hoodie');
    await expect(addButton(page)).toBeDisabled();
    await expect(addButton(page)).toHaveText('Select a size');
  });

  test('Sold-out variant cannot be added', async ({ page }) => {
    await openProduct(page, '/products/two-tone-hoodie?color=off-white&size=L');
    await expect(addButton(page)).toBeDisabled();
    await expect(addButton(page)).toHaveText('Sold out');
  });

  test('Add fails', async ({ page }) => {
    // Filler Tee 01 has stock 10: fill the line to the limit, then add once more.
    await add(page, '/products/filler-tee-01?color=white&size=S');
    await lines(page)
      .getByLabel(/Quantity for Filler Tee 01/)
      .selectOption('10');
    await lines(page)
      .getByRole('button', { name: /Update quantity/ })
      .click();
    await expect(message(page)).toHaveText('Quantity updated.');

    await openProduct(page, '/products/filler-tee-01?color=white&size=S');
    await addButton(page).click();
    await expect(page).toHaveURL(/\/products\/filler-tee-01\?color=white&size=S&cart=limit$/);
    await expect(message(page)).toContainText('most of this item');
    await expect(
      page.getByRole('region', { name: /^Size/ }).getByRole('link', { name: 'S', exact: true }),
    ).toHaveAttribute('aria-current', 'true');
  });

  test('First add creates the cart', async ({ page, context }) => {
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith(CATALOG_E2E.apiUrl)) apiRequests.push(request.url());
    });
    expect((await context.cookies()).find((c) => c.name === 'ite_cart')).toBeUndefined();
    await add(page, '/products/zip-hoodie?color=stone-grey&size=S');
    const cookie = (await context.cookies()).find((c) => c.name === 'ite_cart');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(29 * 24 * 60 * 60);
    expect(apiRequests).toEqual([]);
  });
});

test.describe('storefront-cart: Cart page', () => {
  test('Review the cart', async ({ page }) => {
    await add(page, '/products/two-tone-hoodie?color=off-white&size=M');
    await add(page, '/products/zip-hoodie?color=stone-grey&size=M');
    await expect(lines(page)).toHaveCount(2);

    const first = lines(page).nth(0);
    await expect(first.getByRole('link', { name: 'Two Tone Hoodie' })).toHaveAttribute(
      'href',
      '/products/two-tone-hoodie?color=off-white&size=M',
    );
    await expect(first).toContainText(/Off-White · M · Rp\s699\.000 each/);
    await expect(first.locator('[data-line-total]')).toHaveText(/Rp\s699\.000/);
    await expect(first.locator('[data-media]')).toHaveCount(1);
    await expect(lines(page).nth(1).locator('[data-line-total]')).toHaveText(/Rp\s829\.000/);
    await expect(subtotal(page)).toContainText(/Rp\s1\.528\.000/);
    await expect(page.getByText('Checkout is coming soon.')).toBeVisible();
    // Not indexed.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('Change a quantity on the cart page', async ({ page }) => {
    // Off-white M has stock 3.
    await add(page, '/products/two-tone-hoodie?color=off-white&size=M');
    const quantity = lines(page).getByLabel(/Quantity for Two Tone Hoodie/);
    await quantity.selectOption('2');
    await lines(page)
      .getByRole('button', { name: /Update quantity/ })
      .click();
    await expect(message(page)).toHaveText('Quantity updated.');
    await expect(quantity).toHaveValue('2');
    await expect(lines(page).locator('[data-line-total]')).toHaveText(/Rp\s1\.398\.000/);
    await expect(subtotal(page)).toContainText(/Rp\s1\.398\.000/);

    await quantity.selectOption('4');
    await lines(page)
      .getByRole('button', { name: /Update quantity/ })
      .click();
    await expect(message(page)).toHaveText('There isn’t enough stock for that quantity.');
    await expect(quantity).toHaveValue('2');
  });

  test('Remove a line on the cart page', async ({ page }) => {
    await add(page, '/products/two-tone-hoodie?color=black&size=M');
    await add(page, '/products/zip-hoodie?color=stone-grey&size=S');
    await page.getByRole('button', { name: 'Remove Two Tone Hoodie, Black, M' }).click();
    await expect(message(page)).toHaveText('Item removed.');
    await expect(lines(page)).toHaveCount(1);
    await expect(subtotal(page)).toContainText(/Rp\s799\.000/);
    await page.getByRole('button', { name: /^Remove Zip Hoodie/ }).click();
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
    await expect(subtotal(page)).toHaveCount(0);
  });

  test('Empty cart', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute(
      'href',
      '/shop',
    );
    await expect(subtotal(page)).toHaveCount(0);
    await expect(lines(page)).toHaveCount(0);
  });

  test('Expired cart cookie', async ({ page, context }) => {
    const stale = 'z'.repeat(43); // well-formed, but no such cart
    await context.addCookies([{ name: 'ite_cart', value: stale, url: CATALOG_E2E.webOrigin }]);
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty.')).toBeVisible();

    await add(page, '/products/zip-hoodie?color=stone-grey&size=S');
    await expect(lines(page)).toHaveCount(1);
    const cookie = (await context.cookies()).find((c) => c.name === 'ite_cart');
    expect(cookie?.value).not.toBe(stale);
  });
});

test.describe('storefront-cart: Header cart count', () => {
  const cartLink = (page: Page) => page.getByRole('banner').getByRole('link', { name: /^Cart/ });
  // The visually hidden suffix is absolutely positioned, so Chrome inserts a space before its
  // comma ("Cart , 2 items"); screen readers announce the same words either way.
  const named = (count: string) => new RegExp(`^Cart\\s?, ${count}$`);

  test('Count after adding', async ({ page }) => {
    await add(page, '/products/two-tone-hoodie?color=off-white&size=M');
    await expect(cartLink(page)).toHaveAccessibleName(named('1 item'));
    await add(page, '/products/zip-hoodie?color=stone-grey&size=S');
    await page.goto('/shop');
    await expect(cartLink(page)).toHaveAccessibleName(named('2 items'));
    await expect(cartLink(page).locator('[data-cart-count]')).toHaveText('2');
  });

  test('Homepage stays static with a cart', async ({ page }) => {
    await add(page, '/products/zip-hoodie?color=stone-grey&size=S');
    await page.goto('/');
    await expect(cartLink(page)).toHaveAccessibleName(named('1 item'));
    // The build this suite runs still prerenders the homepage, fully static.
    const manifest = JSON.parse(
      readFileSync(
        fileURLToPath(new URL('../.next/prerender-manifest.json', import.meta.url)),
        'utf8',
      ),
    ) as { routes: Record<string, { initialRevalidateSeconds: number | false }> };
    expect(manifest.routes['/']?.initialRevalidateSeconds).toBe(false);
  });
});
