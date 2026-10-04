import { expect, test, type Page } from '@playwright/test';

import {
  catalogApi,
  createProductWithVariant,
  signInAsCatalogStaff,
  unique,
  uniqueCode,
} from './support/catalog.ts';

const variantsRegion = (page: Page) => page.getByRole('region', { name: 'Variants and stock' });
const variantRow = (page: Page, sku: string) => page.getByTestId(`variant-row-${sku}`);
const addForm = (page: Page) => page.getByRole('form', { name: 'Add a variant' });
const stockOf = (page: Page, sku: string) => variantRow(page, sku).getByTestId('stock-quantity');

/** A draft product with a size and color ready to use, and nothing else. */
async function draftProduct(page: Page, basePrice = 89_900_000) {
  const api = catalogApi(page);
  const category = await api.createCategory(unique('Variants'));
  const product = await api.createProduct(category.id, {
    basePrice: { amount: basePrice, currency: 'IDR' },
  });
  return { api, product };
}

async function adjust(page: Page, sku: string, delta: string) {
  await variantRow(page, sku).getByLabel(`Stock change for ${sku}`).fill(delta);
  await variantRow(page, sku).getByRole('button', { name: 'Apply' }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAsCatalogStaff(page);
});

test.describe('admin-products: Variant management', () => {
  test('Add a variant from the admin', async ({ page }) => {
    const { api, product } = await draftProduct(page);
    await api.createSize('M', 30, 'Medium');
    const color = await api.createColor(unique('Washed Black'));

    await page.goto(`/catalog/products/${product.id}`);
    const form = addForm(page);
    await form.getByLabel('Size').selectOption({ label: 'M · Medium' });
    await form.getByLabel('Color').selectOption({ label: color.name });
    await form.getByLabel('SKU').fill('ite-oh-wb-m');
    await form.getByLabel('Initial stock (optional)').fill('12');
    await form.getByRole('button', { name: 'Add variant' }).click();

    const row = variantRow(page, 'ITE-OH-WB-M');
    await expect(row).toContainText('Active');
    await expect(stockOf(page, 'ITE-OH-WB-M')).toHaveText('12');
    await expect(row).toContainText('Rp 899.000');
    await expect(row).not.toContainText('override');
    await expect(variantsRegion(page).getByRole('status').first()).toHaveText(
      'Variant ITE-OH-WB-M added.',
    );
    await expect(form.getByLabel('SKU')).toHaveValue('');
  });

  test('Set and clear a variant price override in the admin', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Override'));
    const { product, variant } = await createProductWithVariant(page, category.id);

    await page.goto(`/catalog/products/${product.id}`);
    await variantRow(page, variant.sku)
      .getByRole('button', { name: `Edit variant ${variant.sku}` })
      .click();
    const edit = page.getByRole('form', { name: `Edit variant ${variant.sku}` });
    await edit.getByLabel('Price override (IDR)').fill('949000');
    await edit.getByRole('button', { name: 'Save variant' }).click();
    await expect(variantRow(page, variant.sku)).toContainText('Rp 949.000');
    await expect(variantRow(page, variant.sku)).toContainText('override');

    await variantRow(page, variant.sku)
      .getByRole('button', { name: `Edit variant ${variant.sku}` })
      .click();
    await edit.getByLabel('Price override (IDR)').fill('');
    await edit.getByRole('button', { name: 'Save variant' }).click();
    await expect(variantRow(page, variant.sku)).toContainText('Rp 899.000');
    await expect(variantRow(page, variant.sku)).not.toContainText('override');
  });

  test('Variant conflicts shown in the admin', async ({ page }) => {
    const api = catalogApi(page);
    const category = await api.createCategory(unique('Conflicts'));
    const { product, variant, sizeId, colorId } = await createProductWithVariant(page, category.id);
    const other = await createProductWithVariant(page, category.id);
    const size = (await (await page.request.get('/api/v1/admin/sizes')).json()).data.find(
      (s: { id: string }) => s.id === sizeId,
    );
    const color = (await (await page.request.get('/api/v1/admin/colors')).json()).data.find(
      (c: { id: string }) => c.id === colorId,
    );

    await page.goto(`/catalog/products/${product.id}`);
    const form = addForm(page);
    // Same size and color as the existing variant.
    await form.getByLabel('Size').selectOption({ label: `${size.code} · ${size.label}` });
    await form.getByLabel('Color').selectOption({ label: color.name });
    await form.getByLabel('SKU').fill(`NEW-${uniqueCode()}`);
    await form.getByRole('button', { name: 'Add variant' }).click();
    await expect(form.getByRole('alert')).toContainText(
      'This product already has a variant with this size and color.',
    );
    await expect(form.getByRole('alert')).toBeFocused();

    // A SKU another product's variant uses.
    const freshSize = await api.createSize(uniqueCode(), 950);
    await page.reload();
    await form.getByLabel('Size').selectOption({ label: `${freshSize.code} · ${freshSize.label}` });
    await form.getByLabel('Color').selectOption({ label: color.name });
    await form.getByLabel('SKU').fill(other.variant.sku.toLowerCase());
    await form.getByRole('button', { name: 'Add variant' }).click();
    await expect(form.getByText('Another variant already uses this SKU.').first()).toBeVisible();
    await expect(form.getByLabel('SKU')).toHaveValue(other.variant.sku.toLowerCase());

    // No variant was added.
    await expect(variantsRegion(page).locator('tbody tr')).toHaveCount(1);
    await expect(variantRow(page, variant.sku)).toBeVisible();
  });

  test('SKU read-only after activation in the admin', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Sku Lock'));
    const { product, variant } = await createProductWithVariant(page, category.id, {
      activate: true,
    });

    await page.goto(`/catalog/products/${product.id}`);
    await variantRow(page, variant.sku)
      .getByRole('button', { name: `Edit variant ${variant.sku}` })
      .click();
    const edit = page.getByRole('form', { name: `Edit variant ${variant.sku}` });
    await expect(edit.locator('[name="sku"]')).toHaveCount(0);
    await expect(edit.getByTestId('sku-locked')).toContainText(variant.sku);
    await expect(edit.getByLabel('Size')).toBeEnabled();
    await expect(edit.getByLabel('Color')).toBeEnabled();
    await edit.getByLabel('Price override (IDR)').fill('999000');
    await edit.getByRole('button', { name: 'Save variant' }).click();
    await expect(variantRow(page, variant.sku)).toContainText('Rp 999.000');
  });

  test('Deactivating the last active variant shows the reason', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Last Variant'));
    const { product, variant } = await createProductWithVariant(page, category.id, {
      activate: true,
    });

    await page.goto(`/catalog/products/${product.id}`);
    await variantRow(page, variant.sku)
      .getByRole('button', { name: `Deactivate variant ${variant.sku}` })
      .click();
    const alert = variantsRegion(page).getByRole('alert');
    await expect(alert).toContainText(`Could not deactivate variant ${variant.sku}.`);
    await expect(alert).toContainText(
      'An active product must keep at least one active variant priced above zero.',
    );
    await expect(variantRow(page, variant.sku)).toContainText('Active');
  });

  test('activates and deactivates a variant of a draft product', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Toggle'));
    const { product, variant } = await createProductWithVariant(page, category.id);

    await page.goto(`/catalog/products/${product.id}`);
    await variantRow(page, variant.sku)
      .getByRole('button', { name: `Deactivate variant ${variant.sku}` })
      .click();
    await expect(variantRow(page, variant.sku)).toContainText('Inactive');
    await variantRow(page, variant.sku)
      .getByRole('button', { name: `Activate variant ${variant.sku}` })
      .click();
    await expect(variantRow(page, variant.sku)).toContainText('Active');
    await expect(variantsRegion(page).getByRole('status').first()).toHaveText(
      `Variant ${variant.sku} activated.`,
    );
  });

  test('shows variants of an archived product without controls', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Archived Variants'));
    const { product, variant } = await createProductWithVariant(page, category.id);
    await catalogApi(page).lifecycle(product.id, 'archive');

    await page.goto(`/catalog/products/${product.id}`);
    await expect(variantRow(page, variant.sku)).toContainText('5');
    await expect(variantsRegion(page).getByRole('button')).toHaveCount(0);
    await expect(variantsRegion(page).getByRole('textbox')).toHaveCount(0);
    await expect(addForm(page)).toHaveCount(0);
  });
});

