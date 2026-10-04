'use client';

import { cta } from '@/components/cta';

/**
 * Shown when rendering fails, e.g. the API is unreachable. Never displays error
 * details; header and footer stay (they belong to the root layout).
 */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-24 md:px-8 md:py-40">
      <h1 className="text-title font-black uppercase font-stretch-expanded">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-md text-stone">
        The store is temporarily unavailable. Please try again shortly.
      </p>
      <button type="button" onClick={reset} className={`mt-10 ${cta.outline}`}>
        Try again
      </button>
    </section>
  );
}
