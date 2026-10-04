import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  catalogApi,
  createProductWithVariant,
  signInAsCatalogStaff,
  unique,
  uniqueCode,
} from './support/catalog.ts';

/** App alerts (Next's route announcer also has role="alert"). */
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const status = (page: Page) => page.getByRole('status');

test.beforeEach(async ({ page }) => {
  await signInAsCatalogStaff(page);
});

test.describe('admin-catalog-reference-data: Categories page', () => {
  const row = (page: Page, slug: string) => page.getByTestId(`category-row-${slug}`);

  test('List categories with a status filter', async ({ page }) => {
    const api = catalogApi(page);
    const active = await api.createCategory(unique('Filter Active'));
    const archived = await api.createCategory(unique('Filter Archived'));
    await api.archiveCategory(archived.id);

    await page.goto('/catalog/categories');
    await expect(row(page, active.slug)).toBeVisible();
    await expect(row(page, archived.slug)).toBeVisible();

    await page.getByRole('link', { name: 'Archived', exact: true }).click();
    await expect(page).toHaveURL(/status=ARCHIVED/);
    await expect(row(page, archived.slug)).toBeVisible();
    await expect(row(page, active.slug)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Archived', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.getByRole('link', { name: 'All', exact: true }).click();
    await expect(row(page, active.slug)).toBeVisible();
    await expect(row(page, archived.slug)).toBeVisible();
  });

  test('Create a category from the admin', async ({ page }) => {
    await page.goto('/catalog/categories');
    const form = page.getByRole('form', { name: 'New category' });
    await form.getByLabel('Name', { exact: true }).fill('Outerwear');
    await form.getByRole('button', { name: 'Create category' }).click();

    await expect(status(page)).toHaveText('Category “Outerwear” created with slug outerwear.');
    await expect(row(page, 'outerwear')).toContainText('Outerwear');
    await expect(row(page, 'outerwear')).toContainText('Active');
    await expect(form.getByLabel('Name', { exact: true })).toHaveValue('');
  });

  test('Edit a category from the admin', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Editable'));
    const other = await api.createCategory(unique('Taken'));
    const newSlug = `renamed-${category.slug}`;

    await page.goto('/catalog/categories');
    await page.getByRole('button', { name: `Edit ${category.name}` }).click();
    await page.getByLabel(`Name for ${category.name}`).fill(`${category.name} Renamed`);
    await page.getByLabel(`Slug for ${category.name}`).fill(newSlug);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(row(page, newSlug)).toContainText(`${category.name} Renamed`);

    // A slug used by another category: the API's SLUG_EXISTS message at the slug field.
    await page.getByRole('button', { name: `Edit ${category.name} Renamed` }).click();
    const slugInput = page.getByLabel(`Slug for ${category.name} Renamed`);
    await slugInput.fill(other.slug);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(slugInput).toHaveAttribute('aria-invalid', 'true');
    await expect(row(page, newSlug)).toContainText('Another category already uses this slug.');
    await expect(alerts(page)).toContainText('Another category already uses this slug.');
    await expect(alerts(page)).toBeFocused();
  });

  test('Archive and restore a category from the admin', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Seasonal'));
    await page.goto('/catalog/categories');

    await page.getByRole('button', { name: `Archive ${category.name}` }).click();
    await expect(page.getByRole('button', { name: 'Confirm archive' })).toBeFocused();
    await page.getByRole('button', { name: 'Confirm archive' }).click();
    await expect(row(page, category.slug)).toContainText('Archived');
    await expect(status(page)).toHaveText(`Category “${category.name}” archived.`);

    await page.getByRole('button', { name: `Restore ${category.name}` }).click();
    await expect(row(page, category.slug)).toContainText('Active');
    await expect(status(page)).toHaveText(`Category “${category.name}” restored.`);
  });

  test('Archiving a category in use shows the reason', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('In Use'));
    await createProductWithVariant(page, category.id, { activate: true });

    await page.goto('/catalog/categories');
    await page.getByRole('button', { name: `Archive ${category.name}` }).click();
    await page.getByRole('button', { name: 'Confirm archive' }).click();
    await expect(alerts(page)).toHaveText('Active products still use this category.');
    await expect(row(page, category.slug)).toContainText('Active');
  });
});

