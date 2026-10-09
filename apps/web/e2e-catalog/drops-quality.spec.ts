import { expect, test } from '@playwright/test';

import { seriousViolations, tabTo } from './support.ts';

const WIDTHS = [320, 375, 768, 1024, 1440, 1920];
// Upcoming (Overtime, 2099), live (Collection 001), and the archive (fixtures.sql).
const PAGES = [
  '/drops',
  '/drops/overtime',
  '/drops/collection-001-cost-of-living',
  '/drops/archive',
];

test.describe('storefront-drops: Drop pages SEO, accessibility, and layout', () => {
  test('Drop pages accessibility scan', async ({ page }) => {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const url of PAGES) {
        await page.goto(url);
        await expect(page.locator('main h1')).toBeAttached();
        // Once the countdown has filled in, so the scan sees what customers see.
        if (url === '/drops' || url === '/drops/overtime') {
          await expect(page.locator('main [data-unit="days"]')).not.toHaveText('--');
        }
        expect(await seriousViolations(page), `${url} at ${width}px`).toEqual([]);
      }
    }
  });

  test('Keyboard drop navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/drops');
    await tabTo(page, page.getByRole('link', { name: 'Preview the drop' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/drops\/overtime$/);

    await tabTo(page, page.locator('main').getByRole('link', { name: /Overtime Jacket/ }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/products\/overtime-jacket$/);

    await page.goto('/drops');
    await tabTo(page, page.getByRole('link', { name: 'Drop archive' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/drops\/archive$/);
    await tabTo(page, page.locator('main').getByRole('link', { name: /Archive Zero/ }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/drops\/archive-zero$/);
  });

  test('Drop pages without horizontal overflow', async ({ page }) => {
    for (const url of ['/drops', '/drops/overtime', '/drops/archive']) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url);
        await expect(page.locator('main h1')).toBeAttached();
        const layout = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          clipped: [
            ...document.querySelectorAll('main h1, main h2, main p, main a, main dd, main dt'),
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
