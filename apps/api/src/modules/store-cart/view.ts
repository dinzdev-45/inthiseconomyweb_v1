import type { StoreCart } from '@ite/contracts';

import type { CartViewRow } from './repository.ts';

/**
 * Cart view rows as the customer-facing cart: line totals from current prices, and the item count
 * and subtotal over AVAILABLE lines only. Shared with checkout, so both price a cart the same way.
 */
export function toStoreCart(rows: CartViewRow[], storeCurrency: string): StoreCart {
  const lines = rows.map((row) => ({
    id: row.id,
    product: { slug: row.productSlug, name: row.productName, image: row.image },
    color: { slug: row.colorSlug, name: row.colorName },
    size: { code: row.sizeCode, label: row.sizeLabel },
    quantity: row.quantity,
    unitPrice: { amount: row.unitAmount, currency: row.currency },
    lineTotal: { amount: row.unitAmount * row.quantity, currency: row.currency },
    status: row.status,
  }));
  const counted = lines.filter((line) => line.status === 'AVAILABLE');
  return {
    lines,
    itemCount: counted.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: {
      amount: counted.reduce((sum, line) => sum + line.lineTotal.amount, 0),
      currency: storeCurrency,
    },
  };
}
