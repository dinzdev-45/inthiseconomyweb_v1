import { expect, test } from '@playwright/test';

import { openCatalog } from './support.ts';

const WIDTHS = [320, 375, 768, 1024, 1440, 1920];

test.describe('storefront-catalog: Catalog responsive layout and motion', () => {
  test('Catalog without horizontal overflow', async ({ page }) => {
    for (const url of ['/shop', '/shop?category=outerwear', '/search?q=tee']) {
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await openCatalog(page, url);
        const layout = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          // Text that does not fit its box (clipped or overflowing horizontally).
          clipped: [...document.querySelectorAll('main h1, main h2, main p, main a, main label')]
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

  test('Filters on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openCatalog(page, '/shop');
    const disclosure = page.locator('[data-filters]');
    const summary = disclosure.getByText('Filter and sort');
    const category = page.locator('form[action="/shop"]').getByLabel('Category');

    // Closed by default.
    await expect(disclosure).not.toHaveAttribute('open');
    await expect(category).toBeHidden();

    // Pointer opens and closes it.
    await summary.click();
    await expect(category).toBeVisible();
    await summary.click();
    await expect(category).toBeHidden();

    // So does the keyboard.
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(category).toBeVisible();
    await page.keyboard.press('Space');
    await expect(category).toBeHidden();

    // From 1024 px the filters are always shown, without the disclosure toggle.
    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(category).toBeVisible();
    await expect(summary).toBeHidden();
  });

  test('Reserved catalog media space', async ({ page }) => {
    // Record every layout shift from the very start of the load.
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
      await page.goto('/shop', { waitUntil: 'load' });
      // Results stream in after the skeleton; the shift measurement covers that swap too.
      await expect(page.locator('main [data-result-count]')).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      // Every card's media frame has its final 4:5 ratio, whether an image or the placeholder.
      const ratios = await page
        .locator('main ul.grid:not([data-skeleton]) > li [data-media]')
        .evaluateAll((frames) =>
          frames
            .filter((el) => !el.closest('[data-hover-image]'))
            .map((el) => el.getBoundingClientRect())
            .map((box) => box.width / box.height),
        );
      expect(ratios).toHaveLength(24);
      for (const ratio of ratios) expect(ratio).toBeCloseTo(0.8, 2);
      await page.waitForTimeout(1_000);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls, `cumulative layout shift at ${viewport.width}px`).toBeLessThan(0.1);
    }
  });
});
