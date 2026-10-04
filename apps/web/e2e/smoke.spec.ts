import { expect, test } from '@playwright/test';

test.describe('storefront smoke', () => {
  test('loads / with the storefront layout and the Archivo typeface', async ({ page }) => {
    // No API runs in this suite; the homepage does not need one.
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toMatch(/Archivo/);

    const faces = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((face) => face.family.includes('Archivo') && !face.family.includes('Fallback'))
        .map((face) => ({ family: face.family, display: face.display, status: face.status }));
    });
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) expect(face.display).toBe('swap');
    expect(faces.some((face) => face.status === 'loaded')).toBe(true);
  });
});
