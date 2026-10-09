import { expect, test, type Page } from '@playwright/test';

import { catalogApi, signInAsCatalogStaff, unique } from './support/catalog.ts';

const IMAGE = { url: '/images/e2e/drop.jpg', alt: 'Drop campaign' };

/** Three products whose names share a token, so one search finds exactly them. */
async function productsNamed(page: Page, token: string) {
  const api = catalogApi(page);
  const category = await api.createCategory();
  const products = [];
  for (const name of ['Alpha', 'Bravo', 'Charlie']) {
    products.push(await api.createProduct(category.id, { name: `${token} ${name}` }));
  }
  return products;
}

const productList = (page: Page) => page.getByRole('list', { name: 'Products in this drop' });

async function search(page: Page, q: string) {
  const form = page.getByRole('search', { name: 'Find products' });
  await form.getByLabel('Product name').fill(q);
  await form.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('list', { name: 'Search results' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await signInAsCatalogStaff(page);
});

test.describe('admin-drops: Drops list', () => {
  test('Drops list', async ({ page }) => {
    const api = catalogApi(page);
    const drop = await api.createDrop({ collection: 'COLLECTION 900', title: unique('Listed') });
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Drops' })
      .click();
    await expect(page).toHaveURL(/\/catalog\/drops$/);
    const row = page.getByTestId(`drop-row-${drop.slug}`);
    await expect(row).toContainText('COLLECTION 900');
    await expect(row.getByRole('link', { name: drop.title })).toHaveAttribute(
      'href',
      `/catalog/drops/${drop.id}`,
    );
    await expect(row).toContainText('Draft');
    await expect(row).toContainText('1 Jun 2099, 10:00 WIB');
    await expect(row.locator('td').last()).toHaveText('0');
    await expect(page.getByRole('link', { name: 'New drop' })).toBeVisible();
  });
});

test.describe('admin-drops: Drop form', () => {
  test('Create a drop in the admin', async ({ page }) => {
    const title = unique('Overtime');
    await page.goto('/catalog/drops');
    await page.getByRole('link', { name: 'New drop' }).click();
    const form = page.getByRole('form', { name: 'New drop' });
    await form.getByLabel('Collection', { exact: true }).fill('COLLECTION 002');
    await form.getByLabel('Title', { exact: true }).fill(title);
    await form.getByLabel('Release (date and time, WIB)').fill('2099-06-01T10:00');
    await form.getByRole('button', { name: 'Create drop' }).click();

    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page).toHaveURL(/\/catalog\/drops\/[0-9a-f-]+\?created=1$/);
    await expect(page.getByTestId('drop-status')).toHaveText('Draft');
    await expect(page.getByTestId('drop-release')).toHaveText('1 Jun 2099, 10:00 WIB');
    await expect(
      page.getByRole('form', { name: 'Drop details' }).getByLabel('Release (date and time, WIB)'),
    ).toHaveValue('2099-06-01T10:00');
  });

  test('Drop form errors', async ({ page }) => {
    const taken = await catalogApi(page).createDrop();
    await page.goto('/catalog/drops/new');
    const form = page.getByRole('form', { name: 'New drop' });
    await form.getByLabel('Collection', { exact: true }).fill('COLLECTION 003');
    await form.getByLabel('Title', { exact: true }).fill('Second Shift');
    await form.getByLabel(/^Slug/).fill(taken.slug);
    await form.getByLabel('Release (date and time, WIB)').fill('2099-07-01T09:30');
    await form.getByRole('button', { name: 'Create drop' }).click();

    const slugField = form.locator('label', { has: page.locator('input[name="slug"]') });
    await expect(slugField).toContainText(/slug/i);
    await expect(form.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/catalog\/drops\/new$/);
    await expect(form.getByLabel('Collection', { exact: true })).toHaveValue('COLLECTION 003');
    await expect(form.getByLabel('Title', { exact: true })).toHaveValue('Second Shift');
    await expect(form.getByLabel(/^Slug/)).toHaveValue(taken.slug);
    await expect(form.getByLabel('Release (date and time, WIB)')).toHaveValue('2099-07-01T09:30');
  });
});

