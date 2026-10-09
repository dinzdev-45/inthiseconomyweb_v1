import { Money } from '@ite/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DropSummary } from '@/features/drops';

vi.mock('server-only', () => ({}));
const getDropsOverview = vi.fn();
vi.mock('@/features/drops/server/drops', () => ({ getDropsOverview }));
const { getHomeContent } = await import('./get-home-content.ts');

const drop = (slug: string, status: DropSummary['status'], startsAt: string): DropSummary => ({
  slug,
  collection: 'COLLECTION',
  title: slug.toUpperCase(),
  status,
  startsAt,
  image: null,
});
const LIVE = drop('cost-of-living', 'live', '2026-10-01T03:00:00.000Z');
const NEXT = drop('overtime', 'upcoming', '2026-11-20T03:00:00.000Z');
const LATER = drop('night-shift', 'upcoming', '2027-01-20T03:00:00.000Z');
const overview = (upcoming: DropSummary[], current: DropSummary | null) => ({
  upcoming,
  current,
  archive: [],
});

beforeEach(() => getDropsOverview.mockResolvedValue(overview([], LIVE)));
afterEach(() => {
  vi.restoreAllMocks();
  getDropsOverview.mockReset();
});

describe('getHomeContent', () => {
  it('reads only the drop from the API (cached for 300 s); the rest is placeholder content', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const content = await getHomeContent();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getDropsOverview).toHaveBeenCalledExactlyOnceWith(300);
    expect(content.featured.products).toHaveLength(4);
    expect(content.look.items.length).toBeGreaterThanOrEqual(2);
    expect(content.look.items.length).toBeLessThanOrEqual(3);
  });

  it('carries the hero and manifesto copy from the spec', async () => {
    const { hero, manifesto } = await getHomeContent();
    expect(hero).toMatchObject({
      headline: 'IN THIS ECONOMY',
      collection: 'COLLECTION 001',
      campaign: 'COST OF LIVING',
      cta: { label: 'SHOP THE DROP', href: '/drops' },
    });
    expect(hero.supportingLine.replace('’', "'")).toBe("Clothing for the world we're living in.");
    expect(manifesto.headline).toBe('OUR ECONOMY.');
    expect(manifesto.cta.href).toBe('/story');
  });

  it('features the next upcoming drop, or else the current live drop', async () => {
    getDropsOverview.mockResolvedValueOnce(overview([NEXT, LATER], LIVE));
    expect((await getHomeContent()).drop).toEqual(NEXT);
    expect((await getHomeContent()).drop).toEqual(LIVE);
  });

  it('features no drop when none is published or the API fails', async () => {
    getDropsOverview.mockResolvedValueOnce(overview([], null));
    expect((await getHomeContent()).drop).toBeNull();
    getDropsOverview.mockRejectedValueOnce(new Error('fetch failed'));
    const content = await getHomeContent();
    expect(content.drop).toBeNull();
    expect(content.hero.headline).toBe('IN THIS ECONOMY');
  });

  it('uses valid shared Money values and URL-safe, unique slugs', async () => {
    const content = await getHomeContent();
    const products = [
      ...content.featured.products,
      ...content.newArrivals.products,
      ...content.look.items.map((item) => item.product),
    ];
    for (const product of products) {
      expect(Money.safeParse(product.price).success).toBe(true);
      expect(product.price.amount).toBeGreaterThan(0);
      expect(product.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    const listed = [...content.featured.products, ...content.newArrivals.products].map(
      (p) => p.slug,
    );
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('keeps look positions within the image (percent) for future hotspots', async () => {
    const { look } = await getHomeContent();
    for (const { position } of look.items) {
      if (!position) continue;
      for (const value of [position.x, position.y]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('provides at least two lookbook visuals and internal CTAs', async () => {
    const { lookbook, featured, look } = await getHomeContent();
    expect(lookbook.visuals.length).toBeGreaterThanOrEqual(2);
    expect([lookbook.cta, featured.cta, look.cta].map((cta) => cta.href)).toEqual([
      '/lookbook',
      '/shop',
      '/lookbook',
    ]);
  });
});
