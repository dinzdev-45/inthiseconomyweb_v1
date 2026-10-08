import { describe, expect, it } from 'vitest';

import {
  catalogHref,
  changeHref,
  clearFiltersHref,
  DEFAULT_STATE,
  hasFilters,
  pageHref,
  parseCatalogState,
} from './url-state.ts';

describe('parseCatalogState', () => {
  it('reads every shop parameter', () => {
    expect(
      parseCatalogState('/shop', {
        category: 'outerwear',
        size: 'm',
        color: 'washed-black',
        availability: 'in-stock',
        sort: 'price-asc',
        page: '2',
      }),
    ).toEqual({
      state: {
        category: 'outerwear',
        size: 'M',
        color: 'washed-black',
        inStock: true,
        sort: 'price-asc',
        page: 2,
      },
      ignored: false,
    });
  });

  it('defaults to newest, page 1, no filters', () => {
    expect(parseCatalogState('/shop', {})).toEqual({ state: DEFAULT_STATE, ignored: false });
  });

  it('treats empty values as unset without a notice', () => {
    expect(
      parseCatalogState('/shop', { category: '', size: '', color: '', availability: '' }),
    ).toEqual({ state: DEFAULT_STATE, ignored: false });
    expect(parseCatalogState('/search', { q: '   ' })).toEqual({
      state: DEFAULT_STATE,
      ignored: false,
    });
  });

  it('drops malformed values and flags them (Invalid filter in the URL)', () => {
    const { state, ignored } = parseCatalogState('/shop', {
      sort: 'popular',
      size: 'M L',
      category: 'outerwear',
    });
    expect(state).toEqual({ ...DEFAULT_STATE, category: 'outerwear' });
    expect(ignored).toBe(true);
    for (const params of [
      { page: '0' },
      { page: 'two' },
      { color: 'Black!' },
      { availability: 'sold-out' },
      { category: ['tops', 'outerwear'] },
    ]) {
      expect(parseCatalogState('/shop', params).ignored).toBe(true);
    }
    expect(parseCatalogState('/search', { q: 'x'.repeat(101) })).toEqual({
      state: DEFAULT_STATE,
      ignored: true,
    });
  });

  it('reads only its own parameters and ignores unrelated ones silently', () => {
    expect(
      parseCatalogState('/search', { q: ' hoodie ', category: 'tops', utm_source: 'x' }),
    ).toEqual({ state: { ...DEFAULT_STATE, q: 'hoodie' }, ignored: false });
    expect(parseCatalogState('/shop', { q: 'hoodie', utm_source: 'x' })).toEqual({
      state: DEFAULT_STATE,
      ignored: false,
    });
  });
});

describe('catalog links', () => {
  const state = {
    ...DEFAULT_STATE,
    category: 'outerwear',
    size: 'M',
    inStock: true,
    sort: 'price-desc' as const,
    page: 3,
  };

  it('builds URLs in a fixed order without defaults', () => {
    expect(catalogHref('/shop', DEFAULT_STATE)).toBe('/shop');
    expect(catalogHref('/shop', state)).toBe(
      '/shop?category=outerwear&size=M&availability=in-stock&sort=price-desc&page=3',
    );
    expect(catalogHref('/search', { ...DEFAULT_STATE, q: '100% cotton' })).toBe(
      '/search?q=100%25+cotton',
    );
  });

  it('page links keep filters and sort', () => {
    expect(pageHref('/shop', state, 1)).toBe(
      '/shop?category=outerwear&size=M&availability=in-stock&sort=price-desc',
    );
    expect(pageHref('/shop', state, 4)).toContain('category=outerwear');
    expect(pageHref('/shop', state, 4)).toContain('page=4');
  });

  it('filter and sort changes return to page 1', () => {
    expect(changeHref('/shop', state, { color: 'black' })).toBe(
      '/shop?category=outerwear&size=M&color=black&availability=in-stock&sort=price-desc',
    );
    expect(changeHref('/shop', state, { size: undefined })).not.toContain('page=');
    expect(changeHref('/shop', state, { sort: 'newest' })).not.toContain('sort=');
  });

  it('clearing filters keeps the sort and starts at page 1', () => {
    expect(hasFilters(state)).toBe(true);
    expect(hasFilters(DEFAULT_STATE)).toBe(false);
    expect(clearFiltersHref('/shop', state)).toBe('/shop?sort=price-desc');
  });

  it('round-trips through parsing', () => {
    const href = catalogHref('/shop', state);
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(parseCatalogState('/shop', params)).toEqual({ state, ignored: false });
  });
});
