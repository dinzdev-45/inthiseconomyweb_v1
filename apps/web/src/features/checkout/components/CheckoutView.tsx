import type { CheckoutSummary } from '@ite/contracts';
import Link from 'next/link';

import { cta } from '@/components/cta';

import { CheckoutForm } from './CheckoutForm.tsx';
import { OrderSummary } from './OrderSummary.tsx';

/** /checkout: the details form next to the summary, or why there is nothing to check out. */
export function CheckoutView({ summary }: { summary: CheckoutSummary | null }) {
  return (
    <section className="mx-auto max-w-[1100px] px-4 py-10 md:px-8 md:py-16">
      <h1 className="text-title font-black uppercase font-stretch-expanded">Checkout</h1>
      {!summary || summary.lines.length === 0 ? (
        <div className="mt-8" data-state="nothing">
          <p className="text-stone">There’s nothing to check out yet.</p>
          <Link href="/shop" className={`mt-8 ${cta.outline}`}>
            Browse the shop
          </Link>
        </div>
      ) : !summary.ready ? (
        <div className="mt-8" data-state="attention">
          <p>Some items in your cart need attention before you can check out:</p>
          <ul className="mt-3 list-disc pl-5 text-sm">
            {summary.lines
              .filter((line) => line.status !== 'AVAILABLE')
              .map((line) => (
                <li key={line.id}>
                  {line.product.name} ({line.color.name}, {line.size.code}):{' '}
                  {line.status === 'UNAVAILABLE' ? 'no longer available' : 'not enough stock'}
                </li>
              ))}
          </ul>
          <Link href="/cart" className={`mt-8 ${cta.outline}`}>
            Review your cart
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <CheckoutForm expectedTotal={summary.total} />
          <div className="lg:order-last">
            <OrderSummary summary={summary} />
          </div>
        </div>
      )}
    </section>
  );
}