test.describe('admin-products: Stock adjustments', () => {
  test('Adjust stock by a delta in the admin', async ({ page }) => {
    const { api, product } = await draftProduct(page);
    const [size, color] = [await api.createSize(uniqueCode()), await api.createColor()];
    const variant = await api.createVariant(product.id, {
      sizeId: size.id,
      colorId: color.id,
      sku: `STK-${uniqueCode()}`,
      stockQuantity: 12,
    });

    await page.goto(`/catalog/products/${product.id}`);
    await expect(stockOf(page, variant.sku)).toHaveText('12');
    await variantRow(page, variant.sku).getByLabel(`Stock change for ${variant.sku}`).fill('+5');
    await expect(variantRow(page, variant.sku)).toContainText('Adds 5 units');
    await variantRow(page, variant.sku).getByRole('button', { name: 'Apply' }).click();
    await expect(stockOf(page, variant.sku)).toHaveText('17');
    await expect(variantRow(page, variant.sku).getByRole('status')).toHaveText(
      `Stock for ${variant.sku} is now 17.`,
    );

    await adjust(page, variant.sku, '-3');
    await expect(stockOf(page, variant.sku)).toHaveText('14');
    await expect(
      variantRow(page, variant.sku).getByLabel(`Stock change for ${variant.sku}`),
    ).toHaveValue('');
  });

  test('Insufficient stock shown in the admin', async ({ page }) => {
    const { api, product } = await draftProduct(page);
    const [size, color] = [await api.createSize(uniqueCode()), await api.createColor()];
    const variant = await api.createVariant(product.id, {
      sizeId: size.id,
      colorId: color.id,
      sku: `LOW-${uniqueCode()}`,
      stockQuantity: 2,
    });

    await page.goto(`/catalog/products/${product.id}`);
    await adjust(page, variant.sku, '-3');
    await expect(variantRow(page, variant.sku).getByRole('alert')).toContainText(
      'Not enough stock: 2 available, adjustment of -3.',
    );
    await expect(stockOf(page, variant.sku)).toHaveText('2');
  });

  test('No absolute stock editing', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('No Absolute'));
    const { product, variant } = await createProductWithVariant(page, category.id);

    await page.goto(`/catalog/products/${product.id}`);
    await variantRow(page, variant.sku)
      .getByRole('button', { name: `Edit variant ${variant.sku}` })
      .click();
    const edit = page.getByRole('form', { name: `Edit variant ${variant.sku}` });
    await expect(edit).toBeVisible();
    await expect(edit.locator('[name="stockQuantity"]')).toHaveCount(0);
    await expect(edit.getByText(/stock/i)).toHaveCount(0);
    // Stock changes only through the adjustment control.
    await expect(
      variantRow(page, variant.sku).getByLabel(`Stock change for ${variant.sku}`),
    ).toBeVisible();
  });

  test('refuses malformed stock changes without a request', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Bad Delta'));
    const { product, variant } = await createProductWithVariant(page, category.id);
    const adjustments: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/stock-adjustments')) adjustments.push(r.url());
    });

    await page.goto(`/catalog/products/${product.id}`);
    for (const input of ['0', '1.5', 'abc']) {
      await adjust(page, variant.sku, input);
      await expect(variantRow(page, variant.sku).getByRole('alert')).toBeVisible();
    }
    expect(adjustments).toEqual([]);
    await expect(stockOf(page, variant.sku)).toHaveText('5');
  });
});
