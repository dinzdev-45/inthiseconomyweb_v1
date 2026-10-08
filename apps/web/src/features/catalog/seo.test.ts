import { describe, expect, it } from 'vitest';

import { productMetadata, searchMetadata, shopMetadata } from './seo.ts';
import { DEFAULT_STATE } from './url-state.ts';

describe('catalog metadata builders', () => {
  it('/shop and its pages are indexable with their own canonical URL', () => {
    const first = shopMetadata(DEFAULT_STATE);
    expect(first).toMatchObject({ title: 'Shop', alternates: { canonical: '/shop' } });
    expect(first.description).toBeTruthy();
    expect(first.robots).toBeUndefined();
    expect(shopMetadata({ ...DEFAULT_STATE, page: 2 })).toMatchObject({
      title: 'Shop · Page 2',
      alternates: { canonical: '/shop?page=2' },
    });
  });

  it('a category view is indexable and named', () => {
    const meta = shopMetadata({ ...DEFAULT_STATE, category: 'outerwear', page: 3 }, 'Outerwear');
    expect(meta).toMatchObject({
      title: 'Outerwear · Shop · Page 3',
      alternates: { canonical: '/shop?category=outerwear&page=3' },
    });
    expect(meta.robots).toBeUndefined();
  });

  it.each([
    [{ size: 'M' }, '/shop'],
    [{ color: 'black', category: 'outerwear' }, '/shop?category=outerwear'],
    [{ inStock: true }, '/shop'],
    [{ sort: 'price-asc' as const }, '/shop'],
  ])('%j is noindex, follow with canonical %s', (change, canonical) => {
    const meta = shopMetadata({ ...DEFAULT_STATE, ...change });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe(canonical);
  });

  it('search and the product placeholder are never indexed', () => {
    expect(searchMetadata({ ...DEFAULT_STATE, q: 'hoodie' })).toMatchObject({
      title: 'Search: hoodie',
      robots: { index: false },
    });
    expect(searchMetadata(DEFAULT_STATE).title).toBe('Search');
    expect(productMetadata('Zip Hoodie')).toMatchObject({
      title: 'Zip Hoodie',
      robots: { index: false },
    });
  });
});
