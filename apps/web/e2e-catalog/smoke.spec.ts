import { StoreProductListResponse } from '@ite/contracts';
import { expect, test } from '@playwright/test';

import { CATALOG_E2E } from './config.ts';

test('the seeded catalog is served to the storefront stack', async ({ page, request }) => {
  const res = await request.get(`${CATALOG_E2E.apiUrl}/api/v1/store/products`);
  expect(res.status()).toBe(200);
  const list = StoreProductListResponse.parse(await res.json());
  expect(list.totalItems).toBe(30);
  const all = [
    ...list.data,
    ...StoreProductListResponse.parse(
      await (await request.get(`${CATALOG_E2E.apiUrl}/api/v1/store/products?page=2`)).json(),
    ).data,
  ].map((product) => product.slug);
  expect(all).toContain('overdraft-hoodie');
  expect(all).not.toContain('archived-jacket');
  expect(all).not.toContain('side-hustle-crewneck');

  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
});
