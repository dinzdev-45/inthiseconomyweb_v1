import { expect, test, type Page } from '@playwright/test';

/**
 * storefront-navigation scenarios. Pages render inside the root layout, so the
 * header, menu, and footer behave the same on every route.
 */
const PAGE = '/';
const ACCOUNT_WORDS = /account|log ?in|sign ?in|register|wishlist/i;

const header = (page: Page) => page.locator('body > header');
const footer = (page: Page) => page.locator('body > footer');

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Header links', async ({ page }) => {
    await page.goto(PAGE);
    const links = header(page).getByRole('link');
    await expect(links).toHaveText([
      'InThisEconomy',
      'Shop',
      'New Drop',
      'Lookbook',
      'Story',
      'Search',
      'Cart',
    ]);
    const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual(['/', '/shop', '/drops', '/lookbook', '/story', '/search', '/cart']);
  });

  test('Desktop navigation', async ({ page }) => {
    for (const width of [768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(PAGE);
      const primary = page.getByRole('navigation', { name: 'Primary' });
      await expect(primary.getByRole('link')).toHaveText(['Shop', 'New Drop', 'Lookbook', 'Story']);
      await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeHidden();
    }
  });

  test('Header stays available', async ({ page }) => {
    await page.goto(PAGE);
    // Make the page taller than the viewport, with focusable targets far apart.
    await page.evaluate(() => {
      const main = document.querySelector('main')!;
      main.insertAdjacentHTML(
        'beforeend',
        '<a id="above" href="#above">Above</a><div style="height:3000px"></div><a id="below" href="#below">Below</a>',
      );
    });
    await page.focus('#below');
    await page.keyboard.press('Shift+Tab'); // focus moves back up to #above, which scrolls into view
    await expect(page.locator('#above')).toBeFocused();

    const headerBox = await header(page).boundingBox();
    const targetBox = await page.locator('#above').boundingBox();
    expect(headerBox!.y).toBe(0);
    expect(targetBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
  });

  test('Skip to main content', async ({ page }) => {
    await page.goto(PAGE);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
  });

  test('Footer links', async ({ page }) => {
    await page.goto(PAGE);
    const nav = footer(page).getByRole('navigation', { name: 'Footer' });
    const expected: Record<string, string> = {
      Shop: '/shop',
      'New Drop': '/drops',
      Lookbook: '/lookbook',
      Archive: '/drops/archive',
      'Our Story': '/story',
      'Size Guide': '/size-guide',
      Shipping: '/shipping',
      Returns: '/returns',
      FAQ: '/faq',
      Contact: '/contact',
      'Order Tracking': '/track-order',
    };
    for (const [name, href] of Object.entries(expected)) {
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    for (const heading of ['Shop', 'Help', 'Company', 'Follow']) {
      await expect(nav.getByRole('heading', { name: heading })).toBeVisible();
    }
    for (const name of ['Instagram', 'TikTok']) {
      const social = nav.getByRole('link', { name: new RegExp(`^${name}`) });
      await expect(social).toHaveAttribute('target', '_blank');
      await expect(social).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('Planned route not yet built', async ({ page }) => {
    await page.goto(PAGE);
    await header(page).getByRole('link', { name: 'Lookbook' }).click();
    await expect(page).toHaveURL(/\/lookbook$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(header(page)).toBeVisible();
    await expect(footer(page)).toBeVisible();
    const response = await page.request.get('/lookbook');
    expect(response.status()).toBe(404);
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('Open mobile menu', async ({ page }) => {
    await page.goto(PAGE);
    // Primary links are collapsed; wordmark, Search, and Cart stay visible.
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    for (const name of ['InThisEconomy', 'Search', 'Cart']) {
      await expect(header(page).getByRole('link', { name })).toBeVisible();
    }
    const trigger = page.getByRole('button', { name: 'Menu', exact: true });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await trigger.click();

    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link')).toHaveText([
      'Shop',
      'New Drop',
      'Lookbook',
      'Story',
      'Search',
      'Cart',
    ]);
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  });

  test('Close mobile menu with Escape', async ({ page }) => {
    await page.goto(PAGE);
    const trigger = page.getByRole('button', { name: 'Menu', exact: true });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('Focus stays in open menu', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    const controls = await menu.locator('a[href], button').count();

    for (let i = 0; i < controls * 2 + 1; i++) {
      await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
      expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
  });

  test('closes the menu when a link is chosen and via the close button', async ({ page }) => {
    await page.goto(PAGE);
    const trigger = page.getByRole('button', { name: 'Menu', exact: true });
    await trigger.click();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Story' }).click();
    await expect(page).toHaveURL(/\/story$/);
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeHidden();
  });

  test('No account or wishlist controls', async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const names = await page
      .locator(
        'body > header a, body > header button, body > footer a, body > footer button, dialog a, dialog button',
      )
      .evaluateAll((els) =>
        els.map(
          (el) =>
            `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('href') ?? ''}`,
        ),
      );
    expect(names.length).toBeGreaterThan(10);
    for (const name of names) expect(name).not.toMatch(ACCOUNT_WORDS);
  });
});
