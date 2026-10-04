import Link from 'next/link';

import { cta } from '@/components/cta';
import { MediaFrame } from '@/components/MediaFrame';

import type { HomeContent } from '../types.ts';
import { SectionHeader } from './SectionHeader.tsx';

const LAYOUT = [
  // Offset editorial stack: large lead image, then two smaller staggered frames.
  { cell: 'col-span-12 md:col-span-7', ratio: 4 / 5, sizes: '(min-width: 768px) 58vw, 100vw' },
  {
    cell: 'col-span-6 md:col-span-4 md:col-start-9 md:mt-32',
    ratio: 3 / 4,
    sizes: '(min-width: 768px) 33vw, 50vw',
  },
  {
    cell: 'col-span-6 mt-16 md:col-span-3 md:col-start-6 md:-mt-24',
    ratio: 2 / 3,
    sizes: '(min-width: 768px) 25vw, 50vw',
  },
] as const;

/** Photography-first lookbook preview (spec: Lookbook preview). */
export function LookbookPreview({ lookbook }: { lookbook: HomeContent['lookbook'] }) {
  return (
    <section aria-labelledby="lookbook-heading" className="mx-auto max-w-[1600px] px-4 md:px-8">
      <SectionHeader id="lookbook-heading" title={lookbook.heading} />
      <div className="grid grid-cols-12 gap-3 md:gap-6">
        {lookbook.visuals.slice(0, LAYOUT.length).map((visual, index) => {
          const layout = LAYOUT[index]!;
          return (
            <div key={visual.placeholderLabel} className={layout.cell}>
              <MediaFrame
                image={visual.image}
                ratio={layout.ratio}
                sizes={layout.sizes}
                placeholderLabel={visual.placeholderLabel}
              />
            </div>
          );
        })}
      </div>
      <Link href={lookbook.cta.href} className={`mt-12 ${cta.outline}`}>
        {lookbook.cta.label}
      </Link>
    </section>
  );
}
