import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * storefront-homepage quality scenarios (Group 6). The suite runs against the
 * production build with no API: API_URL points at 127.0.0.1:4999, where nothing listens.
 */

const SECTIONS = 'main > div > section';
const WIDTHS = [320, 375, 768, 1024, 1440, 1920];

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'])
    // The wordmark is a logotype (role="img", named "InThisEconomy"). WCAG 1.4.3 exempts
    // logotypes from contrast minimums, so its Brand Brown letters are not scanned. All other
    // Brand Brown text is large; see "Brand Brown only on large text" in brand.spec.ts.
    .exclude('[data-logotype]')
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 4)
          .join(' | ')}`,
    );
}

test('No horizontal overflow', async ({ page }) => {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const doc = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(doc.scroll, `document scroll width at ${width}px`).toBe(doc.viewport);
  }
});

test('Automated accessibility scan', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  expect(await seriousViolations(page), 'desktop').toEqual([]);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(await seriousViolations(page), 'mobile').toEqual([]);

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
  // Scan the menu as it is seen once open, not mid-way through its 200 ms fade-in.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState === 'finished'),
  );
  expect(await seriousViolations(page), 'mobile menu open').toEqual([]);
});

test('Visible focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const visited: string[] = [];
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press('Tab');
    const result = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return { done: true as const };
      if (el.dataset.focusVisited) return { done: true as const }; // wrapped around to the start
      el.dataset.focusVisited = 'yes';
      const style = getComputedStyle(el);
      return {
        done: false as const,
        label: `${el.tagName} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`,
        outline: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
        color: style.outlineColor,
      };
    });
    if (result.done) break;
    visited.push(result.label);
    // A visible outline (at least 2px, not transparent) while keyboard-focused.
    expect(result.outline, result.label).not.toBe('none');
    expect(result.width, result.label).toBeGreaterThanOrEqual(2);
    expect(result.color, result.label).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  }

  // Every interactive element in the page was reached by Tab alone.
  const reachable = await page
    .locator('a[href], button, input')
    .evaluateAll(
      (els) => els.filter((el) => (el as HTMLElement).getClientRects().length > 0).length,
    );
  expect(visited.length).toBe(reachable);

  // Distinct from the unfocused state: the same element has no outline without focus.
  const unfocused = await page.evaluate(() => {
    const link = document.querySelector('main a[href]') as HTMLElement;
    link.blur();
    return getComputedStyle(link).outlineStyle;
  });
  expect(unfocused).toBe('none');
});

test('Reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const motion = () =>
    page.evaluate(() => {
      const moving = [...document.querySelectorAll('*')].filter((el) => {
        const style = getComputedStyle(el);
        const durations = [
          ...style.transitionDuration.split(','),
          ...style.animationDuration.split(','),
        ];
        return durations.some((d) => parseFloat(d) > 0);
      });
      return { moving: moving.length, running: document.getAnimations().length };
    });

  expect(await motion()).toEqual({ moving: 0, running: 0 });

  // The mobile menu opens without animation: fully opaque immediately, nothing running.
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Menu' });
  expect(await menu.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  expect(await motion()).toEqual({ moving: 0, running: 0 });
});

test('Placeholder media', async ({ page }) => {
  await page.goto('/');
  // No broken images: every <img> has a real source.
  const imgs = await page
    .locator('img')
    .evaluateAll((els) => els.map((el) => el.getAttribute('src')));
  for (const src of imgs) expect(src).toBeTruthy();

  const placeholders = page.locator('[data-media="placeholder"]');
  expect(await placeholders.count()).toBeGreaterThan(15);
  const frames = await placeholders.evaluateAll((els) =>
    els.map((el) => ({
      hidden: el.getAttribute('aria-hidden'),
      height: el.getBoundingClientRect().height,
      width: el.getBoundingClientRect().width,
    })),
  );
  for (const frame of frames) {
    expect(frame.hidden).toBe('true');
    expect(frame.height).toBeGreaterThan(0); // keeps its shape with no image
  }

  // The items' own text still identifies them.
  for (const card of await page.locator('main article').all()) {
    await expect(card.getByRole('heading')).toHaveText(/\S/);
  }
  await expect(page.locator(`${SECTIONS} [data-look-image]`)).toHaveCount(1);
  await expect(page.locator('section[aria-labelledby="look-heading"] ol a')).toHaveCount(3);
});

test('Reserved media space', async ({ page }) => {
  // Record every layout shift from the very start of the load.
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __frames: number[] };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<{
        value: number;
        hadRecentInput: boolean;
      }>) {
        if (!entry.hadRecentInput) w.__cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    // Media frame heights as soon as the DOM exists, before images or fonts settle.
    document.addEventListener('DOMContentLoaded', () => {
      w.__frames = [...document.querySelectorAll('[data-media]')].map(
        (el) => el.getBoundingClientRect().height,
      );
    });
  });

  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1_000);
    const { cls, frames } = await page.evaluate(() => {
      const w = window as unknown as { __cls: number; __frames: number[] };
      return { cls: w.__cls, frames: w.__frames };
    });
    expect(frames.length, 'media frames at DOMContentLoaded').toBeGreaterThan(15);
    for (const height of frames) expect(height).toBeGreaterThan(0);
    expect(cls, `cumulative layout shift at ${viewport.width}px`).toBeLessThan(0.1);
  }
});

test('Homepage does not depend on the API', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes(':4999') || url.includes('/health') || url.includes('/api/v1/'))
      apiRequests.push(url);
  });
  const response = await page.goto('/');
  expect(response!.status()).toBe(200);
  await expect(page.locator(SECTIONS)).toHaveCount(9);
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(apiRequests).toEqual([]);
});

test('Static homepage', () => {
  // The suite's web server ran `next build`; its prerender manifest lists static routes.
  const manifest = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../.next/prerender-manifest.json', import.meta.url)),
      'utf8',
    ),
  ) as { routes: Record<string, { initialRevalidateSeconds: number | false }> };
  expect(manifest.routes).toHaveProperty('/');
  expect(manifest.routes['/']!.initialRevalidateSeconds).toBe(false); // fully static, no revalidation
});
