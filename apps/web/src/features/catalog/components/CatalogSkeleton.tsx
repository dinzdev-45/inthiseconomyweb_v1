import { MediaFrame } from '@/components/MediaFrame';

import { CATALOG_GRID } from './CatalogGrid.tsx';

/**
 * Loading state for catalog pages: placeholder cards with the final card dimensions (4:5 media
 * and two text lines), marked busy for assistive technology.
 */
export function CatalogSkeleton({ heading }: { heading: string }) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-16" aria-busy="true">
      <h1 className="text-title font-black uppercase font-stretch-expanded">{heading}</h1>
      <p className="mt-3 text-sm text-stone">Loading products…</p>
      <ul className={`mt-8 ${CATALOG_GRID}`} data-skeleton>
        {Array.from({ length: 8 }, (_, index) => (
          <li key={index} className="min-w-0">
            <MediaFrame image={null} ratio={4 / 5} sizes="25vw" />
            <div className="mt-3 h-4 w-3/4 bg-sand/60" />
            <div className="mt-2 h-4 w-1/3 bg-sand/40" />
          </li>
        ))}
      </ul>
    </section>
  );
}
