'use client';

import { cta } from '@/components/cta';

/** Error boundary content for /cart: a friendly message and a retry link, never error details. */
export function CartUnavailable() {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-24 md:px-8 md:py-40">
      <h1 className="text-title font-black uppercase font-stretch-expanded">Cart unavailable</h1>
      <p className="mt-4 max-w-md text-stone">
        We couldn’t load your cart right now. Please try again in a moment.
      </p>
      <a href="/cart" className={`mt-10 ${cta.outline}`}>
        Try again
      </a>
    </section>
  );
}
