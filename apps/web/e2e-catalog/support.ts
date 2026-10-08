import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';

/** The catalog's result count (the footer newsletter has its own status region). */
export const resultCount = (page: Page) => page.locator('main [data-result-count]');

/** Product cards of the catalog grid. */
export const cards = (page: Page) => page.locator('main ul.grid:not([data-skeleton]) > li');

/** Opens a catalog URL and waits for the streamed results (the count) to arrive. */
export async function openCatalog(page: Page, url: string) {
  await page.goto(url);
  await expect(resultCount(page)).toBeVisible();
}

/** Names of the product cards on the current page, in order. */
export const cardNames = (page: Page) => cards(page).locator('h2').allTextContents();

/** Same rules as the homepage scan (e2e/quality.spec.ts): WCAG 2.2 A and AA, serious or critical. */
export async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    // The wordmark is a logotype; WCAG 1.4.3 exempts it from contrast minimums.
    .exclude('[data-logotype]')
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 4)
          .join(' | ')}`,
    );
}

/** Tabs until `target` has focus (at most 150 presses), then checks the focus is visible. */
export async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 150; i++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) {
      const style = await target.evaluate((el) => {
        const s = getComputedStyle(el);
        return { outline: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      expect(style.outline).not.toBe('none');
      expect(style.width).toBeGreaterThanOrEqual(2);
      return;
    }
  }
  throw new Error(`Could not reach ${target} with Tab`);
}

/** Opens a product page and waits for it (the page streams after its loading state). */
export async function openProduct(page: Page, url: string) {
  const response = await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('[data-price-block]')).toBeVisible();
  return response;
}
