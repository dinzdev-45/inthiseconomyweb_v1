import Link from 'next/link';

import { cta } from '@/components/cta';
import type { HomeContent } from '../types.ts';

/**
 * Brand manifesto on Brand Brown (spec: Brand manifesto). Cream on Brand Brown is 3.76:1,
 * so all text here is large (headline, 24 px+ copy); the CTA is a cream button with a
 * Near Black label (15.2:1).
 */
export function Manifesto({ manifesto }: { manifesto: HomeContent['manifesto'] }) {
  return (
    <section aria-labelledby="manifesto-heading" className="bg-brand text-cream">
      <div className="mx-auto max-w-[1600px] px-4 py-24 md:px-8 md:py-40">
        <h2
          id="manifesto-heading"
          className="text-[clamp(2.75rem,13.5vw,11rem)] leading-[0.86] font-black tracking-[-0.035em] uppercase lg:font-stretch-expanded lg:text-[clamp(4rem,9.5vw,11rem)]"
        >
          {manifesto.headline}
        </h2>
        <p className="mt-8 max-w-xl text-title">{manifesto.copy}</p>
        <Link href={manifesto.cta.href} className={`mt-12 ${cta.inverse}`}>
          {manifesto.cta.label}
        </Link>
      </div>
    </section>
  );
}
