import Link from 'next/link';

import { cta } from '@/components/cta';
import { formatMoney } from '@/lib/format-money';

import type { ProductSummary } from '../types.ts';

/**
 * /products/<slug> until product detail exists: name, price (or range), "Sold out", a note that
 * details are coming, and a way back. No size selection or cart controls.
 */
export function ProductPlaceholder({ product }: { product: ProductSummary }) {
  const { name, price, priceMax, availability } = product;
  const priceText =
    priceMax && priceMax.amount !== price.amount
      ? `${formatMoney(price)} – ${formatMoney(priceMax)}`
      : formatMoney(price);
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-16 md:px-8 md:py-24">
      <h1 className="text-title font-black uppercase font-stretch-expanded">{name}</h1>
      <p className="mt-4 text-lg font-semibold text-brand-dark tabular-nums">{priceText}</p>
      {availability === 'SOLD_OUT' ? (
        <p className="mt-2 text-label text-ink uppercase">Sold out</p>
      ) : null}
      <p className="mt-6 max-w-md text-stone">Full product details are coming soon.</p>
      <Link href="/shop" className={`mt-10 ${cta.outline}`}>
        Back to the shop
      </Link>
    </section>
  );
}
