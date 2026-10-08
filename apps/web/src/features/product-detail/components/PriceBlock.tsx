import { formatMoney } from '@/lib/format-money';

import type { Selection } from '../selection.ts';

/** The selected variant's price and availability, or the color's price ("From" for a range). */
export function PriceBlock({ selection }: { selection: Selection }) {
  const { price, availability, soldOut } = selection;
  const status = availability ?? (soldOut ? 'SOLD_OUT' : null);
  return (
    <div className="mt-4" data-price-block>
      <p className="text-lg font-semibold text-brand-dark tabular-nums">
        {price.from ? `From ${formatMoney(price.amount)}` : formatMoney(price.amount)}
      </p>
      {status ? (
        <p className="mt-1 text-label uppercase" data-availability>
          {status === 'IN_STOCK' ? 'In stock' : 'Sold out'}
        </p>
      ) : null}
    </div>
  );
}
