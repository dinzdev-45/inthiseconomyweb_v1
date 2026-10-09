import { MediaFrame } from '@/components/MediaFrame';
import { formatReleaseDate, formatReleaseDateTime } from '@/lib/release-date';

import type { DropSummary } from '../types.ts';
import { Countdown } from './Countdown.tsx';

const LABEL: Record<DropSummary['status'], string> = {
  upcoming: 'Upcoming',
  live: 'Now live',
  past: 'Past drop',
};

/**
 * A drop's image, collection, title, and status (storefront-drops spec): upcoming shows the release
 * time in WIB (inside `<time>`, readable without JavaScript) and the countdown.
 */
export function DropHero({
  drop,
  headingLevel: Heading = 'h1',
  description,
}: {
  drop: DropSummary;
  headingLevel?: 'h1' | 'h2';
  description?: string | null;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10" data-drop-status={drop.status}>
      <div className="lg:col-span-7">
        <MediaFrame
          image={drop.image}
          ratio={4 / 3}
          sizes="(min-width: 1024px) 58vw, 100vw"
          placeholderLabel={`${drop.collection} — ${drop.title}`}
          priority={Heading === 'h1'}
        />
      </div>
      <div className="flex flex-col gap-6 lg:col-span-5">
        <p className="text-label text-brand-dark uppercase" data-drop-label>
          {LABEL[drop.status]}
        </p>
        <Heading className="font-black uppercase font-stretch-expanded break-words">
          <span className="block text-label text-stone">{drop.collection}</span>{' '}
          <span className="mt-2 block text-title">{drop.title}</span>
        </Heading>
        {description ? (
          <p className="max-w-prose text-sm whitespace-pre-line">{description}</p>
        ) : null}
        {drop.status === 'upcoming' ? (
          <>
            <p className="text-sm">
              Releases <time dateTime={drop.startsAt}>{formatReleaseDateTime(drop.startsAt)}</time>
            </p>
            <Countdown releaseAt={drop.startsAt} />
          </>
        ) : (
          <p className="text-sm text-stone">
            Released <time dateTime={drop.startsAt}>{formatReleaseDate(drop.startsAt)}</time>
          </p>
        )}
      </div>
    </div>
  );
}
