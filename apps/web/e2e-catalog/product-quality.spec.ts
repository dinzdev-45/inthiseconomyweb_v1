import { expect, test } from '@playwright/test';

import { openProduct, seriousViolations, tabTo } from './support.ts';

const WIDTHS = [320, 375, 768, 1024, 1440, 1920];

test.describe('storefront-product-detail: Product page accessibility', () => {
  test('Product page accessibility scan', async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const url of [
        '/products/two-tone-hoodie', // no selection
        '/products/two-tone-hoodie?color=off-white&size=L', // color and a sold-out size
      ]) {
        await openProduct(page, url);
        expect(await seriousViolations(page), `${url} at ${viewport.width}px`).toEqual([]);
      }
      await openProduct(page, '/products/overdraft-hoodie?color=washed-black&size=M');
      await page.locator('[data-size-guide] summary').click();
      await expect(page.locator('[data-size-guide] table')).toBeVisible();
      expect(await seriousViolations(page), `size guide open at ${viewport.width}px`).toEqual([]);
    }
  });

  test('Keyboard product selection', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openProduct(page, '/products/two-tone-hoodie');
    const colors = page.getByRole('region', { name: /^Color:/ });
    const sizes = page.getByRole('region', { name: /^Size/ });

    await tabTo(page, colors.getByRole('link', { name: /Off-White/ }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/color=off-white/);
    await expect(colors).toHaveAccessibleName('Color: Off-White');

    await tabTo(page, sizes.getByRole('link', { name: 'M', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/color=off-white&size=M$/);
    await expect(sizes).toHaveAccessibleName('Size: M');

    const summary = page.locator('[data-size-guide] summary');
    const table = page.locator('[data-size-guide] table');
    await tabTo(page, summary);
    await page.keyboard.press('Enter');
    await expect(table).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(table).toBeHidden();

    await tabTo(page, page.getByRole('link', { name: 'Back to the shop' }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/shop$/);
  });
});

test.describe('storefront-product-detail: Product page layout and performance', () => {
  test('Product page without horizontal overflow', async ({ page }) => {
    for (const url of [
      '/products/two-tone-hoodie?color=off-white&size=M',
      '/products/rent-due-coach-jacket',
      '/products/minimum-wage-cargo',
    ]) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await openProduct(page, url);
        await page.locator('[data-size-guide] summary').click();
        const layout = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          clipped: [...document.querySelectorAll('main h1, main h2, main p, main a, main caption')]
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

  test('Reserved product media space', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{
          value: number;
          hadRecentInput: boolean;
        }>) {
          if (!entry.hadRecentInput) w.__cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    for (const viewport of [
      { width: 375, height: 812 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/products/two-tone-hoodie?color=off-white', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      // Every media frame has its final 4:5 ratio, image or placeholder. Polled: a frame that is
      // swapping from a failed image to the placeholder measures 0×0 for an instant.
      await expect
        .poll(() =>
          page
            .locator('[data-gallery-item] [data-media]')
            .evaluateAll((frames) =>
              frames
                .map((el) => el.getBoundingClientRect())
                .map((box) => Math.round((box.width / box.height) * 100) / 100),
            ),
        )
        .toEqual(Array(2).fill(0.8));
      await page.waitForTimeout(1_000);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls, `cumulative layout shift at ${viewport.width}px`).toBeLessThan(0.1);
    }
  });
});
