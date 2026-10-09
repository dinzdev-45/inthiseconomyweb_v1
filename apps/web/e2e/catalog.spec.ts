import { expect, test, type Page } from '@playwright/test';

/**
 * What the homepage cannot show yet, on the test-only fixture page (enabled by
 * STOREFRONT_E2E_FIXTURES in playwright.config.ts): the hover image swap (homepage
 * placeholders have no second image) and the upcoming drop state. Grid and row
 * scenarios run on the real homepage in e2e/home.spec.ts.
 */
const FIXTURES = '/e2e-fixtures/catalog';

const hoverOpacity = (page: Page) =>
  page
    .locator('[data-fixture="grid"] [data-hover-image]')
    .evaluate((el) => getComputedStyle(el).opacity);

test.describe('desktop with a mouse', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Hover image on desktop', async ({ page }) => {
    await page.goto(FIXTURES);
    const card = page.locator('[data-fixture="grid"] li').first();
    await expect(card.getByAltText('Front view')).toBeVisible();
    expect(await hoverOpacity(page)).toBe('0');

    await card.hover();
    await expect.poll(() => hoverOpacity(page)).toBe('1');

    // Keyboard focus shows it too.
    await page.mouse.move(0, 0);
    await card.getByRole('link').focus();
    await expect.poll(() => hoverOpacity(page)).toBe('1');
  });

  test('keeps the primary image with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(FIXTURES);
    await page.locator('[data-fixture="grid"] li').first().hover();
    await page.waitForTimeout(400);
    expect(await hoverOpacity(page)).toBe('0');
  });
});

test.describe('touch device', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('keeps the primary image on touch', async ({ page }) => {
    await page.goto(FIXTURES);
    const card = page.locator('[data-fixture="grid"] li').first();
    await card.scrollIntoViewIfNeeded();
    await card.locator('[data-media="image"]').first().dispatchEvent('pointerenter');
    await page.waitForTimeout(400);
    expect(await hoverOpacity(page)).toBe('0');
  });
});

test('renders live and upcoming drop states', async ({ page }) => {
  await page.goto(FIXTURES);
  const live = page.locator('[data-fixture="drop-live"] section');
  await expect(live).toHaveAttribute('data-drop-status', 'live');
  await expect(live.getByRole('link', { name: 'EXPLORE THE COLLECTION' })).toHaveAttribute(
    'href',
    '/drops/collection-001-cost-of-living',
  );
  const upcoming = page.locator('[data-fixture="drop-upcoming"] section');
  await expect(upcoming.locator('time')).toHaveAttribute('datetime', '2026-11-20T03:00:00.000Z');
  await expect(upcoming.getByRole('timer', { name: 'Time until release' })).toBeAttached();
});
