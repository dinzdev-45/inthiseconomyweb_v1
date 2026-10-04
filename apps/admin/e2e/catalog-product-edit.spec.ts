import { ProductDetail } from '@ite/contracts';
import { expect, test, type Page } from '@playwright/test';

import {
  catalogApi,
  createProductWithVariant,
  signInAsCatalogStaff,
  unique,
} from './support/catalog.ts';

const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const lifecycle = (page: Page) => page.getByRole('region', { name: 'Lifecycle' });
const statusText = (page: Page) => page.getByTestId('product-status');
const details = (page: Page) => page.getByRole('form', { name: 'Product details' });
const fetchProduct = async (page: Page, id: string) =>
  ProductDetail.parse(await (await page.request.get(`/api/v1/admin/products/${id}`)).json());

test.beforeEach(async ({ page }) => {
  await signInAsCatalogStaff(page);
});

test.describe('admin-products: Product creation', () => {
  test('Create a draft product from the admin', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Jackets'));
    await page.goto('/catalog/products');
    await page.getByRole('link', { name: 'New product' }).click();

    const form = page.getByRole('form', { name: 'New product' });
    await form.getByLabel('Name', { exact: true }).fill('Rent Due Coach Jacket');
    await form.getByLabel('Category').selectOption({ label: category.name });
    await form.getByLabel('Base price (IDR)').fill('899000');
    await form.getByRole('button', { name: 'Create product' }).click();

    await expect(page).toHaveURL(/\/catalog\/products\/[0-9a-f-]{36}\?created=1$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Rent Due Coach Jacket' }),
    ).toBeVisible();
    await expect(statusText(page)).toHaveText('Draft');
    await expect(page.getByText('rent-due-coach-jacket').first()).toBeVisible();
    await expect(page.getByText('Rp 899.000').first()).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Product created as a draft.' }),
    ).toBeVisible();
  });

  test('Create a product with a taken slug in the admin', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Taken Slug'));
    const existing = await api.createProduct(category.id);

    await page.goto('/catalog/products/new');
    const form = page.getByRole('form', { name: 'New product' });
    await form.getByLabel('Name', { exact: true }).fill('Another Product');
    await form.getByLabel('Slug (optional; generated from the name)').fill(existing.slug);
    await form.getByLabel('Category').selectOption({ label: category.name });
    await form.getByLabel('Base price (IDR)').fill('150000');
    await form.getByRole('button', { name: 'Create product' }).click();

    await expect(form.getByText('Another product already uses this slug.').first()).toBeVisible();
    await expect(alerts(page)).toBeFocused();
    await expect(page).toHaveURL(/\/catalog\/products\/new$/);
    // The entered values remain.
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue('Another Product');
    await expect(form.getByLabel('Base price (IDR)')).toHaveValue('150000');
  });
});

test.describe('admin-catalog-ui: Money display and entry', () => {
  test('Prices shown in the store currency', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Priced'));
    const product = await api.createProduct(category.id, {
      basePrice: { amount: 89_900_000, currency: 'IDR' },
    });

    await page.goto(`/catalog/products?categoryId=${category.id}`);
    await expect(page.getByTestId(`product-row-${product.slug}`)).toContainText('Rp 899.000');
    await page.goto(`/catalog/products/${product.id}`);
    await expect(page.getByText('Rp 899.000').first()).toBeVisible();
    await expect(details(page).getByLabel('Base price (IDR)')).toHaveValue('899000');
    await page.goto('/catalog/products/new');
    await expect(page.getByLabel('Base price (IDR)')).toBeVisible();
  });

  test('Price entry in major units', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Major Units'));
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/v1/admin/products')) {
        posts.push(request.postData() ?? '');
      }
    });

    await page.goto('/catalog/products/new');
    const form = page.getByRole('form', { name: 'New product' });
    await form.getByLabel('Name', { exact: true }).fill(unique('Major Units Tee'));
    await form.getByLabel('Category').selectOption({ label: category.name });

    // Rejected in the form, without a request.
    for (const input of ['12.345', 'abc']) {
      await form.getByLabel('Base price (IDR)').fill(input);
      await form.getByRole('button', { name: 'Create product' }).click();
      await expect(alerts(page)).toContainText('Base price');
    }
    await expect(form.getByText('Use at most 2 decimal places for IDR.')).toHaveCount(0);
    expect(posts).toEqual([]);

    await form.getByLabel('Base price (IDR)').fill('899000');
    await form.getByRole('button', { name: 'Create product' }).click();
    await expect(page).toHaveURL(/created=1/);
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0]!).basePrice).toEqual({ amount: 89_900_000, currency: 'IDR' });
  });
});

