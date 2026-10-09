import { expect, test, type Page } from '@playwright/test';

/** storefront-homepage scenarios on the real homepage (the suite runs with no API). */

const sectionLabels = (page: Page) =>
  page
    .locator('main > div > section')
    .evaluateAll((sections) =>
      sections.map((section) =>
        document
          .getElementById(section.getAttribute('aria-labelledby')!)!
          .textContent!.replace(/\s+/g, ' ')
          .trim(),
      ),
    );

const columns = (page: Page, selector: string) =>
  page.locator(`${selector} > li`).evaluateAll((items) => {
    const top = Math.min(...items.map((li) => li.getBoundingClientRect().top));
    return items.filter((li) => Math.abs(li.getBoundingClientRect().top - top) < 2).length;
  });

const section = (page: Page, headingId: string) =>
  page.locator(`section[aria-labelledby="${headingId}"]`);

test('Homepage section order', async ({ page }) => {
  await page.goto('/');
  expect(await sectionLabels(page)).toEqual([
    // No drop section: this suite runs without an API (the catalog suite covers the drop).
    'IN THIS ECONOMY',
    'Featured',
    'PRICED IN',
    'Shop the look',
    'New arrivals',
    'Lookbook',
    'OUR ECONOMY.',
    'Newsletter',
  ]);
});

test('Heading structure', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('IN THIS ECONOMY');
  const levels = await page
    .locator('main > div > section')
    .evaluateAll((sections) =>
      sections.map((s) => document.getElementById(s.getAttribute('aria-labelledby')!)!.tagName),
    );
  expect(levels).toEqual(['H1', 'H2', 'H2', 'H2', 'H2', 'H2', 'H2', 'H2']);
});

test('Hero content', async ({ page }) => {
  await page.goto('/');
  const hero = section(page, 'hero-heading');
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText('IN THIS ECONOMY');
  for (const text of ['COLLECTION 001', 'COST OF LIVING']) await expect(hero).toContainText(text);
  await expect(hero).toContainText(/Clothing for the world we[’']re living in\./);
  await expect(hero.getByRole('link', { name: 'SHOP THE DROP' })).toHaveAttribute('href', '/drops');
});

test('Hero fills the first screen', async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const header = await page.locator('body > header').boundingBox();
    const hero = await section(page, 'hero-heading').boundingBox();
    expect(hero!.height).toBeGreaterThanOrEqual(viewport.height - header!.height - 1);
  }
});

test('Featured products grid', async ({ page }) => {
  for (const [width, expected] of [
    [375, 2],
    [1440, 4],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const featured = section(page, 'featured-heading');
    await expect(featured.locator('article')).toHaveCount(4);
    expect(await columns(page, 'section[aria-labelledby="featured-heading"] ul')).toBe(expected);
    await expect(featured.getByRole('link', { name: 'SHOP ALL' })).toHaveAttribute('href', '/shop');
  }
});

test('Campaign banner', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const campaign = section(page, 'campaign-heading');
    await expect(campaign.getByRole('heading', { level: 2 })).toHaveText('PRICED IN');
    await expect(campaign).toContainText('Heavyweight basics');
    const visual = await campaign.locator('[data-media]').boundingBox();
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    expect(Math.round(visual!.width)).toBe(viewport);
    expect(Math.round(visual!.x)).toBe(0);
  }
});

test('Shop the look preview', async ({ page }) => {
  await page.goto('/');
  const look = section(page, 'look-heading');
  await expect(look.locator('[data-look-image] [data-media]')).toHaveCount(1);
  const items = look.locator('ol a');
  const count = await items.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(3);
  for (const href of await items.evaluateAll((els) => els.map((el) => el.getAttribute('href')))) {
    expect(href).toMatch(/^\/products\/[a-z0-9-]+$/);
  }
  await expect(look.getByRole('link', { name: 'SHOP THE LOOK' })).toHaveAttribute(
    'href',
    '/lookbook',
  );
  // Positions are stored for future hotspots, but nothing on the image is interactive.
  await expect(look.locator('ol li[data-position-x][data-position-y]')).toHaveCount(count);
  await expect(
    look.locator('[data-look-image] a, [data-look-image] button, [data-look-image] [tabindex]'),
  ).toHaveCount(0);
});

test('New arrivals layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const rail = section(page, 'new-arrivals-heading').locator('[data-product-rail]');
  const box = await rail.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(box.scroll).toBeGreaterThan(box.client);
  const doc = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    vw: window.innerWidth,
  }));
  expect(doc.scroll).toBe(doc.vw);

  await rail.locator('li').last().getByRole('link').focus();
  expect(await rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(
    await columns(page, 'section[aria-labelledby="new-arrivals-heading"] [data-product-rail]'),
  ).toBe(5);
});

test('Lookbook preview', async ({ page }) => {
  await page.goto('/');
  const lookbook = section(page, 'lookbook-heading');
  expect(await lookbook.locator('[data-media]').count()).toBeGreaterThanOrEqual(2);
  await expect(lookbook.getByRole('link', { name: 'VIEW LOOKBOOK' })).toHaveAttribute(
    'href',
    '/lookbook',
  );
});

test('Brand manifesto', async ({ page }) => {
  await page.goto('/');
  const manifesto = section(page, 'manifesto-heading');
  await expect(manifesto.getByRole('heading', { level: 2 })).toHaveText('OUR ECONOMY.');
  await expect(manifesto).toContainText(/Clothing for the world we[’']re living in\./);
  await expect(manifesto.getByRole('link')).toHaveAttribute('href', '/story');
});

test('Newsletter submission stays local', async ({ page }) => {
  await page.goto('/');
  const newsletter = section(page, 'newsletter-heading');
  await newsletter.scrollIntoViewIfNeeded();
  // Let Next.js link prefetching (GET ?_rsc=) for links now in view finish first: wait for 1 s
  // without any new request, then require that submitting causes no request at all.
  let last = Date.now();
  page.on('request', () => (last = Date.now()));
  await expect.poll(() => Date.now() - last, { timeout: 15_000 }).toBeGreaterThan(1_000);

  const requests: string[] = [];
  page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));
  await newsletter.getByLabel('Email').fill('name@example.com');
  await newsletter.getByRole('button', { name: 'Notify me' }).click();

  await expect(newsletter.getByRole('status')).toHaveText(
    /isn’t open yet.*haven’t saved your email/,
  );
  await page.waitForTimeout(1_000);
  expect(requests).toEqual([]);
  expect(await page.context().cookies()).toEqual([]);
  const stored = await page.evaluate(() => localStorage.length + sessionStorage.length);
  expect(stored).toBe(0);
});

test('offers the same honest newsletter form in the footer', async ({ page }) => {
  await page.goto('/');
  const form = page.getByRole('form', { name: 'Footer newsletter sign-up' });
  await form.getByLabel('Email').fill('name@example.com');
  await form.getByRole('button', { name: 'Notify me' }).click();
  await expect(page.locator('body > footer').getByRole('status')).toContainText(
    'haven’t saved your email',
  );
});

test('adds no account or wishlist controls in the page content', async ({ page }) => {
  await page.goto('/');
  const names = await page
    .locator('main a, main button, main input')
    .evaluateAll((els) =>
      els.map(
        (el) =>
          `${el.textContent} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('href') ?? ''}`,
      ),
    );
  for (const name of names) expect(name).not.toMatch(/account|log ?in|sign ?in|register|wishlist/i);
});