test.describe('admin-drops: Drop product picker', () => {
  test("Choose a drop's products", async ({ page }) => {
    const token = unique('Picker').replace(/\W+/g, '');
    await productsNamed(page, token);
    const drop = await catalogApi(page).createDrop();
    await page.goto(`/catalog/drops/${drop.id}`);

    await search(page, token);
    for (const name of ['Alpha', 'Bravo', 'Charlie']) {
      await page.getByRole('button', { name: `Add ${token} ${name}` }).click();
    }
    // Move the last one to the top, then remove the middle one of the original three.
    await page.getByRole('button', { name: `Move ${token} Charlie up` }).click();
    await page.getByRole('button', { name: `Move ${token} Charlie up` }).click();
    await page.getByRole('button', { name: `Remove ${token} Bravo` }).click();
    await expect(productList(page).getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: 'Save products' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Products saved.' })).toBeVisible();

    await page.reload();
    await expect(productList(page).getByRole('listitem')).toHaveText([
      new RegExp(`${token} Charlie`),
      new RegExp(`${token} Alpha`),
    ]);
  });

  test('Product already in another drop', async ({ page }) => {
    const token = unique('Taken').replace(/\W+/g, '');
    const [alpha] = await productsNamed(page, token);
    const api = catalogApi(page);
    const other = await api.createDrop({ title: unique('Night Shift') });
    await api.setDropProducts(other.id, [alpha!.id]);
    const drop = await api.createDrop();
    await page.goto(`/catalog/drops/${drop.id}`);

    await search(page, token);
    const result = page.getByTestId(`candidate-${alpha!.slug}`);
    await expect(result).toContainText(`In ${other.title}`);
    await expect(result.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Add ${token} Bravo` })).toBeVisible();
  });
});

test.describe('admin-drops: Drop actions', () => {
  test('Publish from the admin', async ({ page }) => {
    const token = unique('Ready').replace(/\W+/g, '');
    const [alpha] = await productsNamed(page, token);
    const api = catalogApi(page);
    const drop = await api.createDrop({ image: IMAGE });
    await api.setDropProducts(drop.id, [alpha!.id]);
    await page.goto(`/catalog/drops/${drop.id}`);

    const release = page.getByRole('region', { name: 'Release' });
    await release.getByRole('button', { name: `Publish ${drop.title}` }).click();
    await release.getByRole('button', { name: 'Confirm publish' }).click();
    await expect(page.getByTestId('drop-status')).toHaveText('Published');
    await expect(release.getByRole('button', { name: `Unpublish ${drop.title}` })).toBeVisible();
    await expect(release.getByRole('button', { name: `Delete ${drop.title}` })).toHaveCount(0);
  });

  test('Publish refused in the admin', async ({ page }) => {
    const token = unique('NoImage').replace(/\W+/g, '');
    const [alpha] = await productsNamed(page, token);
    const api = catalogApi(page);
    const drop = await api.createDrop();
    await api.setDropProducts(drop.id, [alpha!.id]);
    await page.goto(`/catalog/drops/${drop.id}`);

    const release = page.getByRole('region', { name: 'Release' });
    await release.getByRole('button', { name: `Publish ${drop.title}` }).click();
    await release.getByRole('button', { name: 'Confirm publish' }).click();
    const alert = release.getByRole('alert');
    await expect(alert).toContainText('Publishing needs');
    await expect(alert.getByRole('listitem')).toHaveText(['An image']);
    await expect(page.getByTestId('drop-status')).toHaveText('Draft');
  });

  test('Drop workflow from create to publish', async ({ page }) => {
    const token = unique('Flow').replace(/\W+/g, '');
    await productsNamed(page, token);
    const title = unique('Flow Drop');

    // Create, add products, then give it an image and publish: all through the screens.
    await page.goto('/catalog/drops/new');
    const form = page.getByRole('form', { name: 'New drop' });
    await form.getByLabel('Collection', { exact: true }).fill('COLLECTION 004');
    await form.getByLabel('Title', { exact: true }).fill(title);
    await form.getByLabel('Release (date and time, WIB)').fill('2099-08-01T19:00');
    await form.getByRole('button', { name: 'Create drop' }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();

    await search(page, token);
    await page.getByRole('button', { name: `Add ${token} Bravo` }).click();
    await page.getByRole('button', { name: `Add ${token} Alpha` }).click();
    await page.getByRole('button', { name: 'Save products' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Products saved.' })).toBeVisible();

    const details = page.getByRole('form', { name: 'Drop details' });
    await details.getByLabel('Image URL (needed to publish)').fill(IMAGE.url);
    await details.getByLabel('Image alt text').fill(IMAGE.alt);
    await details.getByRole('button', { name: 'Save details' }).click();
    await expect(details.getByRole('status')).toHaveText('Drop details saved.');

    const release = page.getByRole('region', { name: 'Release' });
    await release.getByRole('button', { name: `Publish ${title}` }).click();
    await release.getByRole('button', { name: 'Confirm publish' }).click();
    await expect(page.getByTestId('drop-status')).toHaveText('Published');

    await page.goto('/catalog/drops');
    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row).toContainText('Published');
    await expect(row.locator('td').last()).toHaveText('2');
  });
});