test.describe('admin-products: Product details editing', () => {
  test('Edit product details from the admin', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Editing'));
    const product = await api.createProduct(category.id, { name: unique('Draft Name') });

    await page.goto(`/catalog/products/${product.id}`);
    const before = await page.getByTestId('product-updated-at').textContent();
    await page.waitForTimeout(1_100); // timestamps are shown to the second
    await details(page).getByLabel('Name', { exact: true }).fill(`${product.name} Renamed`);
    await details(page).getByLabel('Description (optional)').fill('Brushed fleece, oversized fit.');
    await details(page).getByRole('button', { name: 'Save details' }).click();

    await expect(details(page).getByRole('status')).toHaveText('Product details saved.');
    await expect(
      page.getByRole('heading', { level: 1, name: `${product.name} Renamed` }),
    ).toBeVisible();
    await expect(page.getByTestId('product-updated-at')).not.toHaveText(before!);
    await page.reload();
    await expect(details(page).getByLabel('Description (optional)')).toHaveValue(
      'Brushed fleece, oversized fit.',
    );

    // Only the changed field is sent.
    const sent = page.waitForRequest((r) => r.method() === 'PATCH');
    await details(page).getByLabel('Base price (IDR)').fill('799000');
    await details(page).getByRole('button', { name: 'Save details' }).click();
    expect(JSON.parse((await sent).postData()!)).toEqual({
      basePrice: { amount: 79_900_000, currency: 'IDR' },
    });
  });

  test('Slug read-only after activation in the admin', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Locked'));
    const { product } = await createProductWithVariant(page, category.id, { activate: true });
    await catalogApi(page).lifecycle(product.id, 'deactivate');

    await page.goto(`/catalog/products/${product.id}`);
    await expect(statusText(page)).toHaveText('Inactive');
    await expect(details(page).locator('[name="slug"]')).toHaveCount(0);
    await expect(page.getByTestId('slug-locked')).toContainText(product.slug);
    await expect(page.getByTestId('slug-locked')).toContainText('Locked');

    // Other details stay editable.
    await details(page).getByLabel('Name', { exact: true }).fill(`${product.name} v2`);
    await details(page).getByRole('button', { name: 'Save details' }).click();
    await expect(page.getByRole('heading', { level: 1, name: `${product.name} v2` })).toBeVisible();
    expect((await fetchProduct(page, product.id)).slug).toBe(product.slug);
  });

  test('Archived product is read-only in the admin', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Archived View'));
    const { product, variant } = await createProductWithVariant(page, category.id);
    await catalogApi(page).lifecycle(product.id, 'archive');

    await page.goto(`/catalog/products/${product.id}`);
    await expect(statusText(page)).toHaveText('Archived');
    await expect(page.getByText('This product is archived and read-only.')).toBeVisible();
    await expect(page.getByRole('form', { name: 'Product details' })).toHaveCount(0);
    await expect(page.locator('main').getByRole('textbox')).toHaveCount(0);
    await expect(page.getByTestId(`variant-row-${variant.sku}`)).toContainText('5');
    await expect(page.getByRole('region', { name: 'Images' }).getByText('Primary')).toBeVisible();
    await expect(
      lifecycle(page).getByRole('button', { name: `Restore ${product.name}`, exact: true }),
    ).toBeVisible();
    await expect(lifecycle(page).getByRole('button')).toHaveCount(1);
  });
});

test.describe('admin-products: Product lifecycle actions and readiness', () => {
  test('Activate a ready product from the admin', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Ready'));
    const { product } = await createProductWithVariant(page, category.id);

    await page.goto(`/catalog/products/${product.id}`);
    await expect(page.getByTestId('product-activated-at')).toHaveText('Never');
    await lifecycle(page)
      .getByRole('button', { name: `Activate ${product.name}`, exact: true })
      .click();
    await expect(statusText(page)).toHaveText('Active');
    await expect(page.getByTestId('product-activated-at')).not.toHaveText('Never');
    await expect(lifecycle(page).getByRole('status')).toHaveText(`“${product.name}” activated.`);
  });

  test('Activation blocked shows every reason', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Blocked'));
    const product = await catalogApi(page).createProduct(category.id);

    await page.goto(`/catalog/products/${product.id}`);
    await lifecycle(page)
      .getByRole('button', { name: `Activate ${product.name}`, exact: true })
      .click();
    const alert = lifecycle(page).getByRole('alert');
    await expect(alert).toContainText('Could not activate the product.');
    await expect(alert.getByRole('listitem')).toHaveText([
      'It has no active variant',
      'It has no images',
    ]);
    await expect(alert).toBeFocused();
    await expect(alert.getByRole('link', { name: 'variants' })).toHaveAttribute(
      'href',
      '#variants',
    );
    await expect(alert.getByRole('link', { name: 'images' })).toHaveAttribute('href', '#images');
    await expect(statusText(page)).toHaveText('Draft');
    await expect(page).toHaveURL(new RegExp(`/catalog/products/${product.id}$`));
  });

  test('Deactivate, archive, and restore a product from the admin', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Cycle'));
    const { product } = await createProductWithVariant(page, category.id, { activate: true });
    const button = (name: string) =>
      lifecycle(page).getByRole('button', { name: `${name} ${product.name}`, exact: true });

    await page.goto(`/catalog/products/${product.id}`);
    await button('Deactivate').click();
    await page.getByRole('button', { name: 'Confirm deactivate' }).click();
    await expect(statusText(page)).toHaveText('Inactive');

    await button('Archive').click();
    await page.getByRole('button', { name: 'Confirm archive' }).click();
    await expect(statusText(page)).toHaveText('Archived');
    await expect(page.getByText('This product is archived and read-only.')).toBeVisible();

    await button('Restore').click();
    await expect(statusText(page)).toHaveText('Inactive');
    await expect(details(page)).toBeVisible();
  });
});

test.describe('admin-catalog-ui: Confirmation for disruptive actions', () => {
  test('Confirm before a disruptive action', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Confirm'));
    const product = await api.createProduct(category.id);
    const archive = lifecycle(page).getByRole('button', {
      name: `Archive ${product.name}`,
      exact: true,
    });

    await page.goto(`/catalog/products/${product.id}`);
    await archive.click();
    await expect(
      lifecycle(page).getByRole('group', { name: `Archive “${product.name}”?` }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm archive' })).toBeFocused();
    // Nothing is sent until confirmed: Escape backs out.
    await page.keyboard.press('Escape');
    await expect(archive).toBeFocused();
    expect((await fetchProduct(page, product.id)).status).toBe('DRAFT');

    await archive.click();
    await page.getByRole('button', { name: 'Confirm archive' }).click();
    await expect(statusText(page)).toHaveText('Archived');
  });
});
