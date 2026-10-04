import Link from 'next/link';

import { cta } from '@/components/cta';
import { MediaFrame } from '@/components/MediaFrame';
import { formatMoney } from '@/lib/format-money';

import type { HomeContent } from '../types.ts';
import { SectionHeader } from './SectionHeader.tsx';

/**
 * A look image beside its two or three items (spec: Shop the look preview).
 * Item positions are kept as data attributes for future hotspots; nothing on
 * the image is interactive in this change.
 */
export function ShopTheLookPreview({ look }: { look: HomeContent['look'] }) {
  return (
    <section aria-labelledby="look-heading" className="mx-auto max-w-[1600px] px-4 md:px-8">
      <SectionHeader id="look-heading" title={look.heading} />
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-6">
        <div data-look-image className="lg:col-span-7">
          <MediaFrame
            image={look.visual.image}
            ratio={4 / 5}
            sizes="(min-width: 1024px) 58vw, 100vw"
            placeholderLabel={look.visual.placeholderLabel}
          />
        </div>
        <div className="flex flex-col justify-between gap-10 lg:col-span-4 lg:col-start-9">
          <ol className="divide-y divide-line border-y border-line">
            {look.items.map(({ product, position }, index) => (
              <li
                key={product.slug}
                {...(position
                  ? { 'data-position-x': position.x, 'data-position-y': position.y }
                  : {})}
              >
                <Link
                  href={`/products/${product.slug}`}
                  className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-3 py-5"
                >
                  <span aria-hidden="true" className="text-label text-brand-dark">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold uppercase">{product.name}</span>
                    <span className="block text-sm text-ink/70">{product.color}</span>
                  </span>
                  <span className="text-sm font-semibold text-brand-dark tabular-nums">
                    {formatMoney(product.price)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <Link href={look.cta.href} className={`self-start ${cta.outline}`}>
            {look.cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
