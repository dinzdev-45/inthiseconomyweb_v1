import type { StoreCatalogFilters } from '@ite/contracts';
import Link from 'next/link';

import { cta } from '@/components/cta';

import type { CatalogPage } from '../server/catalog.ts';
import { clearFiltersHref, hasFilters, pageHref, type CatalogState } from '../url-state.ts';
import { ActiveFilters } from './ActiveFilters.tsx';
import { CatalogFilters } from './CatalogFilters.tsx';
import { CatalogGrid } from './CatalogGrid.tsx';
import { IgnoredNotice } from './IgnoredNotice.tsx';
import { Pagination } from './Pagination.tsx';
import { ResultCount } from './ResultCount.tsx';

type ShopViewProps = {
  state: CatalogState;
  ignored: boolean;
  page: CatalogPage;
  filters: StoreCatalogFilters;
};

/** /shop: heading, count, filters and sort, active filters, the grid, and pagination. */
export function ShopView({ state, ignored, page, filters }: ShopViewProps) {
  const filtered = hasFilters(state);
  const emptyCatalog = page.totalItems === 0 && !filtered;

  return (
    <section className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-title font-black uppercase font-stretch-expanded">Shop</h1>
        {emptyCatalog ? null : <ResultCount count={page.totalItems} />}
      </div>
      {ignored ? <IgnoredNotice /> : null}

      {emptyCatalog ? (
        <div className="mt-10" data-state="empty-catalog">
          <p className="max-w-md text-stone">There are no products yet. Check back soon.</p>
          <Link href="/" className={`mt-8 ${cta.outline}`}>
            Back to the homepage
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr] lg:gap-12">
          <aside aria-label="Filters and sort">
            <CatalogFilters state={state} options={filters} />
          </aside>
          <div className="min-w-0">
            <ActiveFilters state={state} options={filters} />
            <div className={filtered ? 'mt-6' : ''}>
              <Results state={state} page={page} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Results({ state, page }: { state: CatalogState; page: CatalogPage }) {
  if (page.totalItems === 0) {
    return (
      <div data-state="no-results">
        <p className="text-stone">No products match these filters.</p>
        <Link href={clearFiltersHref('/shop', state)} className={`mt-6 ${cta.outline}`}>
          Clear filters
        </Link>
      </div>
    );
  }
  if (page.products.length === 0) {
    return (
      <div data-state="beyond-last-page">
        <p className="text-stone">There are no products on page {state.page}.</p>
        <Link href={pageHref('/shop', state, 1)} className={`mt-6 ${cta.outline}`}>
          Go to page 1
        </Link>
      </div>
    );
  }
  return (
    <>
      <CatalogGrid products={page.products} />
      <Pagination path="/shop" state={state} totalPages={page.totalPages} />
    </>
  );
}
