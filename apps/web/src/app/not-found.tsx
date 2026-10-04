import Link from 'next/link';

import { cta } from '@/components/cta';
/** Shown for unknown routes and for planned pages that are not built yet; header and footer stay. */
export default function NotFound() {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-24 md:px-8 md:py-40">
      <p aria-hidden="true" className="text-hero font-black text-sand font-stretch-expanded">
        404
      </p>
      <h1 className="mt-6 text-title font-black uppercase font-stretch-expanded">Page not found</h1>
      <p className="mt-4 max-w-md text-stone">
        This page doesn’t exist yet, or it has moved. The drop is still on.
      </p>
      <Link href="/" className={`mt-10 ${cta.outline}`}>
        Back to the homepage
      </Link>
    </section>
  );
}
