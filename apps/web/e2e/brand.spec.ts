import { expect, test, type Page } from '@playwright/test';

/**
 * storefront-homepage: Brand palette. Colours are normalised by painting them on a
 * 1×1 canvas and reading the pixel back, so hex, rgb(), and Tailwind's color-mix/oklab
 * opacity variants compare the same way.
 */

const PALETTE = {
  brand: [177, 100, 30],
  brandDark: [124, 67, 24],
  cream: [242, 235, 221],
  ink: [23, 22, 21],
  stone: [117, 111, 103],
  sand: [204, 185, 159],
  soft: [217, 180, 140],
  paper: [250, 248, 243],
} satisfies Record<string, [number, number, number]>;

async function installColorHelpers(page: Page) {
  await page.evaluate((palette) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const w = window as unknown as Record<string, unknown>;
    /** [r, g, b, alpha 0–1] of any CSS colour. */
    w.__rgba = (css: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!, a! / 255];
    };
    w.__palette = palette;
  }, PALETTE);
}

/** RGB within a small tolerance (the alpha channel is ignored). */
const near = (a: number[], b: number[], tolerance = 3) =>
  a.slice(0, 3).every((v, i) => Math.abs(v - b[i]!) <= tolerance);

test('Brand accent usage', async ({ page }) => {
  await page.goto('/');
  await installColorHelpers(page);
  const colors = await page.evaluate(() => {
    const rgba = (window as unknown as { __rgba: (c: string) => number[] }).__rgba;
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    return {
      wordmark: rgba(style('body > header a span').color),
      heroCta: rgba(
        style('section[aria-labelledby="hero-heading"] a[href="/drops"]').backgroundColor,
      ),
      manifesto: rgba(style('section[aria-labelledby="manifesto-heading"]').backgroundColor),
      footer: rgba(style('body > footer').backgroundColor),
      page: rgba(style('body').backgroundColor),
    };
  });
  expect(near(colors.wordmark, PALETTE.brand)).toBe(true);
  expect(near(colors.heroCta, PALETTE.brand)).toBe(true);
  expect(near(colors.manifesto, PALETTE.brand)).toBe(true);
  expect(near(colors.footer, PALETTE.ink)).toBe(true);
  expect(near(colors.page, PALETTE.paper)).toBe(true);

  // Without an API the homepage has no drop section; the drop feature is on the fixtures page.
  await page.goto('/e2e-fixtures/catalog');
  await installColorHelpers(page);
  const drop = await page.evaluate(() =>
    (window as unknown as { __rgba: (c: string) => number[] }).__rgba(
      getComputedStyle(document.querySelector('section[data-drop-status]')!).backgroundColor,
    ),
  );
  expect(near(drop, PALETTE.ink)).toBe(true);
});

test('Brand Brown only on large text', async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await installColorHelpers(page);
    const problems = await page.evaluate(() => {
      const w = window as unknown as {
        __rgba: (c: string) => number[];
        __palette: Record<string, number[]>;
      };
      const palette = Object.values(w.__palette);
      const near = (a: number[], b: number[]) =>
        a.slice(0, 3).every((v, i) => Math.abs(v - b[i]!) <= 3);
      const inPalette = (c: number[]) => c[3] === 0 || palette.some((p) => near(c, p));
      const ink = w.__palette.ink!;
      const isInkTint = (c: number[]) => near(c, ink); // any alpha of Near Black
      const brand = w.__palette.brand!;
      const opaque = (c: number[]) => c[3]! > 0.99;

      const background = (el: Element): number[] => {
        for (let node: Element | null = el; node; node = node.parentElement) {
          const c = w.__rgba(getComputedStyle(node).backgroundColor);
          if (c[3]! > 0) return c;
        }
        return w.__rgba(getComputedStyle(document.body).backgroundColor);
      };

      const issues: string[] = [];
      const elements = new Set<Element>();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const parent = walker.currentNode.parentElement;
        if (walker.currentNode.textContent?.trim() && parent) elements.add(parent);
      }
      for (const el of elements) {
        if (el.getClientRects().length === 0 || el.closest('.sr-only, script, style, noscript'))
          continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden') continue;
        const color = w.__rgba(style.color);
        const bg = background(el);
        const label = `${el.tagName} "${(el.textContent ?? '').trim().slice(0, 24)}"`;

        if (!inPalette(color) && !isInkTint(color))
          issues.push(`off-palette text ${color} ${label}`);
        if (!inPalette(bg)) issues.push(`off-palette background ${bg} ${label}`);

        const brandText = opaque(color) && near(color, brand);
        const onBrand = near(bg, brand);
        if (brandText || onBrand) {
          const size = parseFloat(style.fontSize);
          const weight = Number(style.fontWeight);
          const wordmark = el.textContent?.trim() === 'InThisEconomy';
          const large = size >= 24 || (size >= 18.66 && weight >= 700);
          if (!wordmark && !large)
            issues.push(
              `small text ${brandText ? 'in' : 'on'} Brand Brown (${size}px/${weight}) ${label}`,
            );
        }
      }
      for (const el of document.querySelectorAll('body *')) {
        const image = getComputedStyle(el).backgroundImage;
        if (image.includes('gradient')) issues.push(`gradient on ${el.tagName}`);
        const border = w.__rgba(getComputedStyle(el).borderTopColor);
        if (
          parseFloat(getComputedStyle(el).borderTopWidth) > 0 &&
          !inPalette(border) &&
          !isInkTint(border)
        ) {
          issues.push(`off-palette border ${border} on ${el.tagName}`);
        }
      }
      return issues;
    });
    expect(problems, `at ${viewport.width}px`).toEqual([]);
  }
});
