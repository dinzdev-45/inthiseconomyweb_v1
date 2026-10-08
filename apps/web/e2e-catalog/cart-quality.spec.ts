import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { CATALOG_E2E } from './config.ts';
import { openProduct, seriousViolations, tabTo } from './support.ts';

const WIDTHS = [320, 375, 768, 1024, 1440, 1920];

async function add(page: Page, url: string) {
  await openProduct(page, url);
  await page.locator('[data-add-to-cart] button').click();
  await expect(page).toHaveURL(/\/cart\?added=/);
}

/**
 * Raises this context's own cart line above its stock straight in the database, so the line is
 * flagged INSUFFICIENT_STOCK without touching any product other tests rely on.
 */
async function overStock(context: BrowserContext, quantity: number) {
  const token = (await context.cookies()).find((c) => c.name === 'ite_cart')!.value;
  const hash = createHmac('sha256', CATALOG_E2E.apiEnv.SESSION_SECRET)
    .update(`cart:${token}`)
    .digest('hex');
  execFileSync('psql', [
    CATALOG_E2E.databaseUrl,
    '-qc',
    `UPDATE cart_lines SET quantity = ${quantity} WHERE cart_id = (SELECT id FROM carts WHERE token_hash = '${hash}')`,
  ]);
}

test.describe('storefront-cart: Cart accessibility and layout', () => {
  test('Cart accessibility scan', async ({ page, context }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/cart');
      await expect(page.getByText('Your cart is empty.')).toBeVisible();
      expect(await seriousViolations(page), `empty cart at ${viewport.width}px`).toEqual([]);

      await openProduct(page, '/products/two-tone-hoodie?color=off-white&size=M');
      expect(await seriousViolations(page), `add to cart at ${viewport.width}px`).toEqual([]);
      await openProduct(page, '/products/two-tone-hoodie?color=off-white&size=L&cart=stock');
      expect(await seriousViolations(page), `sold out with message at ${viewport.width}px`).toEqual(
        [],
      );
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await add(page, '/products/last-black-tee?color=black&size=L');
    await add(page, '/products/zip-hoodie?color=stone-grey&size=S');
    expect(await seriousViolations(page), 'cart with lines').toEqual([]);

    await overStock(context, 5); // Last Black Tee L has stock 4
    await page.goto('/cart');
    await expect(page.locator('[data-line-note]').first()).toContainText('Not enough stock');
    expect(await seriousViolations(page), 'cart with a flagged line').toEqual([]);
  });

  test('Keyboard cart use', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openProduct(page, '/products/two-tone-hoodie?color=off-white&size=M');
    await tabTo(page, page.locator('[data-add-to-cart] button'));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/cart\?added=/);

    const quantity = page.getByLabel(/^Quantity for Two Tone Hoodie/);
    await tabTo(page, quantity);
    await page.keyboard.type('2');
    await expect(quantity).toHaveValue('2');
    await tabTo(page, page.getByRole('button', { name: /^Update quantity for Two Tone Hoodie/ }));
    await page.keyboard.press('Enter');
    await expect(page.locator('main [data-cart-message]')).toHaveText('Quantity updated.');

    await tabTo(page, page.getByRole('button', { name: /^Remove Two Tone Hoodie/ }));
    await page.keyboard.press('Enter');
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  });

  test('Cart without horizontal overflow', async ({ page }) => {
    await add(page, '/products/rent-due-coach-jacket?color=black&size=M');
    await add(page, '/products/two-tone-hoodie?color=off-white&size=M');
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/cart?status=stock');
      await expect(page.locator('[data-subtotal]')).toBeVisible();
      const layout = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        clipped: [
          ...document.querySelectorAll('main h1, main h2, main p, main a, main label, main button'),
        ]
          .filter((el) => el.getClientRects().length > 0 && !el.closest('.sr-only'))
          .filter(
            (el) =>
              el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline',
          )
          .map((el) => `${el.tagName} ${el.textContent?.trim().slice(0, 30)}`),
      }));
      expect(layout.scroll, `scroll width at ${width}px`).toBe(layout.viewport);
      expect(layout.clipped, `clipped text at ${width}px`).toEqual([]);
    }
  });
});
