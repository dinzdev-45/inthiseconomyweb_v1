import { expect, test } from '@playwright/test';

import { signInAsCatalogStaff, unique, uniqueCode } from './support/catalog.ts';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('admin-products: Catalog end-to-end workflow', () => {
  test('Catalog workflow from setup to an active product', async ({ page }) => {
    // Only sign-in uses the API; every catalog step below goes through the admin screens.
    await page.route('**/images/e2e/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
    );
    await signInAsCatalogStaff(page);
    const categoryName = unique('Workflow Outerwear');
    const sizeCode = uniqueCode();
    const colorName = unique('Workflow Black');
    const productName = unique('Workflow Coach Jacket');
    const sku = `WF-${uniqueCode()}`;

    // 1. Reference data.
    await page.goto('/catalog/categories');
    const categoryForm = page.getByRole('form', { name: 'New category' });
    await categoryForm.getByLabel('Name', { exact: true }).fill(categoryName);
    await categoryForm.getByRole('button', { name: 'Create category' }).click();
    await expect(page.getByRole('status')).toContainText(`Category “${categoryName}” created`);

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Sizes', exact: true })
      .click();
    const sizeForm = page.getByRole('form', { name: 'New size' });
    await sizeForm.getByLabel('Code', { exact: true }).fill(sizeCode.toLowerCase());
    await sizeForm.getByLabel('Label', { exact: true }).fill('Workflow size');
    await sizeForm.getByLabel('Sort order', { exact: true }).fill('3');
    await sizeForm.getByRole('button', { name: 'Create size' }).click();
    await expect(page.getByTestId(`size-row-${sizeCode}`)).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Colors', exact: true })
      .click();
    const colorForm = page.getByRole('form', { name: 'New color' });
    await colorForm.getByLabel('Name', { exact: true }).fill(colorName);
    await colorForm.getByLabel('Hex (optional)').fill('#171615');
    await colorForm.getByRole('button', { name: 'Create color' }).click();
    await expect(page.getByRole('status')).toContainText(`Color “${colorName}” created`);

    // 2. The product, created as a draft, then edited.
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Products', exact: true })
      .click();
    await page.getByRole('link', { name: 'New product' }).click();
    const createForm = page.getByRole('form', { name: 'New product' });
    await createForm.getByLabel('Name', { exact: true }).fill(productName);
    await createForm.getByLabel('Category').selectOption({ label: categoryName });
    await createForm.getByLabel('Base price (IDR)').fill('899000');
    await createForm.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByRole('heading', { level: 1, name: productName })).toBeVisible();
    await expect(page.getByTestId('product-status')).toHaveText('Draft');

    const details = page.getByRole('form', { name: 'Product details' });
    await details.getByLabel('Description (optional)').fill('Water-resistant shell, boxy fit.');
    await details.getByRole('button', { name: 'Save details' }).click();
    await expect(details.getByRole('status')).toHaveText('Product details saved.');

    // Not ready yet: activation explains what is missing.
    const lifecycle = page.getByRole('region', { name: 'Lifecycle' });
    await lifecycle.getByRole('button', { name: `Activate ${productName}`, exact: true }).click();
    await expect(lifecycle.getByRole('alert').getByRole('listitem')).toHaveText([
      'It has no active variant',
      'It has no images',
    ]);

    // 3. A variant with initial stock 5, then a stock adjustment that ends back at 5.
    const variantForm = page.getByRole('form', { name: 'Add a variant' });
    await variantForm.getByLabel('Size').selectOption({ label: `${sizeCode} · Workflow size` });
    await variantForm.getByLabel('Color').selectOption({ label: colorName });
    await variantForm.getByLabel('SKU').fill(sku.toLowerCase());
    await variantForm.getByLabel('Initial stock (optional)').fill('5');
    await variantForm.getByRole('button', { name: 'Add variant' }).click();
    const variantRow = page.getByTestId(`variant-row-${sku}`);
    await expect(variantRow.getByTestId('stock-quantity')).toHaveText('5');

    for (const [delta, expected] of [
      ['+2', '7'],
      ['-2', '5'],
    ] as const) {
      await variantRow.getByLabel(`Stock change for ${sku}`).fill(delta);
      await variantRow.getByRole('button', { name: 'Apply' }).click();
      await expect(variantRow.getByTestId('stock-quantity')).toHaveText(expected);
    }

    // 4. An image (metadata only), which becomes primary.
    const imageForm = page.getByRole('form', { name: 'Add an image' });
    await imageForm.getByLabel('Image URL or path').fill('/images/e2e/workflow.png');
    await imageForm.getByLabel('Alt text').fill('Coach jacket, front');
    await imageForm.getByRole('button', { name: 'Add image' }).click();
    await expect(
      page.getByRole('region', { name: 'Images' }).getByText('Primary', { exact: true }),
    ).toBeVisible();

    // 5. Activate: now ready.
    await lifecycle.getByRole('button', { name: `Activate ${productName}`, exact: true }).click();
    await expect(page.getByTestId('product-status')).toHaveText('Active');
    await expect(page.getByTestId('product-activated-at')).not.toHaveText('Never');

    // Slug and SKU are locked from now on.
    await expect(page.getByTestId('slug-locked')).toBeVisible();
    await variantRow.getByRole('button', { name: `Edit variant ${sku}`, exact: true }).click();
    await expect(page.getByTestId('sku-locked')).toContainText(sku);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    // 6. The product list shows the result.
    await page.getByRole('link', { name: 'Products', exact: true }).first().click();
    const search = page.getByRole('search', { name: 'Search and filter products' });
    await search.getByLabel('Category').selectOption({ label: categoryName });
    await search.getByRole('button', { name: 'Apply' }).click();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1);
    const row = rows.first();
    await expect(row.getByRole('link', { name: productName })).toBeVisible();
    await expect(row.getByRole('img', { name: 'Coach jacket, front' })).toBeVisible();
    for (const text of [
      categoryName,
      'Active',
      'Rp 899.000',
      '5 units in stock',
      '1 active variant',
    ]) {
      await expect(row).toContainText(text);
    }
    await expect(row.locator('td').nth(5)).toHaveText('1');
    await expect(row).not.toContainText('out of stock');
  });
});
