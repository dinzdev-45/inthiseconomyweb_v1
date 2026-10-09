import Link from 'next/link';

import { cta } from '@/components/cta';
import { MediaFrame } from '@/components/MediaFrame';

import { formatReleaseDate } from '@/lib/release-date';
import type { DropSummary } from '../types.ts';
import { Countdown } from './Countdown.tsx';

type DropFeatureProps = {
  /** The drop to feature; null renders nothing (the homepage omits the section). */
  drop: DropSummary | null;
  headingId?: string;
};

/**
 * Editorial feature for one drop (design D6). Live: "Now live" plus an explore
 * link. Upcoming: "Upcoming", the release date, and the live countdown (a client island) in
 * the reserved countdown area.
 */
export function DropFeature({ drop, headingId = 'drop-heading' }: DropFeatureProps) {
  if (!drop) return null;
  const live = drop.status === 'live';

  return (
    <section
      aria-labelledby={headingId}
      data-drop-status={drop.status}
      className="bg-ink text-cream"
    >
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <MediaFrame
            image={drop.image}
            ratio={4 / 3}
            sizes="(min-width: 1024px) 58vw, 100vw"
            placeholderLabel={`${drop.collection} — ${drop.title}`}
          />
        </div>

        <div className="flex flex-col justify-between gap-10 lg:col-span-5">
          <div>
            {/* Soft Brown label (9.34:1 on Near Black) with a Brand Brown marker or border. */}
            <p className="flex items-center gap-3 text-label text-soft uppercase">
              {live ? <span aria-hidden="true" className="size-2.5 bg-brand" /> : null}
              <span className={live ? '' : 'border border-brand px-2 py-1'}>
                {live ? 'Now live' : 'Upcoming'}
              </span>
            </p>
            <h2 id={headingId} className="mt-6 font-black uppercase font-stretch-expanded">
              <span className="block text-label text-sand">{drop.collection}</span>{' '}
              <span className="mt-2 block text-display text-cream">{drop.title}</span>
            </h2>
            {!live ? (
              <p className="mt-6 text-sm">
                Drops <time dateTime={drop.startsAt}>{formatReleaseDate(drop.startsAt)}</time>
              </p>
            ) : null}
          </div>

          {live ? (
            <Link href={`/drops/${drop.slug}`} className={`self-start ${cta.primary}`}>
              EXPLORE THE COLLECTION
            </Link>
          ) : (
            <div className="min-h-16 border-t border-brand pt-4">
              <Countdown releaseAt={drop.startsAt} tone="dark" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
