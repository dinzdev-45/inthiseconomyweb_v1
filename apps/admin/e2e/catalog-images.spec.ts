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

const imagesRegion = (page: Page) => page.getByRole('region', { name: 'Images' });
const items = (page: Page) =>
  imagesRegion(page).getByRole('list', { name: 'Images in display order' }).getByRole('listitem');
const item = (page: Page, position: number) => items(page).nth(position - 1);
const addForm = (page: Page) => page.getByRole('form', { name: 'Add an image' });
const altsInOrder = (page: Page) => items(page).getByTestId('image-alt').allTextContents();
const primaryPositions = async (page: Page) => {
  const flags = await items(page).evaluateAll((els) =>
    els.map((el) =>
      Array.from(el.querySelectorAll('span')).some((s) => s.textContent === 'Primary'),
    ),
  );
  return flags.flatMap((primary, index) => (primary ? [index + 1] : []));
};

/** A draft product with `count` images added through the API (the first is primary). */
async function productWithImages(page: Page, count: number) {
  const api = catalogApi(page);
  const category = await api.createCategory(unique('Images'));
  const product = await api.createProduct(category.id);
  for (let n = 0; n < count; n++) {
    await api.addImage(product.id, {
      url: `/images/e2e/${n}.png`,
      alt: `View ${String.fromCharCode(65 + n)}`,
    });
  }
  return product;
}

