import type { Metadata } from 'next';

import { parseCatalogState, searchMetadata, SearchView } from '@/features/catalog';
import { getCatalogPage } from '@/features/catalog/server/catalog';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return searchMetadata(parseCatalogState('/search', await searchParams).state);
}

/** Name search over the catalog. Without a query nothing is requested or listed. */
export default async function SearchPage({ searchParams }: Props) {
  const { state, ignored } = parseCatalogState('/search', await searchParams);
  const page = state.q ? (await getCatalogPage(state)).page : null;
  return <SearchView state={state} ignored={ignored} page={page} />;
}
