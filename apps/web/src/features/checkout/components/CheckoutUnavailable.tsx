'use client';

import { cta } from '@/components/cta';

/** Error boundary content for /checkout: a friendly message and a retry link, no details. */
export function CheckoutUnavailable() {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-24 md:px-8 md:py-40">
      <h1 className="text-title font-black uppercase font-stretch-expanded">
        Checkout unavailable
      </h1>
      <p className="mt-4 max-w-md text-stone">
        We couldn’t load checkout right now. Your cart is safe. Please try again in a moment.
      </p>
      <a href="/checkout" className={`mt-10 ${cta.outline}`}>
        Try again
      </a>
    </section>
  );
}
