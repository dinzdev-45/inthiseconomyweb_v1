import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { openCatalog, resultCount } from './support.ts';

/** Same rules as the homepage scan (e2e/quality.spec.ts): WCAG 2.2 A and AA, serious or critical. */
async function seriousViolations(page: Page) {
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
async function tabTo(page: Page, target: Locator) {
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

test.describe('storefront-catalog: Catalog accessibility', () => {
  test('Catalog accessibility scan', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const url of [
      '/shop',
      '/shop?category=apparel&size=M&color=black&availability=in-stock&sort=price-asc',
      '/shop?size=XXXL', // no results
      '/search',
      '/search?q=hoodie',
      '/products/zip-hoodie',
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
