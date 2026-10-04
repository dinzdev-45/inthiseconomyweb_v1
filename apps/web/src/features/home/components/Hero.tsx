import Link from 'next/link';

import { cta } from '@/components/cta';
import { MediaFrame } from '@/components/MediaFrame';

import type { HomeContent } from '../types.ts';

/**
 * Campaign hero (spec: Hero). Fills at least the viewport below the sticky
 * header. The copy sits on a solid paper plate, so it keeps AA contrast over
 * any future campaign photograph or video.
 */
export function Hero({ hero }: { hero: HomeContent['hero'] }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative flex min-h-[calc(100svh-var(--spacing-header))] flex-col justify-end"
    >
      <div className="absolute inset-0">
        <MediaFrame
          image={hero.visual.image}
          sizes="100vw"
          priority
          placeholderLabel={hero.visual.placeholderLabel}
          className="h-full"
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-4 pb-4 md:px-8 md:pb-8">
        <div className="bg-cream px-4 py-6 md:inline-block md:px-8 md:py-10">
          <h1
            id="hero-heading"
            className="text-[clamp(2.75rem,13.5vw,11rem)] leading-[0.86] font-black tracking-[-0.035em] uppercase lg:font-stretch-expanded lg:text-[clamp(4rem,9.5vw,11rem)]"
          >
            {hero.headline}
          </h1>
          <p className="mt-6 text-label uppercase">
            <span className="block text-brand-dark">{hero.collection}</span>{' '}
            <span className="block text-title font-black text-brand font-stretch-expanded">
              {hero.campaign}
            </span>
          </p>
          <p className="mt-4 max-w-sm text-base">{hero.supportingLine}</p>
          <Link href={hero.cta.href} className={`mt-8 ${cta.primary}`}>
            {hero.cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
