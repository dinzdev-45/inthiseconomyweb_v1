import { SizeCode, Slug, StorePage, StoreSearchText, StoreSort } from '@ite/contracts';

/*
 * Catalog URL state (storefront-catalog design D5). The URL is the only state: filters, sort,
 * search, and page are read from search params with the same contract primitives the API uses,
 * and every link is built here. Pure functions, safe on server and client.
 */

export type CatalogPath = '/shop' | '/search';

export type CatalogState = {
  category?: string;
  size?: string;
  color?: string;
  inStock: boolean;
  sort: StoreSort;
  q?: string;
  page: number;
};

export type SearchParams = Record<string, string | string[] | undefined>;

export type ParsedCatalogState = {
  state: CatalogState;
  /** True when a filter, sort, search, or page value was present but not well-formed. */
  ignored: boolean;
};

export const DEFAULT_STATE: CatalogState = { inStock: false, sort: 'newest', page: 1 };

/** The parameters each page reads; anything else in the URL is ignored silently. */
const PARAMS: Record<CatalogPath, readonly string[]> = {
  '/shop': ['category', 'size', 'color', 'availability', 'sort', 'page'],
  '/search': ['q', 'sort', 'page'],
};

type Parser = { safeParse: (value: unknown) => { success: boolean; data?: unknown } };
const PARSERS: Record<string, Parser> = {
  category: Slug,
  size: SizeCode,
  color: Slug,
  availability: { safeParse: (v) => ({ success: v === 'in-stock', data: true }) },
  sort: StoreSort,
  q: StoreSearchText,
  page: StorePage,
};
const KEYS: Record<string, keyof CatalogState> = {
  category: 'category',
  size: 'size',
  color: 'color',
  availability: 'inStock',
  sort: 'sort',
  q: 'q',
  page: 'page',
};

/**
 * Reads the catalog state for `path` from search params. Empty values (an "Any" select or an
 * empty search box) mean "not set". Values that are not well-formed, or repeated, are dropped
 * and reported through `ignored`, so the page can show a notice instead of an error.
 */
export function parseCatalogState(path: CatalogPath, params: SearchParams): ParsedCatalogState {
  const state: Record<string, unknown> = { ...DEFAULT_STATE };
  let ignored = false;
  for (const name of PARAMS[path]) {
    const raw = params[name];
    if (raw === undefined) continue;
    const value = Array.isArray(raw) ? (raw.length === 1 ? raw[0]! : null) : raw;
    if (value === '' || (name === 'q' && value?.trim() === '')) continue;
    const parsed = value === null ? { success: false } : PARSERS[name]!.safeParse(value);
    if (parsed.success) state[KEYS[name]!] = parsed.data;
    else ignored = true;
  }
  return { state: state as CatalogState, ignored };
}

/** The state as URL parameters, in a fixed order, omitting defaults (sort=newest, page=1). */
export function toSearchParams(state: CatalogState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.category) params.set('category', state.category);
  if (state.size) params.set('size', state.size);
  if (state.color) params.set('color', state.color);
  if (state.inStock) params.set('availability', 'in-stock');
  if (state.sort !== 'newest') params.set('sort', state.sort);
  if (state.q) params.set('q', state.q);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

/** `path` with the state's parameters. */
export function catalogHref(path: CatalogPath, state: CatalogState): string {
  const query = toSearchParams(state).toString();
  return query ? `${path}?${query}` : path;
}

/** The same view on another page (keeps search, filters, and sort). */
export function pageHref(path: CatalogPath, state: CatalogState, page: number): string {
  return catalogHref(path, { ...state, page });
}

/** The view with one filter, the sort, or the search changed: always back to page 1. */
export function changeHref(
  path: CatalogPath,
  state: CatalogState,
  change: Partial<Omit<CatalogState, 'page'>>,
): string {
  return catalogHref(path, { ...state, ...change, page: 1 });
}

/** Whether any filter (category, size, color, in stock) is set. */
export function hasFilters(state: CatalogState): boolean {
  return Boolean(state.category || state.size || state.color || state.inStock);
}

/** The view without filters, keeping the sort (and search): page 1. */
export function clearFiltersHref(path: CatalogPath, state: CatalogState): string {
  return changeHref(path, state, {
    category: undefined,
    size: undefined,
    color: undefined,
    inStock: false,
  });
}
