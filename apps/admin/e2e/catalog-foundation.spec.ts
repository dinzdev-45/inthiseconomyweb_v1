import { expect, test, type Page } from '@playwright/test';

import { catalogApi, signInAsCatalogStaff, signInAsOwner, unique } from './support/catalog.ts';

const CATALOG_PAGES = [
  ['Products', '/catalog/products'],
  ['Categories', '/catalog/categories'],
  ['Sizes', '/catalog/sizes'],
  ['Colors', '/catalog/colors'],
] as const;

async function expectCatalogRoutes(page: Page) {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const [label, href] of CATALOG_PAGES) {
    await expect(nav.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href);
  }
  for (const [label, href] of CATALOG_PAGES) {
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
  }
  await page.goto('/catalog/products/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New product' })).toBeVisible();
}

test.describe('catalog foundation', () => {
  test('catalog routes render for a signed-in Owner', async ({ page }) => {
    await signInAsOwner(page);
    await expectCatalogRoutes(page);
  });

  test('catalog routes render for a signed-in ADMIN', async ({ page }) => {
    await signInAsCatalogStaff(page);
    await expectCatalogRoutes(page);
  });

  test('catalog routes require a session', async ({ page }) => {
    await page.goto('/catalog/products');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('unknown product id shows "Product not found"', async ({ page }) => {
    await signInAsCatalogStaff(page);
    for (const id of ['0190a000-0000-7000-8000-000000000000', 'not-a-product-id']) {
      await page.goto(`/catalog/products/${id}`);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Product not found' }),
      ).toBeVisible();
    }
  });

  test('a product created through the E2E helpers opens on its page', async ({ page }) => {
    await signInAsCatalogStaff(page);
    const api = catalogApi(page);
    const category = await api.createCategory();
    const product = await api.createProduct(category.id, { name: unique('Helper Hoodie') });
    await page.goto(`/catalog/products/${product.id}`);
    await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
    await expect(page.getByTestId('product-status')).toHaveText('Draft');
  });
});
