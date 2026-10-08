import { expect, test, type Page } from '@playwright/test';

import { CATALOG_E2E } from './config.ts';

/** An attribute of an optional element: null when the element is absent (no waiting). */
const optional = async (page: Page, selector: string, name: string) => {
  const element = page.locator(selector);
  return (await element.count()) ? element.getAttribute(name) : null;
};

const head = async (page: Page, url: string) => {
  await page.goto(url);
  return {
    title: await page.title(),
    description: await optional(page, 'meta[name="description"]', 'content'),
    canonical: await optional(page, 'link[rel="canonical"]', 'href'),
    robots: await optional(page, 'meta[name="robots"]', 'content'),
  };
};
const abs = (path: string) => `${CATALOG_E2E.webOrigin}${path}`;

test.describe('storefront-catalog: Catalog SEO', () => {
  test('Catalog metadata', async ({ page }) => {
    for (const [url, title] of [
      ['/shop', 'Shop · InThisEconomy'],
      ['/shop?page=2', 'Shop · Page 2 · InThisEconomy'],
    ] as const) {
      const meta = await head(page, url);
      expect(meta.title).toBe(title);
      expect(meta.description).toBeTruthy();
      expect(meta.canonical).toBe(abs(url));
      expect(meta.robots ?? '').not.toMatch(/noindex/);
    }
  });

  test('Category view is indexable', async ({ page }) => {
    const meta = await head(page, '/shop?category=outerwear');
    expect(meta.title).toBe('Outerwear · Shop · InThisEconomy');
    expect(meta.canonical).toBe(abs('/shop?category=outerwear'));
    expect(meta.robots ?? '').not.toMatch(/noindex/);
  });

  test('Filter combinations are not indexed', async ({ page }) => {
    for (const [url, canonical] of [
      ['/shop?size=M', '/shop'],
      ['/shop?sort=price-asc', '/shop'],
      ['/shop?category=outerwear&color=black', '/shop?category=outerwear'],
    ] as const) {
      const meta = await head(page, url);
      expect(meta.robots, url).toBe('noindex, follow');
      expect(meta.canonical, url).toBe(abs(canonical));
    }
  });

  test('Search and placeholder pages are not indexed', async ({ page }) => {
    for (const url of ['/search?q=hoodie', '/products/overdraft-hoodie']) {
      expect((await head(page, url)).robots, url).toMatch(/noindex/);
    }
  });
});
