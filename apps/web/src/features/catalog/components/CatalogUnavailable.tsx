'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { cta } from '@/components/cta';

/**
 * Error boundary content for catalog routes (storefront-catalog design D5): a friendly message
 * and a retry link to the same view, inside the root layout (header and footer stay). Never
 * shows error details. A plain link, so retrying works without client JavaScript.
 */
export function CatalogUnavailable() {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-24 md:px-8 md:py-40">
      <h1 className="text-title font-black uppercase font-stretch-expanded">Catalog unavailable</h1>
      <p className="mt-4 max-w-md text-stone">
        We couldn’t load the products right now. Please try again in a moment.
      </p>
      <a href={query ? `${pathname}?${query}` : pathname} className={`mt-10 ${cta.outline}`}>
        Try again
      </a>
    </section>
  );
}