async function addImage(page: Page, url: string, alt: string) {
  await addForm(page).getByLabel('Image URL or path').fill(url);
  await addForm(page).getByLabel('Alt text').fill(alt);
  await addForm(page).getByRole('button', { name: 'Add image' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.route('**/images/e2e/*.png', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
  );
  await signInAsCatalogStaff(page);
});

test.describe('admin-products: Image metadata management', () => {
  test('Add image metadata from the admin', async ({ page }) => {
    const product = await productWithImages(page, 0);
    await page.goto(`/catalog/products/${product.id}`);
    await expect(imagesRegion(page)).toContainText('No images yet.');

    await addImage(page, '/images/e2e/front.png', 'Front view');
    await expect(items(page)).toHaveCount(1);
    await expect(item(page, 1)).toContainText('Primary');
    await expect(item(page, 1).getByRole('img', { name: 'Front view' })).toBeVisible();
    await expect(imagesRegion(page).getByRole('status').first()).toHaveText(
      'Image added as the primary image.',
    );

    await addImage(page, '/images/e2e/back.png', 'Back view');
    await expect(items(page)).toHaveCount(2);
    await expect.poll(() => primaryPositions(page)).toEqual([1]);
    await expect(item(page, 2)).toContainText('All variants');
  });

  test('Make another image primary from the admin', async ({ page }) => {
    const product = await productWithImages(page, 2);
    await page.goto(`/catalog/products/${product.id}`);
    await expect.poll(() => primaryPositions(page)).toEqual([1]);
    await page.getByRole('button', { name: 'Make image 2 primary', exact: true }).click();
    await expect.poll(() => primaryPositions(page)).toEqual([2]);
    await expect(
      page.getByRole('button', { name: 'Make image 1 primary', exact: true }),
    ).toBeVisible();
  });

  test('edits alt text and the variant link of an image', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Image Edit'));
    const { product, variant } = await createProductWithVariant(page, category.id);
    await page.goto(`/catalog/products/${product.id}`);

    await page.getByRole('button', { name: 'Edit image 1', exact: true }).click();
    const form = page.getByRole('form', { name: 'Edit image' });
    await form.getByLabel('Alt text').fill('Front view, close up');
    await form.getByLabel('Variant (optional)').selectOption({ value: variant.id });
    await form.getByRole('button', { name: 'Save image' }).click();
    await expect(item(page, 1)).toContainText('Front view, close up');
    await expect(item(page, 1)).toContainText(`Variant ${variant.sku}`);
    await expect(page.getByRole('form', { name: 'Edit image' })).toHaveCount(0);
  });

  test('Delete an image from the admin', async ({ page }) => {
    const product = await productWithImages(page, 2);
    await page.goto(`/catalog/products/${product.id}`);
    await page.getByRole('button', { name: 'Delete image 1', exact: true }).click();
    await expect(
      page.getByRole('group', { name: 'Delete image 1 (the primary image)?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await expect(items(page)).toHaveCount(1);
    await expect.poll(() => altsInOrder(page)).toEqual(['View B']);
    await expect.poll(() => primaryPositions(page)).toEqual([1]);
    await expect(imagesRegion(page).getByRole('status').first()).toHaveText(
      'Image deleted. The next image is now the primary image.',
    );
  });

  test('Deleting the last image of an active product shows the reason', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Last Image'));
    const { product } = await createProductWithVariant(page, category.id, { activate: true });
    await page.goto(`/catalog/products/${product.id}`);

    await page.getByRole('button', { name: 'Delete image 1', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    const alert = imagesRegion(page).getByRole('alert');
    await expect(alert).toContainText('Could not delete image 1.');
    await expect(alert).toContainText(
      'An active product must keep at least one image. Deactivate the product first.',
    );
    await expect(items(page)).toHaveCount(1);
  });

  test('Invalid image metadata shown in the admin', async ({ page }) => {
    const product = await productWithImages(page, 0);
    await page.goto(`/catalog/products/${product.id}`);

    await addImage(page, 'http://example.com/a.jpg', 'Front view');
    await expect(
      addForm(page).getByText('Must be an https:// URL or a path starting with /').first(),
    ).toBeVisible();
    await expect(addForm(page).getByRole('alert')).toBeFocused();

    await addImage(page, '/images/e2e/front.png', '   ');
    await expect(addForm(page).getByRole('alert')).toContainText('Alt text:');
    await expect(imagesRegion(page)).toContainText('No images yet.');
  });

  test("refuses another product's variant or an unknown variant with the API reason", async ({
    page,
  }) => {
    const category = await catalogApi(page).createCategory(unique('Mismatch'));
    const { product } = await createProductWithVariant(page, category.id);
    const { variant: foreign } = await createProductWithVariant(page, category.id);
    await page.goto(`/catalog/products/${product.id}`);

    // The select only lists this product's variants; point an option elsewhere to reach the API rule.
    const select = addForm(page).getByLabel('Variant (optional)');
    const pointTo = (id: string) =>
      select.evaluate((el: HTMLSelectElement, value) => {
        el.options[1]!.value = value;
        el.selectedIndex = 1;
      }, id);

    await pointTo(foreign.id);
    await addImage(page, '/images/e2e/side.png', 'Side view');
    await expect(
      addForm(page).getByText('The variant belongs to a different product.').first(),
    ).toBeVisible();

    await pointTo('0190a000-0000-7000-8000-000000000000');
    await addForm(page).getByRole('button', { name: 'Add image' }).click();
    await expect(addForm(page).getByRole('alert')).toContainText('Variant not found.');
    await expect(items(page)).toHaveCount(1);
  });

  test('shows the image limit refusal', async ({ page }) => {
    const product = await productWithImages(page, 20);
    await page.goto(`/catalog/products/${product.id}`);
    await expect(imagesRegion(page)).toContainText('20 of 20 images.');
    await addImage(page, '/images/e2e/extra.png', 'One too many');
    await expect(addForm(page).getByRole('alert')).toContainText(
      'A product can have at most 20 images.',
    );
    await expect(items(page)).toHaveCount(20);
  });

  test('falls back to a placeholder for a preview that fails to load', async ({ page }) => {
    const product = await productWithImages(page, 0);
    await catalogApi(page).addImage(product.id, {
      url: '/images/e2e/missing.jpg',
      alt: 'Missing file',
    });
    await page.goto(`/catalog/products/${product.id}`);
    await expect(item(page, 1).getByTestId('thumbnail-placeholder')).toBeVisible();
    await expect(item(page, 1)).toContainText('/images/e2e/missing.jpg');
  });

  test('shows images of an archived product without controls', async ({ page }) => {
    const product = await productWithImages(page, 2);
    await catalogApi(page).lifecycle(product.id, 'archive');
    await page.goto(`/catalog/products/${product.id}`);
    await expect(items(page)).toHaveCount(2);
    await expect(imagesRegion(page).getByRole('button')).toHaveCount(0);
    await expect(addForm(page)).toHaveCount(0);
    await expect.poll(() => primaryPositions(page)).toEqual([1]);
  });

  test('Reorder images from the admin', async ({ page }) => {
    const product = await productWithImages(page, 3);
    await page.goto(`/catalog/products/${product.id}`);
    await expect.poll(() => altsInOrder(page)).toEqual(['View A', 'View B', 'View C']);

    await page.getByRole('button', { name: 'Move image 3 up', exact: true }).click();
    await expect.poll(() => altsInOrder(page)).toEqual(['View A', 'View C', 'View B']);
    await page.getByRole('button', { name: 'Move image 2 up', exact: true }).click();
    await expect.poll(() => altsInOrder(page)).toEqual(['View C', 'View A', 'View B']);

    await page.reload();
    await expect.poll(() => altsInOrder(page)).toEqual(['View C', 'View A', 'View B']);
    // Reordering does not move the primary label.
    await expect.poll(() => primaryPositions(page)).toEqual([2]);
  });
});

test.describe('admin-catalog-ui: Confirmation and keyboard', () => {
  test('Cancel a disruptive action', async ({ page }) => {
    const product = await productWithImages(page, 1);
    const deletes: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'DELETE') deletes.push(r.url());
    });
    await page.goto(`/catalog/products/${product.id}`);

    await page.getByRole('button', { name: 'Delete image 1', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Delete image 1', exact: true })).toBeFocused();
    await expect(items(page)).toHaveCount(1);
    expect(deletes).toEqual([]);
  });

  test('Catalog keyboard operation', async ({ page }) => {
    const category = await catalogApi(page).createCategory(unique('Keyboard'));
    const { product, variant } = await createProductWithVariant(page, category.id);
    await catalogApi(page).addImage(product.id, { url: '/images/e2e/second.png', alt: 'View two' });
    await page.goto(`/catalog/products/${product.id}`);

    // Tab through the whole page: every kind of control is reachable by keyboard.
    const reached = new Set<string>();
    await page
      .locator('main')
      .focus()
      .catch(() => undefined);
    for (let step = 0; step < 120; step++) {
      await page.keyboard.press('Tab');
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? '';
      });
      reached.add(name);
    }
    for (const name of [
      `Activate ${product.name}`,
      'Save details',
      `Edit variant ${variant.sku}`,
      `Stock change for ${variant.sku}`,
      'Move image 1 down',
      'Make image 2 primary',
      'Delete image 2',
      'Add image',
    ]) {
      expect([...reached], name).toContain(name);
    }

    // Move the first image down with the keyboard; focus follows the moved image.
    const moveDown = page.getByRole('button', { name: 'Move image 1 down', exact: true });
    await moveDown.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => altsInOrder(page)).toEqual(['View two', expect.any(String)]);
    const moved = page.getByRole('button', { name: 'Move image 2 up', exact: true });
    await expect(moved).toBeFocused();
    // A visible focus indicator on the focused control.
    const outline = await moved.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect.poll(() => altsInOrder(page)).toEqual([expect.any(String), 'View two']);
  });
});
