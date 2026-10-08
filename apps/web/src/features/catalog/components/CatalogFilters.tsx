import type { StoreCatalogFilters } from '@ite/contracts';

import type { CatalogState } from '../url-state.ts';

export const SORT_OPTIONS = [
  // Newest is the default: an empty value keeps it out of the URL.
  { value: '', label: 'Newest' },
  { value: 'price-asc', label: 'Price, low to high' },
  { value: 'price-desc', label: 'Price, high to low' },
] as const;

const field = 'mt-1 block w-full border border-ink/40 bg-paper px-3 py-2 text-sm';
const label = 'block text-label uppercase';

/**
 * Filters and sort for /shop (storefront-catalog design D8): a plain GET form, so it works
 * without client JavaScript; submitting drops `page`, so results restart at page 1. Below
 * 1024 px it sits in a closed "Filter and sort" disclosure; from 1024 px it is always shown.
 */
export function CatalogFilters({
  state,
  options,
}: {
  state: CatalogState;
  options: StoreCatalogFilters;
}) {
  return (
    <details className="catalog-filters border-y border-line lg:border-0" data-filters>
      <summary className="cursor-pointer py-3 text-label uppercase">Filter and sort</summary>
      <form action="/shop" method="get" className="grid gap-5 pt-2 pb-6 lg:pt-0">
        <fieldset>
          <legend className="sr-only">Filter products</legend>
          <div className="grid gap-4">
            <label className={label}>
              Category
              <select name="category" defaultValue={state.category ?? ''} className={field}>
                <option value="">All categories</option>
                {options.categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name} ({category.productCount})
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Size
              <select name="size" defaultValue={state.size ?? ''} className={field}>
                <option value="">All sizes</option>
                {options.sizes.map((size) => (
                  <option key={size.code} value={size.code}>
                    {size.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Color
              <select name="color" defaultValue={state.color ?? ''} className={field}>
                <option value="">All colors</option>
                {options.colors.map((color) => (
                  <option key={color.slug} value={color.slug}>
                    {color.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="availability"
                value="in-stock"
                defaultChecked={state.inStock}
                className="size-4 accent-ink"
              />
              In stock only
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend className="sr-only">Sort products</legend>
          <label className={label}>
            Sort by
            <select
              name="sort"
              defaultValue={state.sort === 'newest' ? '' : state.sort}
              className={field}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <button
          type="submit"
          className="justify-self-start bg-ink px-6 py-3 text-label text-paper uppercase hover:bg-brand-dark"
        >
          Apply
        </button>
      </form>
    </details>
  );
}
