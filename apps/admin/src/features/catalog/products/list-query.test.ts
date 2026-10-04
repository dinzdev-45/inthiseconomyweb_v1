import { describe, expect, it } from 'vitest';

import {
  clearSearchHref,
  firstPageHref,
  isFiltered,
  listHref,
  nextPageHref,
  parseListState,
} from './list-query.ts';

const CATEGORY = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';

describe('parseListState', () => {
  it('reads search, filters, and the cursor', () => {
    expect(
      parseListState({ q: '  hoodie ', status: 'DRAFT', categoryId: CATEGORY, cursor: 'abc.def' }),
    ).toEqual({ q: 'hoodie', status: 'DRAFT', categoryId: CATEGORY, cursor: 'abc.def' });
  });

  it('drops values the API would reject, and takes the first of repeated params', () => {
    expect(
      parseListState({ q: 'x'.repeat(121), status: 'DELETED', categoryId: 'not-an-id' }),
    ).toEqual({});
    expect(parseListState({ q: ['a', 'b'], status: ['ACTIVE', 'DRAFT'] })).toEqual({
      q: 'a',
      status: 'ACTIVE',
    });
    expect(parseListState({ q: '   ', cursor: '' })).toEqual({});
  });

  it('keeps the cursor exactly as given (it is opaque)', () => {
    const cursor = 'eyJ2IjoxfQ.c2lnbmF0dXJl-_';
    expect(parseListState({ cursor }).cursor).toBe(cursor);
  });
});

describe('list links', () => {
  const state = { q: 'hoodie', status: 'DRAFT' as const, categoryId: CATEGORY, cursor: 'c1' };

  it('builds links in a stable order', () => {
    expect(listHref({})).toBe('/catalog/products');
    expect(listHref(state)).toBe(
      `/catalog/products?q=hoodie&status=DRAFT&categoryId=${CATEGORY}&cursor=c1`,
    );
  });

  it('keeps search and filters for the next page, replacing the cursor', () => {
    expect(nextPageHref(state, 'c2')).toBe(
      `/catalog/products?q=hoodie&status=DRAFT&categoryId=${CATEGORY}&cursor=c2`,
    );
  });

  it('returns to the first page with the same search and filters', () => {
    expect(firstPageHref(state)).toBe(
      `/catalog/products?q=hoodie&status=DRAFT&categoryId=${CATEGORY}`,
    );
  });

  it('clears only the search, keeping filters and dropping the cursor', () => {
    expect(clearSearchHref(state)).toBe(`/catalog/products?status=DRAFT&categoryId=${CATEGORY}`);
  });

  it('encodes search text and cursors safely', () => {
    expect(listHref({ q: '100% cotton & more', cursor: 'a+b/c=' })).toBe(
      '/catalog/products?q=100%25+cotton+%26+more&cursor=a%2Bb%2Fc%3D',
    );
  });

  it('knows when the list is narrowed', () => {
    expect(isFiltered({})).toBe(false);
    expect(isFiltered({ cursor: 'c1' })).toBe(false);
    expect(isFiltered({ q: 'x' })).toBe(true);
    expect(isFiltered({ status: 'ARCHIVED' })).toBe(true);
    expect(isFiltered({ categoryId: CATEGORY })).toBe(true);
  });
});
