import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

import { expect, type BrowserContext, type Page } from '@playwright/test';

import { CATALOG_E2E } from './config.ts';
import { openProduct } from './support.ts';

/** Valid details, by field label. */
export const DETAILS: Record<string, string> = {
  Email: 'ana@example.com',
  'Mobile number': '0812 3456 7890',
  'Recipient name': 'Ana Putri',
  'Street address': 'Jl. Melati No. 5',
  'City or regency': 'Bandung',
  'Postal code': '40115',
};

/** Adds one of the variant at `url` to this context's cart. */
export async function add(page: Page, url: string) {
  await openProduct(page, url);
  await page.locator('[data-add-to-cart] button').click();
  await expect(page).toHaveURL(/\/cart\?added=/);
}

/** The Checkout Tee (stock 50) is bought only by these tests, so no other test's stock moves. */
export const addCheckoutTee = (page: Page) =>
  add(page, '/products/checkout-tee?color=white&size=S');

export async function fillDetails(page: Page, overrides: Record<string, string> = {}) {
  for (const [label, value] of Object.entries({ ...DETAILS, ...overrides })) {
    await page.locator('main').getByLabel(label, { exact: true }).fill(value);
  }
  await page
    .locator('main')
    .getByLabel('Province', { exact: true })
    .selectOption({ label: 'Jawa Barat' });
}

/** Sets this context's own cart lines' quantity straight in the database (nothing shared). */
export async function setOwnLineQuantity(context: BrowserContext, quantity: number) {
  const token = (await context.cookies()).find((c) => c.name === 'ite_cart')!.value;
  const hash = createHmac('sha256', CATALOG_E2E.apiEnv.SESSION_SECRET)
    .update(`cart:${token}`)
    .digest('hex');
  execFileSync('psql', [
    CATALOG_E2E.databaseUrl,
    '-qc',
    `UPDATE cart_lines SET quantity = ${quantity} WHERE cart_id = (SELECT id FROM carts WHERE token_hash = '${hash}')`,
  ]);
}
