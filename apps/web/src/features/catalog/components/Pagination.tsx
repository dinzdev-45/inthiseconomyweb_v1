import Link from 'next/link';

import { pageHref, type CatalogPath, type CatalogState } from '../url-state.ts';

/** Page numbers to show: first, last, and the current page ±2, with null for a gap of 2+ pages. */
export function pageWindow(current: number, total: number): (number | null)[] {
  const pages = new Set([1, total]);
  for (let page = current - 2; page <= current + 2; page++) {
    if (page >= 1 && page <= total) pages.add(page);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, index) => {
    const gap = index > 0 ? page - sorted[index - 1]! - 1 : 0;
    // A gap of one page shows that page; an ellipsis stands for two or more.
    if (gap === 1) return [page - 1, page];
    return gap > 1 ? [null, page] : [page];
  });
}

const item = 'inline-flex min-w-11 items-center justify-center px-3 py-2 text-sm';

/**
 * Numbered pagination (design D8): Previous, windowed page numbers with the current page marked
 * `aria-current="page"`, and Next. Every link keeps the search, filters, and sort.
 */
export function Pagination({
  path,
  state,
  totalPages,
}: {
  path: CatalogPath;
  state: CatalogState;
  totalPages: number;
}) {
  if (totalPages <= 1 || state.page > totalPages) return null;
  const { page } = state;
  return (
    <nav aria-label="Pagination" className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <li>
            <Link
              href={pageHref(path, state, page - 1)}
              className={`${item} underline-offset-4 hover:underline`}
            >
              Previous
            </Link>
          </li>
        ) : null}
        {pageWindow(page, totalPages).map((number, index) =>
          number === null ? (
            <li key={`gap-${index}`} aria-hidden="true" className={`${item} text-stone`}>
              …
            </li>
          ) : (
            <li key={number}>
              <Link
                href={pageHref(path, state, number)}
                aria-label={`Page ${number}`}
                aria-current={number === page ? 'page' : undefined}
                className={`${item} ${number === page ? 'bg-ink text-paper' : 'hover:underline'}`}
              >
                {number}
              </Link>
            </li>
          ),
        )}
        {page < totalPages ? (
          <li>
            <Link
              href={pageHref(path, state, page + 1)}
              className={`${item} underline-offset-4 hover:underline`}
            >
              Next
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
