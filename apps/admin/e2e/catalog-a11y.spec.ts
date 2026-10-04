import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  catalogApi,
  createProductWithVariant,
  signInAsCatalogStaff,
  unique,
} from './support/catalog.ts';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Serious or critical WCAG 2.2 A/AA violations on the current page (same rules as the storefront). */
async function violations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    );
}

test.beforeEach(async ({ page }) => {
  await page.route('**/images/e2e/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
  );
  await signInAsCatalogStaff(page);
});

test.describe('admin-catalog-ui: Catalog accessibility', () => {
  test('Catalog pages pass an automated accessibility scan', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Axe'));
    const { product } = await createProductWithVariant(page, category.id, {
      fields: { name: unique('Axe Hoodie') },
    });
    await api.addImage(product.id, { url: '/images/e2e/second.png', alt: 'Back view' });
    await api.createColor(unique('Axe Swatch'), '#B1641E');

    const found: string[] = [];
    for (const [label, path] of [
      ['product list', `/catalog/products?categoryId=${category.id}`],
      ['product list (all)', '/catalog/products'],
      ['new product', '/catalog/products/new'],
      ['product page', `/catalog/products/${product.id}`],
      ['categories', '/catalog/categories'],
      ['sizes', '/catalog/sizes'],
      ['colors', '/catalog/colors'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      found.push(...(await violations(page, label)));
    }
    expect(found).toEqual([]);
  });

  test('Catalog pages pass an automated accessibility scan (interactive states)', async ({
    page,
  }) => {
    const category = await catalogApi(page).createCategory(unique('Axe States'));
    const { product, variant } = await createProductWithVariant(page, category.id, {
      fields: { name: unique('Axe States Tee') },
    });
    const found: string[] = [];

    // A validation error on the create form.
    await page.goto('/catalog/products/new');
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByRole('form', { name: 'New product' }).getByRole('alert')).toBeVisible();
    found.push(...(await violations(page, 'create validation error')));

    // Open confirmation, variant edit form, image edit form, and a stock error on the product page.
    await page.goto(`/catalog/products/${product.id}`);
    await page
      .getByRole('region', { name: 'Lifecycle' })
      .getByRole('button', { name: `Archive ${product.name}`, exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Confirm archive' })).toBeVisible();
    found.push(...(await violations(page, 'archive confirmation')));
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: `Edit variant ${variant.sku}`, exact: true }).click();
    await page.getByRole('button', { name: 'Edit image 1', exact: true }).click();
    await page
      .getByTestId(`variant-row-${variant.sku}`)
      .getByLabel(`Stock change for ${variant.sku}`)
      .fill('-99');
    await page
      .getByTestId(`variant-row-${variant.sku}`)
      .getByRole('button', { name: 'Apply' })
      .click();
    await expect(page.getByTestId(`variant-row-${variant.sku}`).getByRole('alert')).toBeVisible();
    found.push(...(await violations(page, 'variant, image, and stock editors')));

    // Inline edit and an API conflict on a reference-data page.
    await page.goto('/catalog/categories');
    await page.getByRole('button', { name: `Edit ${category.name}`, exact: true }).click();
    found.push(...(await violations(page, 'category inline edit')));

    expect(found).toEqual([]);
  });
});
