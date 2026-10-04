import { ProductGrid, ProductRail } from '@/features/catalog';
import { DropFeature } from '@/features/drops';

import type { HomeContent } from '../types.ts';
import { CampaignBanner } from './CampaignBanner.tsx';
import { Hero } from './Hero.tsx';
import { LookbookPreview } from './LookbookPreview.tsx';
import { Manifesto } from './Manifesto.tsx';
import { NewsletterSection } from './NewsletterSection.tsx';
import { SectionHeader } from './SectionHeader.tsx';
import { ShopTheLookPreview } from './ShopTheLookPreview.tsx';

/**
 * The homepage in spec order (spec: Homepage structure). Server Component;
 * only the newsletter form is a client island. The drop section is omitted
 * when there is no drop.
 */
export function HomeSections({ content }: { content: HomeContent }) {
  const { hero, drop, featured, campaign, look, newArrivals, lookbook, manifesto, newsletter } =
    content;

  return (
    <div className="space-y-24 pb-24 md:space-y-40 md:pb-40">
      <Hero hero={hero} />
      <DropFeature drop={drop} headingId="drop-heading" />

      {/* Featured products on a full-bleed Warm Cream band. */}
      <section aria-labelledby="featured-heading" className="bg-cream">
        <div className="mx-auto max-w-[1600px] px-4 py-16 md:px-8 md:py-24">
          <SectionHeader id="featured-heading" title={featured.heading} link={featured.cta} />
          <ProductGrid products={featured.products} />
        </div>
      </section>

      <CampaignBanner campaign={campaign} />
      <ShopTheLookPreview look={look} />

      <section
        aria-labelledby="new-arrivals-heading"
        className="mx-auto max-w-[1600px] px-4 md:px-8"
      >
        <SectionHeader id="new-arrivals-heading" title={newArrivals.heading} />
        <ProductRail products={newArrivals.products} />
      </section>

      <LookbookPreview lookbook={lookbook} />
      <Manifesto manifesto={manifesto} />
      <NewsletterSection newsletter={newsletter} />
    </div>
  );
}
