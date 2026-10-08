import Link from 'next/link';

import { cta } from '@/components/cta';

import type { CatalogPage } from '../server/catalog.ts';
import { pageHref, type CatalogState } from '../url-state.ts';
import { SORT_OPTIONS } from './CatalogFilters.tsx';
import { CatalogGrid } from './CatalogGrid.tsx';
import { IgnoredNotice } from './IgnoredNotice.tsx';
import { Pagination } from './Pagination.tsx';
import { ResultCount } from './ResultCount.tsx';

type SearchViewProps = {
  state: CatalogState;
  ignored: boolean;
  /** null when there is no query (nothing was requested). */
  page: CatalogPage | null;
};

/** /search: a labelled search box (search landmark) with sort, then results and pagination. */
export function SearchView({ state, ignored, page }: SearchViewProps) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-16">
      <h1 className="text-title font-black uppercase font-stretch-expanded">Search</h1>
      <search className="mt-6 block">
        <form action="/search" method="get" className="flex flex-wrap items-end gap-3">
          <label className="block min-w-0 flex-1 basis-64 text-label uppercase">
            Search products
            <input
              type="search"
              name="q"
              defaultValue={state.q ?? ''}
              maxLength={100}
              className="mt-1 block w-full border border-ink/40 bg-paper px-3 py-2 text-base normal-case"
            />
          </label>
          <label className="block text-label uppercase">
            Sort by
            <select
              name="sort"
              defaultValue={state.sort === 'newest' ? '' : state.sort}
              className="mt-1 block border border-ink/40 bg-paper px-3 py-2 text-sm normal-case"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="bg-ink px-6 py-2.5 text-label text-paper uppercase hover:bg-brand-dark"
          >
            Search
          </button>
        </form>
      </search>
      {ignored ? <IgnoredNotice /> : null}

      <div className="mt-10">
        {page === null || !state.q ? (
          <p className="text-stone" data-state="invitation">
            Search the catalog by product name.
          </p>
        ) : page.totalItems === 0 ? (
          <div data-state="no-results">
            <p className="text-stone">Nothing matched “{state.q}”.</p>
            <Link href="/shop" className={`mt-6 ${cta.outline}`}>
              Browse the shop
            </Link>
          </div>
        ) : page.products.length === 0 ? (
          <div data-state="beyond-last-page">
            <p className="text-stone">There are no products on page {state.page}.</p>
            <Link href={pageHref('/search', state, 1)} className={`mt-6 ${cta.outline}`}>
              Go to page 1
            </Link>
          </div>
        ) : (
          <>
            <ResultCount count={page.totalItems} />
            <div className="mt-6">
              <CatalogGrid products={page.products} />
            </div>
            <Pagination path="/search" state={state} totalPages={page.totalPages} />
          </>
        )}
      </div>
    </section>
  );
}
