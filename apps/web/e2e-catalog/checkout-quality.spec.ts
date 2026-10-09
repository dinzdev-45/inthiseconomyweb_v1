import { expect, test, type Page } from '@playwright/test';

import { addCheckoutTee, fillDetails } from './checkout-support.ts';
import { seriousViolations, tabTo } from './support.ts';

const WIDTHS = [320, 375, 768, 1024, 1440, 1920];
const main = (page: Page) => page.locator('main');

/** Places an order for one Checkout Tee and returns the order page URL. */
async function placedOrderUrl(page: Page): Promise<string> {
  await addCheckoutTee(page);
  await page.goto('/checkout');
  await fillDetails(page);
  await main(page).getByRole('button', { name: 'Place order' }).click();
  await expect(page).toHaveURL(/\/orders\/ITE-/);
  return page.url();
}

test.describe('storefront-checkout: Checkout accessibility and layout', () => {
  test('Checkout accessibility scan', async ({ page }) => {
    await addCheckoutTee(page);
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/checkout');
      expect(await seriousViolations(page), `empty form at ${viewport.width}px`).toEqual([]);
      await fillDetails(page, { Email: 'nope', 'Postal code': '1' });
      await main(page).getByRole('button', { name: 'Place order' }).click();
      await expect(page.locator('[data-error-summary]')).toBeVisible();
      expect(await seriousViolations(page), `errors at ${viewport.width}px`).toEqual([]);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/checkout');
    await fillDetails(page);
    await main(page).getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/orders\/ITE-/);
    expect(await seriousViolations(page), 'order page').toEqual([]);
  });

  test('Keyboard checkout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addCheckoutTee(page);
    await tabTo(page, main(page).getByRole('link', { name: 'Checkout', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/checkout$/);

    const fields: [string, string][] = [
      ['Email', 'ana@example.com'],
      ['Mobile number', '081234567890'],
      ['Recipient name', 'Ana Putri'],
      ['Street address', 'Jl. Melati No. 5'],
      ['City or regency', 'Bandung'],
    ];
    for (const [label, value] of fields) {
      await tabTo(page, main(page).getByLabel(label, { exact: true }));
      await page.keyboard.type(value);
    }
    const province = main(page).getByLabel('Province', { exact: true });
    await tabTo(page, province);
    await page.keyboard.type('Jawa Barat');
    await expect(province).toHaveValue('32');
    await tabTo(page, main(page).getByLabel('Postal code', { exact: true }));
    await page.keyboard.type('40115');
    await tabTo(page, main(page).getByRole('button', { name: 'Place order' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/orders\/ITE-/);
    await expect(page.locator('[data-order-status]')).toContainText('Awaiting payment');
  });

  test('Checkout without horizontal overflow', async ({ page }) => {
    const orderUrl = await placedOrderUrl(page);
    await addCheckoutTee(page);
    for (const url of ['/checkout', orderUrl]) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url);
        await expect(main(page).locator('h1')).toBeVisible();
        const layout = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          clipped: [
            ...document.querySelectorAll(
              'main h1, main h2, main p, main a, main label, main dt, main dd, main address, main button',
            ),
          ]
            .filter((el) => el.getClientRects().length > 0 && !el.closest('.sr-only'))
            .filter(
              (el) =>
                el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline',
            )
            .map((el) => `${el.tagName} ${el.textContent?.trim().slice(0, 30)}`),
        }));
        expect(layout.scroll, `${url} scroll width at ${width}px`).toBe(layout.viewport);
        expect(layout.clipped, `${url} clipped text at ${width}px`).toEqual([]);
      }
    }
  });
});
