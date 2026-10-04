import { Money } from '@ite/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { getHomeContent } = await import('./get-home-content.ts');

afterEach(() => vi.restoreAllMocks());

describe('getHomeContent', () => {
  it('returns the placeholder content without calling the API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const content = await getHomeContent();
    expect(fetchSpy).not.toHaveBeenCalled();
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

  it('features the live COLLECTION 001 / COST OF LIVING drop', async () => {
    const { drop } = await getHomeContent();
    expect(drop).toMatchObject({
      collection: 'COLLECTION 001',
      title: 'COST OF LIVING',
      status: 'live',
    });
    expect(Number.isNaN(Date.parse(drop!.startsAt))).toBe(false);
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
