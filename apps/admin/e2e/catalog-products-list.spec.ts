import { expect, test, type Page } from '@playwright/test';

import {
  catalogApi,
  createProductWithVariant,
  signInAsCatalogStaff,
  unique,
  uniqueCode,
} from './support/catalog.ts';

/** A 1×1 PNG, served for thumbnail URLs the admin cannot host itself. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const rows = (page: Page) => page.locator('tbody tr');
const row = (page: Page, slug: string) => page.getByTestId(`product-row-${slug}`);
const slugsOnPage = (page: Page) =>
  rows(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid')!.replace('product-row-', '')),
  );

test.beforeEach(async ({ page }) => {
  await page.route('**/images/e2e/thumb.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
  );
  await signInAsCatalogStaff(page);
});

test.describe('admin-products: Product list', () => {
  test('Product list columns', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Columns'));
    const stocked = await api.createProduct(category.id, { name: unique('Columns Hoodie') });
    const [m, l, xl, color] = [
      await api.createSize(uniqueCode()),
      await api.createSize(uniqueCode()),
      await api.createSize(uniqueCode()),
      await api.createColor(),
    ];
    await api.createVariant(stocked.id, {
      sizeId: m.id,
      colorId: color.id,
      sku: `C-${uniqueCode()}`,
      stockQuantity: 5,
    });
    await api.createVariant(stocked.id, {
      sizeId: l.id,
      colorId: color.id,
      sku: `C-${uniqueCode()}`,
      stockQuantity: 0,
    });
    const inactive = await api.createVariant(stocked.id, {
      sizeId: xl.id,
      colorId: color.id,
      sku: `C-${uniqueCode()}`,
      stockQuantity: 9,
    });
    await api.variantStatus(stocked.id, inactive.id, 'deactivate');
    await api.addImage(stocked.id, { url: '/images/e2e/thumb.png', alt: 'Hoodie, front view' });
    const bare = await api.createProduct(category.id, { name: unique('Columns Bare') });
    const broken = await api.createProduct(category.id, { name: unique('Columns Broken Image') });
    await api.addImage(broken.id, { url: '/images/e2e/missing.png', alt: 'Missing file' });

    await page.goto(`/catalog/products?categoryId=${category.id}`);
    const stockedRow = row(page, stocked.slug);
    await expect(stockedRow.getByRole('img', { name: 'Hoodie, front view' })).toBeVisible();
    await expect(stockedRow.getByRole('link', { name: stocked.name })).toHaveAttribute(
      'href',
      `/catalog/products/${stocked.id}`,
    );
    for (const text of [
      stocked.slug,
      category.name,
      'Draft',
      '899.000',
      '5 units in stock',
      '2 active variants',
      '1 out of stock',
    ]) {
      await expect(stockedRow).toContainText(text);
    }
    await expect(stockedRow.locator('td').nth(5)).toHaveText('3');

    // No image and no variants: a placeholder and plain words, never a broken image.
    await expect(row(page, bare.slug).getByTestId('thumbnail-placeholder')).toBeVisible();
    await expect(row(page, bare.slug)).toContainText('No active variants');
    await expect(row(page, bare.slug).locator('td').nth(5)).toHaveText('0');
    // An image URL that fails to load falls back to the placeholder.
    await expect(row(page, broken.slug).getByTestId('thumbnail-placeholder')).toBeVisible();

    // The name opens the product page.
    await stockedRow.getByRole('link', { name: stocked.name }).click();
    await expect(page.getByRole('heading', { level: 1, name: stocked.name })).toBeVisible();
  });

  test('Search and filter products in the admin', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Search'));
    const other = await api.createCategory(unique('Elsewhere'));
    const draftHoodie = await api.createProduct(category.id, { name: unique('Search Hoodie') });
    const { product: activeHoodie } = await createProductWithVariant(page, category.id, {
      activate: true,
      fields: { name: unique('Active Hoodie') },
    });
    const tee = await api.createProduct(category.id, { name: unique('Search Tee') });
    const elsewhere = await api.createProduct(other.id, { name: unique('Elsewhere Hoodie') });

    await page.goto('/catalog/products');
    const search = page.getByRole('search', { name: 'Search and filter products' });
    await search.getByLabel('Search products').fill('hoodie');
    await search.getByLabel('Category').selectOption({ label: category.name });
    await search.getByLabel('Status').selectOption({ label: 'Draft' });
    await search.getByRole('button', { name: 'Apply' }).click();

    await expect(page).toHaveURL(/q=hoodie/);
    await expect(page).toHaveURL(/status=DRAFT/);
    await expect(page).toHaveURL(new RegExp(`categoryId=${category.id}`));
    await expect.poll(() => slugsOnPage(page)).toEqual([draftHoodie.slug]);
    await expect(page.getByTestId('active-filters')).toContainText(
      `Showing draft products in ${category.name} matching “hoodie”.`,
    );

    await page.reload();
    await expect.poll(() => slugsOnPage(page)).toEqual([draftHoodie.slug]);
    await expect(search.getByLabel('Search products')).toHaveValue('hoodie');
    await expect(search.getByLabel('Status')).toHaveValue('DRAFT');

    // Clearing the search keeps the filters; clearing all filters drops them.
    await page.getByRole('link', { name: 'Clear search' }).click();
    await expect
      .poll(() => slugsOnPage(page))
      .toEqual(expect.arrayContaining([draftHoodie.slug, tee.slug]));
    expect(await slugsOnPage(page)).not.toContain(activeHoodie.slug);
    await page.getByRole('link', { name: 'Clear all filters' }).click();
    await expect(page).toHaveURL(/\/catalog\/products$/);
    expect(elsewhere.slug).toBeTruthy();
  });

  test('Archived products only through the status filter', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Archive Filter'));
    const archived = await api.createProduct(category.id, { name: unique('Old Drop') });
    await api.lifecycle(archived.id, 'archive');
    const draft = await api.createProduct(category.id, { name: unique('Current Drop') });

    await page.goto(`/catalog/products?categoryId=${category.id}`);
    await expect.poll(() => slugsOnPage(page)).toEqual([draft.slug]);

    const search = page.getByRole('search', { name: 'Search and filter products' });
    await search.getByLabel('Status').selectOption({ label: 'Archived' });
    await search.getByRole('button', { name: 'Apply' }).click();
    await expect.poll(() => slugsOnPage(page)).toEqual([archived.slug]);
    await expect(row(page, archived.slug)).toContainText('Archived');
  });

  test('Paginate the product list in the admin', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Paged'));
    const created: string[] = [];
    for (let n = 0; n < 22; n++) {
      created.push((await api.createProduct(category.id, { name: unique(`Paged ${n}`) })).slug);
    }

    await page.goto(`/catalog/products?categoryId=${category.id}`);
    await expect(rows(page)).toHaveCount(20);
    const firstPage = await slugsOnPage(page);
    await expect(page.getByRole('link', { name: 'First page' })).toHaveCount(0);

    await page.getByRole('link', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/cursor=/);
    await expect(page).toHaveURL(new RegExp(`categoryId=${category.id}`));
    await expect(rows(page)).toHaveCount(2);
    const secondPage = await slugsOnPage(page);
    expect(new Set([...firstPage, ...secondPage])).toEqual(new Set(created));
    await expect(page.getByRole('link', { name: 'Next page' })).toHaveCount(0);

    await page.getByRole('link', { name: 'First page' }).click();
    await expect(page).not.toHaveURL(/cursor=/);
    await expect.poll(() => slugsOnPage(page)).toEqual(firstPage);
  });

  test('Invalid list cursor in the URL', async ({ page }) => {
    await page.goto('/catalog/products?status=DRAFT&cursor=eyJ2IjoxfQ.forged-signature');
    await expect(alerts(page)).toContainText('This page link is no longer valid.');
    await expect(page.getByRole('link', { name: 'Go to the first page' })).toHaveAttribute(
      'href',
      '/catalog/products?status=DRAFT',
    );
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
    await page.getByRole('link', { name: 'Go to the first page' }).click();
    await expect(page).toHaveURL(/\/catalog\/products\?status=DRAFT$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
  });

  test('Empty catalog list (no products match the search)', async ({ page }) => {
    await page.goto(`/catalog/products?q=${encodeURIComponent(unique('nothing like this'))}`);
    await expect(page.getByText('No products match this search and these filters.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create the first product' })).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'clear all filters', exact: true }),
    ).toHaveAttribute('href', '/catalog/products');
  });
});

