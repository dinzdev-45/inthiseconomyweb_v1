import { expect, test } from '@playwright/test';

/** This suite runs without an API (playwright.config.ts), so a cart cannot be read. */
test('Cart unavailable', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'ite_cart', value: 'a'.repeat(43), url: baseURL! }]);
  await page.goto('/cart');
  await expect(page.getByRole('heading', { level: 1, name: 'Cart unavailable' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/cart');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  const text = (await page.locator('main').textContent()) ?? '';
  expect(text).not.toMatch(/fetch failed|ECONNREFUSED|127\.0\.0\.1|StoreApiError|stack|digest/i);
});

/** Without a cart cookie the count route answers 0 itself: the API (down here) is never asked. */
test('No cart, no count', async ({ page, request }) => {
  const apiRequests: string[] = [];
  page.on('request', (r) => {
    const url = r.url();
    if (url.includes(':4999') || url.includes('/api/v1/')) apiRequests.push(url);
  });
  const countResponse = page.waitForResponse((r) => r.url().endsWith('/cart/count'));
  await page.goto('/');
  expect(await (await countResponse).json()).toEqual({ count: 0 });
  await expect(page.getByRole('banner').getByRole('link', { name: /^Cart/ })).toHaveAccessibleName(
    'Cart',
  );
  await expect(page.locator('[data-cart-count]')).toHaveCount(0);
  expect(apiRequests).toEqual([]);

  const direct = await request.get('/cart/count');
  expect(direct.status()).toBe(200);
  expect(await direct.json()).toEqual({ count: 0 });
});
