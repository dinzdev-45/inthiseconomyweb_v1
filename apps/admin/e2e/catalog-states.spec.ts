import { ProductDetail } from '@ite/contracts';
import { expect, test, type Page } from '@playwright/test';

import {
  catalogApi,
  createProductWithVariant,
  signInAsCatalogStaff,
  unique,
} from './support/catalog.ts';

const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const problemResponse = (status: number, code: string, detail: string, requestId: string) => ({
  status,
  contentType: 'application/problem+json',
  body: JSON.stringify({ type: 'about:blank', title: 'Error', status, detail, requestId, code }),
});

test.beforeEach(async ({ page }) => {
  await signInAsCatalogStaff(page);
});

test.describe('admin-catalog-ui: API error rendering', () => {
  test('Field errors from the API', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Field Errors'));
    await page.goto('/catalog/products/new');
    const form = page.getByRole('form', { name: 'New product' });
    await form.getByLabel('Name', { exact: true }).fill(unique('Field Error Tee'));
    await form.getByLabel('Slug (optional; generated from the name)').fill('Not Kebab');
    await form.getByLabel('Category').selectOption({ label: category.name });
    await form.getByLabel('Base price (IDR)').fill('100000');
    await form.getByRole('button', { name: 'Create product' }).click();

    const summary = form.getByRole('alert');
    await expect(summary).toContainText('Some fields need attention.');
    await expect(summary).toContainText(
      'Slug: Must be lowercase letters and digits separated by single hyphens',
    );
    await expect(summary).toBeFocused();
    // The same message next to the slug field.
    const slugField = form.locator('label', {
      has: page.getByLabel('Slug (optional; generated from the name)'),
    });
    await expect(slugField).toContainText(
      'Must be lowercase letters and digits separated by single hyphens',
    );
    await expect(page).toHaveURL(/\/catalog\/products\/new$/);
  });

  test('Business rule error keeps input', async ({ page }) => {
    const taken = await catalogApi(page).createCategory(unique('Taken'));
    await page.goto('/catalog/categories');
    const form = page.getByRole('form', { name: 'New category' });
    await form.getByLabel('Name', { exact: true }).fill('My New Category');
    await form.getByLabel('Slug (optional; generated from the name)').fill(taken.slug);
    await form.getByRole('button', { name: 'Create category' }).click();

    await expect(form.getByRole('alert')).toContainText('Another category already uses this slug.');
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue('My New Category');
    await expect(form.getByLabel('Slug (optional; generated from the name)')).toHaveValue(
      taken.slug,
    );
  });

  test('Unexpected server error', async ({ page }) => {
    await page.route('**/api/v1/admin/categories', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill(
            problemResponse(500, 'INTERNAL_ERROR', 'Internal failure in module X', 'req-e2e-500'),
          )
        : route.continue(),
    );
    const name = unique('Never Saved');
    await page.goto('/catalog/categories');
    const form = page.getByRole('form', { name: 'New category' });
    await form.getByLabel('Name', { exact: true }).fill(name);
    await form.getByRole('button', { name: 'Create category' }).click();

    const alert = form.getByRole('alert');
    await expect(alert).toContainText('Something went wrong. Please try again.');
    await expect(alert).toContainText('Reference: req-e2e-500');
    // The server's own detail is not shown for unexpected failures.
    await expect(alert).not.toContainText('Internal failure');
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test('Session expired during a catalog action', async ({ page }) => {
    await page.goto('/catalog/sizes');
    const form = page.getByRole('form', { name: 'New size' });
    await form.getByLabel('Code', { exact: true }).fill('EXP1');
    await form.getByLabel('Label', { exact: true }).fill('Expired');
    await form.getByLabel('Sort order', { exact: true }).fill('1');
    await page.context().clearCookies();
    await form.getByRole('button', { name: 'Create size' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('admin-catalog-ui: Permission-aware catalog controls', () => {
  test('API refusal is authoritative', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Refused'));
    const product = await catalogApi(page).createProduct(category.id, {
      name: unique('Refused Tee'),
    });
    await page.route(`**/api/v1/admin/products/${product.id}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill(
            problemResponse(403, 'FORBIDDEN', 'You do not have permission to do this.', 'req-403'),
          )
        : route.continue(),
    );

    await page.goto(`/catalog/products/${product.id}`);
    const details = page.getByRole('form', { name: 'Product details' });
    await details.getByLabel('Name', { exact: true }).fill('Should Not Save');
    await details.getByRole('button', { name: 'Save details' }).click();

    await expect(details.getByRole('alert')).toHaveText('You do not have permission to do this.');
    await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
    await expect(details.getByRole('status')).toHaveText('');
    const stored = ProductDetail.parse(
      await (await page.request.get(`/api/v1/admin/products/${product.id}`)).json(),
    );
    expect(stored.name).toBe(product.name);
  });
});

test.describe('admin-catalog-ui: Progress, empty, and success states', () => {
  test('Action in progress', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('In Progress'));
    const { product } = await createProductWithVariant(page, category.id);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let requests = 0;
    await page.route(`**/api/v1/admin/products/${product.id}/activate`, async (route) => {
      requests++;
      await gate;
      await route.continue();
    });

    await page.goto(`/catalog/products/${product.id}`);
    const activate = page
      .getByRole('region', { name: 'Lifecycle' })
      .getByRole('button', { name: `Activate ${product.name}`, exact: true });
    await activate.click();
    await expect(activate).toBeDisabled();
    await expect(activate).toHaveAttribute('aria-busy', 'true');
    // Nothing is shown as done before the API answers.
    await expect(page.getByTestId('product-status')).toHaveText('Draft');
    await activate.click({ force: true }).catch(() => undefined);
    expect(requests).toBe(1);

    release();
    await expect(page.getByTestId('product-status')).toHaveText('Active');
    expect(requests).toBe(1);
  });

  test('Success message after a change', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Announce'));
    await page.goto('/catalog/categories');
    const status = page.getByRole('status');
    await expect(status).toHaveAttribute('aria-live', 'polite');

    await page.getByRole('button', { name: `Edit ${category.name}`, exact: true }).click();
    await page.getByLabel(`Name for ${category.name}`).fill(`${category.name} Saved`);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(status).toHaveText(`Category “${category.name} Saved” saved.`);
    // The list shows the API's data.
    await expect(page.getByTestId(`category-row-${category.slug}`)).toContainText(
      `${category.name} Saved`,
    );

    // A newer change replaces the message, whichever form it came from.
    const second = unique('Announce Two');
    const form = page.getByRole('form', { name: 'New category' });
    await form.getByLabel('Name', { exact: true }).fill(second);
    await form.getByRole('button', { name: 'Create category' }).click();
    await expect(status).toHaveText(new RegExp(`^Category “${second}” created with slug`));
    await page.getByRole('button', { name: `Archive ${category.name} Saved`, exact: true }).click();
    await page.getByRole('button', { name: 'Confirm archive' }).click();
    await expect(status).toHaveText(`Category “${category.name} Saved” archived.`);
    await expect(alerts(page)).toHaveCount(0);
  });
});
