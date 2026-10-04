'use client';

import type { ProductListItem } from '@ite/contracts';
import Link from 'next/link';
import { useState } from 'react';

import { EmptyState } from '../shared/EmptyState';
import { ErrorSummary } from '../shared/ErrorSummary';
import { MoneyText } from '../shared/MoneyText';
import { StatusBadge } from '../shared/StatusBadge';
import { SuccessMessage } from '../shared/SuccessMessage';
import { formatTimestamp } from '../shared/time';
import { useCatalogAction } from '../shared/useCatalogAction';
import { LIFECYCLE_LABEL, type LifecycleAction } from './lifecycle';
import { LifecycleActions } from './LifecycleActions';
import {
  firstPageHref,
  isFiltered,
  nextPageHref,
  PRODUCTS_PATH,
  type ProductListState,
} from './list-query';
import { ProductThumbnail } from './ProductThumbnail';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The stock summary from the API (ACTIVE variants only), in words. */
function StockSummary({ stock }: { stock: ProductListItem['stock'] }) {
  if (stock.activeVariantCount === 0) return <span className="text-muted">No active variants</span>;
  return (
    <span className="block space-y-0.5">
      <span className="block tabular-nums">
        {plural(stock.totalQuantity, 'unit', 'units')} in stock
      </span>
      <span className="block text-xs text-muted">
        {plural(stock.activeVariantCount, 'active variant', 'active variants')}
      </span>
      {stock.outOfStockVariantCount > 0 ? (
        <span className="block text-xs font-medium text-danger">
          {stock.outOfStockVariantCount} out of stock
        </span>
      ) : null}
    </span>
  );
}

/**
 * The product table (admin-products spec: Product list): one page from the API, with row
 * lifecycle actions for staff who can manage, and forward-only cursor pagination.
 */
export function ProductList({
  items,
  nextCursor,
  state,
  canManage,
}: {
  items: ProductListItem[];
  nextCursor: string | null;
  state: ProductListState;
  canManage: boolean;
}) {
  const rows = useCatalogAction();
  const [attempt, setAttempt] = useState<{ name: string; action: LifecycleAction } | null>(null);

  if (items.length === 0) {
    if (state.cursor) {
      return (
        <EmptyState
          title="No more products."
          action={{ href: firstPageHref(state), label: 'Back to the first page' }}
        />
      );
    }
    return isFiltered(state) ? (
      <EmptyState title="No products match this search and these filters.">
        Try a different search, or{' '}
        <Link href={PRODUCTS_PATH} className="underline">
          clear all filters
        </Link>
        .
      </EmptyState>
    ) : (
      <EmptyState
        title="No products yet."
        action={
          canManage
            ? { href: '/catalog/products/new', label: 'Create the first product' }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <SuccessMessage message={rows.success} />
      <ErrorSummary
        problem={rows.problem}
        summaryRef={rows.summaryRef}
        title={
          attempt
            ? `Could not ${LIFECYCLE_LABEL[attempt.action].toLowerCase()} “${attempt.name}”.`
            : undefined
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="sr-only">Products</caption>
          <thead className="border-b border-line text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3">
                <span className="sr-only">Image</span>
              </th>
              <th scope="col" className="pr-3">
                Product
              </th>
              <th scope="col" className="pr-3">
                Category
              </th>
              <th scope="col" className="pr-3">
                Status
              </th>
              <th scope="col" className="pr-3 text-right">
                Base price
              </th>
              <th scope="col" className="pr-3 text-right">
                Variants
              </th>
              <th scope="col" className="pr-3">
                Stock
              </th>
              <th scope="col" className="pr-3">
                Updated
              </th>
              {canManage ? (
                <th scope="col" className="text-right">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-line align-top"
                data-testid={`product-row-${item.slug}`}
              >
                <td className="py-2 pr-3">
                  <ProductThumbnail image={item.primaryImage} />
                </td>
                <td className="py-2 pr-3">
                  <Link
                    href={`/catalog/products/${item.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {item.name}
                  </Link>
                  <span className="block font-mono text-xs text-muted">{item.slug}</span>
                </td>
                <td className="py-2 pr-3">
                  {item.category.name}
                  {item.category.status === 'ARCHIVED' ? (
                    <span className="block text-xs text-muted">archived</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge status={item.status} />
                </td>
                <td className="py-2 pr-3 text-right">
                  <MoneyText value={item.basePrice} />
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{item.variantCount}</td>
                <td className="py-2 pr-3">
                  <StockSummary stock={item.stock} />
                </td>
                <td className="py-2 pr-3 text-muted">{formatTimestamp(item.updatedAt)}</td>
                {canManage ? (
                  <td className="py-2 text-right">
                    <LifecycleActions
                      product={item}
                      action={rows}
                      onStart={(action) => setAttempt({ name: item.name, action })}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state.cursor || nextCursor ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
          {state.cursor ? (
            <Link href={firstPageHref(state)} className="underline">
              First page
            </Link>
          ) : (
            <span />
          )}
          {nextCursor ? (
            <Link href={nextPageHref(state, nextCursor)} className="underline">
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
