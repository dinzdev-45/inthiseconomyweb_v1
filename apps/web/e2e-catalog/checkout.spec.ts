import { expect, test, type Page } from '@playwright/test';

import {
  add,
  addCheckoutTee,
  DETAILS,
  fillDetails,
  setOwnLineQuantity,
} from './checkout-support.ts';

const placeButton = (page: Page) =>
  page.locator('main').getByRole('button', { name: 'Place order' });

test.describe('storefront-checkout: Checkout page', () => {
  test('Open checkout', async ({ page }) => {
    await addCheckoutTee(page);
    await page.locator('main').getByRole('link', { name: 'Checkout', exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    const summary = page.locator('[data-summary]');
    await expect(summary).toContainText('Checkout Tee');
    await expect(summary).toContainText(/Subtotal\s*Rp\s490\.000/);
    await expect(summary.locator('[data-shipping]')).toHaveText(/Rp\s20\.000/);
    await expect(summary.locator('[data-total]')).toHaveText(/Rp\s510\.000/);
    for (const label of [
      ...Object.keys(DETAILS),
      'Province',
      'Apartment, building, etc. (optional)',
      'Note for delivery (optional)',
    ]) {
      await expect(page.locator('main').getByLabel(label, { exact: true })).toBeVisible();
    }
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('Checkout with nothing to buy', async ({ page, browser }) => {
    await page.goto('/checkout');
    await expect(page.getByText('There’s nothing to check out yet.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse the shop' })).toHaveAttribute(
      'href',
      '/shop',
    );
    await expect(placeButton(page)).toHaveCount(0);

    // Another customer whose line is short of stock (Last Black Tee L has 4; no order is placed).
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await add(otherPage, '/products/last-black-tee?color=black&size=L');
    await setOwnLineQuantity(other, 5);
    await otherPage.goto('/checkout');
    await expect(otherPage.getByText(/need attention/)).toBeVisible();
    await expect(
      otherPage.getByText(/Last Black Tee \(Black, L\): not enough stock/),
    ).toBeVisible();
    await expect(otherPage.getByRole('link', { name: 'Review your cart' })).toHaveAttribute(
      'href',
      '/cart',
    );
    await expect(placeButton(otherPage)).toHaveCount(0);
    await other.close();
  });
});

test.describe('storefront-checkout: Place an order from the storefront', () => {
  test('Place an order', async ({ page }) => {
    await addCheckoutTee(page);
    await page.goto('/checkout');
    await fillDetails(page, { 'Note for delivery (optional)': 'Leave with the guard' });
    await placeButton(page).click();
    await expect(page).toHaveURL(/\/orders\/ITE-[0-9A-Z]{8}\?key=[A-Za-z0-9_-]{43}$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^ITE-/);
    await expect(page.locator('[data-order-status]')).toContainText('Awaiting payment');

    // The cart is empty now, in the header and on the cart page.
    await expect(
      page.getByRole('banner').getByRole('link', { name: /^Cart/ }),
    ).toHaveAccessibleName('Cart');
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  });

  test('Invalid details in the form', async ({ page }) => {
    await addCheckoutTee(page);
    await page.goto('/checkout');
    await fillDetails(page, { Email: 'not-an-email', 'Postal code': '4011' });
    await placeButton(page).click();
    await expect(page.locator('[data-field-error="email"]')).toHaveText(
      'Enter a valid email address.',
    );
    await expect(page.locator('[data-field-error="postalCode"]')).toHaveText(
      'Enter a 5-digit postal code.',
    );
    await expect(page.locator('main').getByLabel('Email', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    // Everything entered is kept, and no order was placed.
    await expect(page.locator('main').getByLabel('Email', { exact: true })).toHaveValue(
      'not-an-email',
    );
    await expect(page.locator('main').getByLabel('Recipient name', { exact: true })).toHaveValue(
      'Ana Putri',
    );
    await expect(page.locator('main').getByLabel('Province', { exact: true })).toHaveValue('32');
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test('Cart changed during checkout', async ({ page, context }) => {
    await addCheckoutTee(page);
    await page.goto('/checkout');
    await fillDetails(page);
    await setOwnLineQuantity(context, 2); // the total shown is now out of date
    await placeButton(page).click();
    await expect(page.locator('[data-checkout-message]')).toContainText('Your cart changed');
    await expect(page.locator('[data-summary] [data-total]')).toHaveText(/Rp\s1\.000\.000/);
    await expect(page.locator('main').getByLabel('Recipient name', { exact: true })).toHaveValue(
      'Ana Putri',
    );
    await expect(page).toHaveURL(/\/checkout$/);
    // Placing it again with the new total works.
    await placeButton(page).click();
    await expect(page).toHaveURL(/\/orders\/ITE-/);
  });
});

test.describe('storefront-checkout: Place an order from the storefront (without JavaScript)', () => {
  test.use({ javaScriptEnabled: false });

  test('Invalid details in the form (without JavaScript)', async ({ page }) => {
    await page.goto('/products/checkout-tee?color=white&size=S');
    await page.locator('[data-add-to-cart] button').click();
    await expect(page).toHaveURL(/\/cart\?added=/);
    await page.goto('/checkout');
    await fillDetails(page, { 'Postal code': '4011' });
    await placeButton(page).click();
    await expect(page.locator('[data-field-error="postalCode"]')).toHaveText(
      'Enter a 5-digit postal code.',
    );
    await expect(page.locator('main').getByLabel('Recipient name', { exact: true })).toHaveValue(
      'Ana Putri',
    );

    await page.locator('main').getByLabel('Postal code', { exact: true }).fill('40115');
    await placeButton(page).click();
    await expect(page).toHaveURL(/\/orders\/ITE-/);
  });
});

test.describe('storefront-checkout: Order page', () => {
  test('Order confirmation', async ({ page }) => {
    await addCheckoutTee(page);
    await page.goto('/checkout');
    await fillDetails(page);
    await placeButton(page).click();
    await expect(page).toHaveURL(/\/orders\/ITE-/);
    const status = page.locator('[data-order-status]');
    await expect(status).toContainText('Awaiting payment');
    await expect(status).toContainText(/Pay by \d{1,2} \w+ \d{4} at \d{2}:\d{2} WIB/);
    await expect(page.getByRole('link', { name: 'Checkout Tee' })).toBeVisible();
    await expect(page.locator('[data-order-total]')).toHaveText(/Rp\s510\.000/);
    await expect(page.locator('[data-delivery]')).toContainText('Bandung, Jawa Barat 40115');
    await expect(page.locator('[data-delivery]')).toContainText('+6281234567890');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // The same link opens it again.
    await page.reload();
    await expect(status).toContainText('Awaiting payment');
  });

  test('Order page without the right key', async ({ page }) => {
    await addCheckoutTee(page);
    await page.goto('/checkout');
    await fillDetails(page);
    await placeButton(page).click();
    await expect(page).toHaveURL(/\/orders\/ITE-/);
    const url = new URL(page.url());
    for (const target of [
      url.pathname,
      `${url.pathname}?key=${'x'.repeat(43)}`,
      '/orders/ITE-00000000?key=abc',
    ]) {
      const response = await page.goto(target);
      expect(response?.status(), target).toBe(404);
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    }
  });
});
