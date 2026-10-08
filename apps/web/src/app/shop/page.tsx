import type { Metadata } from 'next';

import { parseCatalogState, shopMetadata, ShopView } from '@/features/catalog';
import { getCatalogFilters, getCatalogPage } from '@/features/catalog/server/catalog';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { state } = parseCatalogState('/shop', await searchParams);
  // Same cached request as the page's filter options (fetch memoization), for the category name.
  const filters = state.category ? await getCatalogFilters().catch(() => null) : null;
  const category = filters?.categories.find((c) => c.slug === state.category);
  return shopMetadata(state, category?.name);
}

/** The catalog: server-rendered from the URL; the browser never calls the API. */
export default async function ShopPage({ searchParams }: Props) {
  const { state, ignored } = parseCatalogState('/shop', await searchParams);
  const { page, filters } = await getCatalogPage(state, { withFilters: true });
  return <ShopView state={state} ignored={ignored} page={page} filters={filters!} />;
}
