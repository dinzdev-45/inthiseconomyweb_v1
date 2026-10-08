import type { StoreCatalogFilters } from '@ite/contracts';
import Link from 'next/link';

import { changeHref, clearFiltersHref, hasFilters, type CatalogState } from '../url-state.ts';

type Chip = { label: string; href: string };

/** The view's active filters as removable links, plus "Clear all". Nothing when none are set. */
export function ActiveFilters({
  state,
  options,
}: {
  state: CatalogState;
  options: StoreCatalogFilters;
}) {
  if (!hasFilters(state)) return null;
  const chips: Chip[] = [];
  if (state.category) {
    const name = options.categories.find((c) => c.slug === state.category)?.name;
    chips.push({
      label: `Category ${name ?? state.category}`,
      href: changeHref('/shop', state, { category: undefined }),
    });
  }
  if (state.size) {
    chips.push({
      label: `Size ${state.size}`,
      href: changeHref('/shop', state, { size: undefined }),
    });
  }
  if (state.color) {
    const name = options.colors.find((c) => c.slug === state.color)?.name;
    chips.push({
      label: `Color ${name ?? state.color}`,
      href: changeHref('/shop', state, { color: undefined }),
    });
  }
  if (state.inStock) {
    chips.push({ label: 'In stock only', href: changeHref('/shop', state, { inStock: false }) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-active-filters>
      <h2 className="sr-only">Active filters</h2>
      <ul className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.label}>
            <Link
              href={chip.href}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex items-center gap-2 border border-ink px-3 py-1.5 text-sm hover:bg-ink hover:text-paper"
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href={clearFiltersHref('/shop', state)}
        className="text-sm underline underline-offset-4"
      >
        Clear all
      </Link>
    </div>
  );
}
