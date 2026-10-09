import Link from 'next/link';

import { cta } from '@/components/cta';

import type { DropsOverview } from '../server/drops.ts';
import { DropHero } from './DropHero.tsx';

/** /drops: the next upcoming drop (with countdown), or else the current live drop. */
export function DropsView({ overview }: { overview: DropsOverview }) {
  const featured = overview.upcoming[0] ?? overview.current;
  const liveToo = overview.upcoming[0] && overview.current ? overview.current : null;
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-16">
      <h1 className="sr-only">Drops</h1>
      {featured ? (
        <>
          <DropHero drop={featured} headingLevel="h2" />
          <Link href={`/drops/${featured.slug}`} className={`mt-10 ${cta.primary}`}>
            {featured.status === 'upcoming' ? 'Preview the drop' : 'Explore the collection'}
          </Link>
        </>
      ) : (
        <div data-state="none">
          <p className="text-title font-black uppercase font-stretch-expanded">
            The first drop is coming
          </p>
          <p className="mt-4 max-w-md text-stone">
            Until then, everything in stock is in the shop.
          </p>
          <Link href="/shop" className={`mt-8 ${cta.outline}`}>
            Browse the shop
          </Link>
        </div>
      )}
      {liveToo || overview.archive.length > 0 ? (
        <nav
          aria-label="More drops"
          className="mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-6 text-sm"
        >
          {liveToo ? (
            <Link href={`/drops/${liveToo.slug}`} className="underline underline-offset-4">
              Now live: {liveToo.title}
            </Link>
          ) : null}
          {overview.archive.length > 0 ? (
            <Link href="/drops/archive" className="underline underline-offset-4">
              Drop archive
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
