import type { Metadata } from 'next';

import { catalogHref, type CatalogState } from './url-state.ts';

/*
 * Catalog SEO (storefront-catalog design D9). Canonical URLs are root-relative here and become
 * absolute through the root layout's `metadataBase` (SITE_URL). Only /shop, its pages, and
 * single-category views (with their pages) are indexable.
 */

const SHOP_DESCRIPTION =
  'Shop every InThisEconomy piece in stock now: tees, hoodies, outerwear, and more.';

/** Whether a shop view adds anything beyond category and page (then it is not indexed). */
function isRefinedView(state: CatalogState): boolean {
  return Boolean(state.size || state.color || state.inStock || state.sort !== 'newest');
}

/** /shop metadata. `categoryName` names the filtered category when it exists. */
export function shopMetadata(state: CatalogState, categoryName?: string): Metadata {
  const canonicalState: CatalogState = {
    inStock: false,
    sort: 'newest',
    page: state.page,
    ...(state.category ? { category: state.category } : {}),
  };
  const pageSuffix = state.page > 1 ? ` · Page ${state.page}` : '';
  const title = state.category && categoryName ? `${categoryName} · Shop` : 'Shop';
  return {
    title: `${title}${pageSuffix}`,
    description:
      state.category && categoryName
        ? `Shop ${categoryName.toLowerCase()} from InThisEconomy.`
        : SHOP_DESCRIPTION,
    alternates: { canonical: catalogHref('/shop', canonicalState) },
    ...(isRefinedView(state) ? { robots: { index: false, follow: true } } : {}),
  };
}

/** /search is never indexed. */
export function searchMetadata(state: CatalogState): Metadata {
  return {
    title: state.q ? `Search: ${state.q}` : 'Search',
    description: 'Search the InThisEconomy catalog by product name.',
    robots: { index: false, follow: true },
  };
}