test.describe('admin-catalog-reference-data: Sizes page', () => {
  const row = (page: Page, code: string) => page.getByTestId(`size-row-${code}`);
  const indexOf = async (rows: Locator, testId: string) =>
    (await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')))).indexOf(
      testId,
    );

  test('Sizes listed in display order in the admin', async ({ page }) => {
    const api = catalogApi(page);
    // Created out of order on purpose.
    await api.createSize('30/32', 20, 'Waist 30 / Leg 32');
    await api.createSize('28', 10, 'Waist 28');
    await api.createSize('XL', 5, 'Extra Large');

    await page.goto('/catalog/sizes');
    const rows = page.locator('tbody tr');
    const [xl, w28, w3032] = await Promise.all(
      ['size-row-XL', 'size-row-28', 'size-row-30/32'].map((id) => indexOf(rows, id)),
    );
    expect(xl).toBeGreaterThanOrEqual(0);
    expect(xl).toBeLessThan(w28!);
    expect(w28).toBeLessThan(w3032!);
  });

  test('Create and edit a size from the admin', async ({ page }) => {
    await page.goto('/catalog/sizes');
    const form = page.getByRole('form', { name: 'New size' });
    await form.getByLabel('Code', { exact: true }).fill('xs');
    await form.getByLabel('Label', { exact: true }).fill('Extra Small');
    await form.getByLabel('Sort order', { exact: true }).fill('1');
    await form.getByRole('button', { name: 'Create size' }).click();
    await expect(row(page, 'XS')).toContainText('Extra Small');
    await expect(status(page)).toHaveText('Size XS created.');

    await page.getByRole('button', { name: 'Edit size XS' }).click();
    await page.getByLabel('Label for size XS').fill('X-Small');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(row(page, 'XS')).toContainText('X-Small');

    // Creating another "xs": the API's CODE_EXISTS message at the code field.
    await form.getByLabel('Code', { exact: true }).fill('xs');
    await form.getByLabel('Label', { exact: true }).fill('Duplicate');
    await form.getByLabel('Sort order', { exact: true }).fill('2');
    await form.getByRole('button', { name: 'Create size' }).click();
    await expect(form).toContainText('Another size already uses this code.');
    await expect(form.getByRole('alert')).toBeFocused();
    await expect(form.getByLabel('Label', { exact: true })).toHaveValue('Duplicate');
  });

  test('Delete a size from the admin', async ({ page }) => {
    const api = catalogApi(page);
    const unused = await api.createSize(uniqueCode(), 900);
    const category = await api.createCategory();
    const { sizeId } = await createProductWithVariant(page, category.id);
    const used = (await page.request.get('/api/v1/admin/sizes').then((r) => r.json())).data.find(
      (s: { id: string }) => s.id === sizeId,
    );

    await page.goto('/catalog/sizes');
    await page.getByRole('button', { name: `Delete size ${unused.code}` }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(row(page, unused.code)).toHaveCount(0);
    await expect(status(page)).toHaveText(`Size ${unused.code} deleted.`);

    await page.getByRole('button', { name: `Delete size ${used.code}` }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(alerts(page)).toHaveText('Variants still use this size.');
    await expect(row(page, used.code)).toBeVisible();
  });
});

test.describe('admin-catalog-reference-data: Colors page', () => {
  const row = (page: Page, slug: string) => page.getByTestId(`color-row-${slug}`);

  test('Colors shown with swatches', async ({ page }) => {
    const api = catalogApi(page);
    await api.createColor('Washed Black', '#2B2A28');
    await api.createColor('Undyed');

    await page.goto('/catalog/colors');
    const washed = row(page, 'washed-black');
    await expect(washed).toContainText('#2B2A28');
    await expect(washed.getByTestId('swatch')).toHaveCSS('background-color', 'rgb(43, 42, 40)');
    const undyed = row(page, 'undyed');
    await expect(undyed.getByTestId('swatch')).toHaveCount(0);
    await expect(undyed).toContainText('None');
    await expect(undyed).not.toContainText('#');
  });

  test('Create and edit a color from the admin', async ({ page }) => {
    await page.goto('/catalog/colors');
    const form = page.getByRole('form', { name: 'New color' });
    await form.getByLabel('Name', { exact: true }).fill('Dirty Brown');
    await form.getByLabel('Hex (optional)').fill('#b1641e');
    await form.getByRole('button', { name: 'Create color' }).click();
    await expect(row(page, 'dirty-brown')).toContainText('#B1641E');

    await page.getByRole('button', { name: 'Edit Dirty Brown' }).click();
    await page.getByLabel('Hex for Dirty Brown (leave empty for none)').fill('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(row(page, 'dirty-brown')).toContainText('None');
    await expect(row(page, 'dirty-brown').getByTestId('swatch')).toHaveCount(0);

    // An invalid hex: a field error at the hex field, and nothing created.
    await form.getByLabel('Name', { exact: true }).fill(unique('Bad Hex'));
    await form.getByLabel('Hex (optional)').fill('#12345');
    await form.getByRole('button', { name: 'Create color' }).click();
    await expect(form.getByRole('alert')).toContainText('Hex: Must be a #RRGGBB color');
    await expect(form.getByText('Must be a #RRGGBB color', { exact: true })).toBeVisible();
  });

  test('Delete a color from the admin', async ({ page }) => {
    const api = catalogApi(page);
    const unused = await api.createColor(unique('Unused Tone'));
    const category = await api.createCategory();
    const used = await api.createColor(unique('Used Tone'));
    await createProductWithVariant(page, category.id, { colorId: used.id });

    await page.goto('/catalog/colors');
    await page.getByRole('button', { name: `Delete ${unused.name}` }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(row(page, unused.slug)).toHaveCount(0);

    await page.getByRole('button', { name: `Delete ${used.name}` }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(alerts(page)).toHaveText('Variants still use this color.');
    await expect(row(page, used.slug)).toBeVisible();
  });
});
