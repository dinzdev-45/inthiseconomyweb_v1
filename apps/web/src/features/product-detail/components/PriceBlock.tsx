import Link from 'next/link';

import { formatMoney } from '@/lib/format-money';
import { formatReleaseDateTime } from '@/lib/release-date';

import type { Selection } from '../selection.ts';
import type { ProductDetail } from '../types.ts';

type PriceBlockProps = {
  selection: Selection;
  releaseAt?: ProductDetail['releaseAt'];
  drop?: ProductDetail['drop'];
};

/**
 * The selected variant's price and availability, or the color's price ("From" for a range). An
 * unreleased product says when it releases, with a link to its drop, instead of its availability.
 */
export function PriceBlock({ selection, releaseAt = null, drop = null }: PriceBlockProps) {
  const { price, availability, soldOut } = selection;
  const status = availability ?? (soldOut ? 'SOLD_OUT' : null);
  return (
    <div className="mt-4" data-price-block>
      <p className="text-lg font-semibold text-brand-dark tabular-nums">
        {price.from ? `From ${formatMoney(price.amount)}` : formatMoney(price.amount)}
      </p>
      {releaseAt ? (
        <p className="mt-1 text-label uppercase" data-release>
          Releases <time dateTime={releaseAt}>{formatReleaseDateTime(releaseAt)}</time>
          {drop ? (
            <>
              {' · '}
              <Link href={`/drops/${drop.slug}`} className="underline underline-offset-4">
                {drop.title}
              </Link>
            </>
          ) : null}
        </p>
      ) : status ? (
        <p className="mt-1 text-label uppercase" data-availability>
          {status === 'IN_STOCK' ? 'In stock' : 'Sold out'}
        </p>
      ) : null}
    </div>
  );
}
