import { Id, ProductStatus } from '@ite/contracts';

/*
 * The product list's state lives in the URL (design D8): search, filters, and the API's opaque
 * cursor. These helpers read it from search params and build links; the cursor is passed
 * through untouched, never decoded or edited.
 */

export const PRODUCTS_PATH = '/catalog/products';

export type ProductListState = {
  q?: string;
  status?: ProductStatus;
  categoryId?: string;
  cursor?: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Reads the list state from page search params. Values the API would reject (an unknown status,
 * a malformed category id, an over-long search) are dropped, so a hand-edited URL shows the
 * unfiltered list instead of an error. The cursor is kept as given; the API judges it.
 */
export function parseListState(params: SearchParams): ProductListState {
  const state: ProductListState = {};
  const q = first(params.q)?.trim();
  if (q && q.length <= 120) state.q = q;
  const status = ProductStatus.safeParse(first(params.status));
  if (status.success) state.status = status.data;
  const categoryId = Id.safeParse(first(params.categoryId));
  if (categoryId.success) state.categoryId = categoryId.data;
  const cursor = first(params.cursor);
  if (cursor) state.cursor = cursor;
  return state;
}

/** A link to the list with `state`; keys are written in a stable order. */
export function listHref(state: ProductListState): string {
  const query = new URLSearchParams();
  if (state.q) query.set('q', state.q);
  if (state.status) query.set('status', state.status);
  if (state.categoryId) query.set('categoryId', state.categoryId);
  if (state.cursor) query.set('cursor', state.cursor);
  return query.size > 0 ? `${PRODUCTS_PATH}?${query}` : PRODUCTS_PATH;
}

/** The next page: same search and filters, the API's `nextCursor`. */
export function nextPageHref(state: ProductListState, nextCursor: string): string {
  return listHref({ ...withoutCursor(state), cursor: nextCursor });
}

/** The first page with the same search and filters. */
export function firstPageHref(state: ProductListState): string {
  return listHref(withoutCursor(state));
}

/** The same filters without the search text (first page). */
export function clearSearchHref(state: ProductListState): string {
  const { q: _q, ...rest } = withoutCursor(state);
  return listHref(rest);
}

/** Whether a search or filter narrows the list (an empty result then means "no matches"). */
export function isFiltered(state: ProductListState): boolean {
  return Boolean(state.q || state.status || state.categoryId);
}

function withoutCursor({ cursor: _cursor, ...rest }: ProductListState): ProductListState {
  return rest;
}
