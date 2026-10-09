import Link from 'next/link';

import { MediaFrame } from '@/components/MediaFrame';
import { formatReleaseDate } from '@/lib/release-date';

import type { DropSummary } from '../types.ts';

/** /drops/archive: earlier drops, most recent first. */
export function ArchiveView({ drops }: { drops: DropSummary[] }) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-16">
      <h1 className="text-title font-black uppercase font-stretch-expanded">Drop archive</h1>
      {drops.length === 0 ? (
        <p className="mt-6 text-stone">There are no earlier drops yet.</p>
      ) : (
        <ul className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          {drops.map((drop) => (
            <li key={drop.slug} className="min-w-0">
              <Link href={`/drops/${drop.slug}`} className="group block">
                <MediaFrame
                  image={drop.image}
                  ratio={4 / 3}
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  placeholderLabel={drop.collection}
                />
                <p className="mt-3 text-label text-stone uppercase">{drop.collection}</p>
                <h2 className="mt-1 font-semibold uppercase group-hover:underline break-words">
                  {drop.title}
                </h2>
                <p className="mt-1 text-sm text-stone">
                  Released <time dateTime={drop.startsAt}>{formatReleaseDate(drop.startsAt)}</time>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
