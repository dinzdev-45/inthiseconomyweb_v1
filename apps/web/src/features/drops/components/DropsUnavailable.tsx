'use client';

import { usePathname } from 'next/navigation';

import { cta } from '@/components/cta';

/** Error boundary content for drop pages: a friendly message and a retry link, no details. */
export function DropsUnavailable() {
  const pathname = usePathname();
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-24 md:px-8 md:py-40">
      <h1 className="text-title font-black uppercase font-stretch-expanded">Drops unavailable</h1>
      <p className="mt-4 max-w-md text-stone">
        We couldn’t load drops right now. Please try again in a moment.
      </p>
      <a href={pathname} className={`mt-10 ${cta.outline}`}>
        Try again
      </a>
    </section>
  );
}
