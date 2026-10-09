import { expect, test } from '@playwright/test';

import { CATALOG_E2E } from './config.ts';

const RELEASE = '2099-01-01T03:00:00.000Z';

test.describe('storefront-drops: Drops page', () => {
  test('Next drop on the drops page', async ({ page }) => {
    await page.goto('/drops');
    const main = page.locator('main');
    await expect(main.locator('[data-drop-label]')).toHaveText('Upcoming');
    await expect(main.getByRole('heading', { name: /Overtime/ })).toBeVisible();
    await expect(main.locator(`time[datetime="${RELEASE}"]`)).toHaveText(
      '1 January 2099 at 10:00 WIB',
    );
    await expect(main.getByRole('timer', { name: 'Time until release' })).toBeVisible();
    await expect(main.getByRole('link', { name: 'Preview the drop' })).toHaveAttribute(
      'href',
      '/drops/overtime',
    );
    await expect(main.getByRole('link', { name: 'Now live: Cost of Living' })).toHaveAttribute(
      'href',
      '/drops/collection-001-cost-of-living',
    );
    await expect(main.getByRole('link', { name: 'Drop archive' })).toHaveAttribute(
      'href',
      '/drops/archive',
    );
  });
});

test.describe('storefront-drops: Drop page', () => {
  test('Upcoming drop page', async ({ page }) => {
    const response = await page.goto('/drops/overtime');
    expect(response?.status()).toBe(200);
    const main = page.locator('main');
    await expect(main.locator('[data-drop-label]')).toHaveText('Upcoming');
    await expect(main.getByRole('timer', { name: 'Time until release' })).toBeVisible();
    await expect(main.getByText('Built for the late shift.')).toBeVisible();
    const cards = main.locator('ul.grid > li');
    await expect(cards).toHaveCount(2);
    await expect(cards.locator('h2')).toHaveText(['Overtime Jacket', 'Night Shift Tee']);
    for (const card of await cards.all()) {
      await expect(card.locator('[data-release]')).toHaveText('Releases 1 January 2099');
    }
  });

  test('Live drop page', async ({ page }) => {
    await page.goto('/drops/collection-001-cost-of-living');
    const main = page.locator('main');
    await expect(main.locator('[data-drop-label]')).toHaveText('Now live');
    await expect(main.getByRole('timer')).toHaveCount(0);
    const cards = main.locator('ul.grid > li');
    await expect(cards).toHaveCount(4);
    await expect(cards.first().getByRole('link')).toHaveAttribute(
      'href',
      '/products/overdraft-hoodie',
    );
    await expect(main.locator('[data-release]')).toHaveCount(0);
  });

  test('Unknown drop page', async ({ page }) => {
    const response = await page.goto('/drops/no-such-drop');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  });
});

test.describe('storefront-drops: Drop archive', () => {
  test('Drop archive', async ({ page }) => {
    await page.goto('/drops/archive');
    const items = page.locator('main ul > li');
    await expect(items.locator('h2')).toHaveText(['Archive Zero', 'First Sample']);
    await expect(items.first().getByRole('link')).toHaveAttribute('href', '/drops/archive-zero');
  });
});

test.describe('storefront-drops: Release countdown', () => {
  test('Countdown to a release', async ({ page }) => {
    // The browser's clock 2 days, 3 hours, and 30 seconds before the release (the API's clock
    // is real); the spare seconds keep the reading stable while the page loads.
    await page.clock.install({
      time: new Date(Date.parse(RELEASE) - (2 * 86_400 + 3 * 3600 + 30) * 1000),
    });
    await page.goto('/drops/overtime');
    const timer = page.locator('main [data-countdown]');
    await expect(timer.locator('[data-unit="days"]')).toHaveText('02');
    await expect(timer.locator('[data-unit="hours"]')).toHaveText('03');
    const before = Number(await timer.locator('[data-unit="seconds"]').textContent());
    await page.clock.runFor(1000);
    await expect(timer.locator('[data-unit="seconds"]')).toHaveText(
      String(before - 1).padStart(2, '0'),
    );
    await expect(page.locator(`main time[datetime="${RELEASE}"]`)).toBeVisible();
  });
});

test.describe('storefront-drops: Release countdown (without JavaScript)', () => {
  test.use({ javaScriptEnabled: false });

  test('Release time without JavaScript', async ({ page }) => {
    await page.goto('/drops/overtime');
    await expect(page.locator(`main time[datetime="${RELEASE}"]`)).toHaveText(
      '1 January 2099 at 10:00 WIB',
    );
  });
});

test.describe('storefront-drops: Drop pages SEO, accessibility, and layout', () => {
  test('Drop page metadata', async ({ page }) => {
    await page.goto('/drops/overtime');
    expect(await page.title()).toBe('Overtime · COLLECTION 002 · InThisEconomy');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Built for the late shift.',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${CATALOG_E2E.webOrigin}/drops/overtime`,
    );
    expect(await page.locator('meta[name="robots"]').count()).toBe(0);
  });
});

test.describe('storefront-homepage: Drop feature (from the API)', () => {
  test('Homepage features the next drop', async ({ page }) => {
    await page.goto('/');
    const drop = page.locator('section[data-drop-status]');
    await expect(drop).toHaveAttribute('data-drop-status', 'upcoming');
    await expect(drop.getByRole('heading', { level: 2 })).toHaveText(/COLLECTION 002\s*Overtime/);
    await expect(drop.locator(`time[datetime="${RELEASE}"]`)).toHaveText('1 January 2099');
    await expect(drop.getByRole('timer', { name: 'Time until release' })).toBeVisible();
    await expect(drop.locator('[data-unit="days"]')).not.toHaveText('--');
  });
});