test.describe('admin-products: Product lifecycle actions and readiness', () => {
  test('Lifecycle actions in the product list', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Row Actions'));
    const { product: draft } = await createProductWithVariant(page, category.id, {
      fields: { name: unique('Row Draft') },
    });
    const { product: active } = await createProductWithVariant(page, category.id, {
      activate: true,
      fields: { name: unique('Row Active') },
    });

    await page.goto(`/catalog/products?categoryId=${category.id}`);
    const draftRow = row(page, draft.slug);
    const activeRow = row(page, active.slug);
    await expect(
      draftRow.getByRole('button', { name: `Activate ${draft.name}`, exact: true }),
    ).toBeVisible();
    await expect(
      draftRow.getByRole('button', { name: `Archive ${draft.name}`, exact: true }),
    ).toBeVisible();
    await expect(
      draftRow.getByRole('button', { name: `Deactivate ${draft.name}`, exact: true }),
    ).toHaveCount(0);
    await expect(
      activeRow.getByRole('button', { name: `Deactivate ${active.name}`, exact: true }),
    ).toBeVisible();
    await expect(
      activeRow.getByRole('button', { name: `Activate ${active.name}`, exact: true }),
    ).toHaveCount(0);
    await expect(
      activeRow.getByRole('button', { name: `Archive ${active.name}`, exact: true }),
    ).toHaveCount(0);

    await draftRow.getByRole('button', { name: `Activate ${draft.name}`, exact: true }).click();
    await expect(draftRow).toContainText('Active');
    await expect(page.getByRole('status')).toHaveText(`“${draft.name}” activated.`);

    // Deactivation asks first, then updates the row after the API confirms.
    await activeRow.getByRole('button', { name: `Deactivate ${active.name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Confirm deactivate' }).click();
    await expect(activeRow).toContainText('Inactive');
  });

  test('a refused row action shows the API reason for that product', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Not Ready'));
    const product = await api.createProduct(category.id, { name: unique('Not Ready Tee') });

    await page.goto(`/catalog/products?categoryId=${category.id}`);
    await row(page, product.slug)
      .getByRole('button', { name: `Activate ${product.name}`, exact: true })
      .click();
    await expect(alerts(page)).toContainText(`Could not activate “${product.name}”.`);
    await expect(alerts(page)).toContainText(
      'The product is not ready to activate: it has no active variant; it has no images.',
    );
    await expect(row(page, product.slug)).toContainText('Draft');
  });
});
