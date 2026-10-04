import type { HomeContent } from '../types.ts';
import { NewsletterForm } from './NewsletterForm.tsx';

/** Homepage newsletter section (spec: Frontend-only newsletter form). */
export function NewsletterSection({ newsletter }: { newsletter: HomeContent['newsletter'] }) {
  return (
    <section aria-labelledby="newsletter-heading" className="mx-auto max-w-[1600px] px-4 md:px-8">
      <div className="grid gap-8 border-t border-line pt-6 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-6">
          <h2
            id="newsletter-heading"
            className="text-title font-black uppercase font-stretch-expanded"
          >
            {newsletter.heading}
          </h2>
          <p className="mt-4 max-w-md text-stone">{newsletter.copy}</p>
        </div>
        <div className="min-w-0 lg:col-span-5 lg:col-start-8">
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}
