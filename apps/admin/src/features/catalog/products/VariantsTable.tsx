import type { ProductVariant } from '@ite/contracts';
import type { ReactNode } from 'react';

import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { StatusBadge } from '../shared/StatusBadge';

/**
 * The product's variants with effective price and stock. Read-only by default; the variant
 * manager passes `stock` (a stock cell with the adjuster) and `actions` (a row actions cell)
 * so both views share one table.
 */
export function VariantsTable({
  variants,
  stock,
  actions,
}: {
  variants: ProductVariant[];
  stock?: (variant: ProductVariant) => ReactNode;
  actions?: (variant: ProductVariant) => ReactNode;
}) {
  if (variants.length === 0) return <EmptyState title="No variants yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Variants</caption>
        <thead className="border-b border-line text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3">
              SKU
            </th>
            <th scope="col" className="pr-3">
              Size
            </th>
            <th scope="col" className="pr-3">
              Color
            </th>
            <th scope="col" className="pr-3 text-right">
              Price
            </th>
            <th scope="col" className={`pr-3 ${stock ? '' : 'text-right'}`}>
              Stock
            </th>
            <th scope="col" className="pr-3">
              Status
            </th>
            {actions ? (
              <th scope="col" className="text-right">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {variants.map((variant) => (
            <tr
              key={variant.id}
              className="border-b border-line align-top"
              data-testid={`variant-row-${variant.sku}`}
            >
              <td className="py-2 pr-3 font-mono">{variant.sku}</td>
              <td className="py-2 pr-3">{variant.size.code}</td>
              <td className="py-2 pr-3">{variant.color.name}</td>
              <td className="py-2 pr-3 text-right">
                <MoneyText value={variant.effectivePrice} />
                {variant.priceOverride ? (
                  <span className="block text-xs text-muted">override</span>
                ) : null}
              </td>
              {stock ? (
                <td className="py-2 pr-3">{stock(variant)}</td>
              ) : (
                <td className="py-2 pr-3 text-right tabular-nums">{variant.stockQuantity}</td>
              )}
              <td className="py-2 pr-3">
                <StatusBadge status={variant.status} />
              </td>
              {actions ? <td className="py-2 text-right">{actions(variant)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
