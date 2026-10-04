import { MediaFrame } from '@/components/MediaFrame';

import type { HomeContent } from '../types.ts';

/** Full-bleed campaign visual with an editorial title plate (spec: Campaign banner). */
export function CampaignBanner({ campaign }: { campaign: HomeContent['campaign'] }) {
  return (
    <section aria-labelledby="campaign-heading" data-section="campaign" className="relative w-full">
      <MediaFrame
        image={campaign.visual.image}
        sizes="100vw"
        placeholderLabel={campaign.visual.placeholderLabel}
        className="aspect-[4/5] md:aspect-[21/9]"
      />
      <div className="mx-auto max-w-[1600px] px-4 md:absolute md:inset-x-0 md:bottom-0 md:px-8 md:pb-8">
        <div className="bg-paper py-8 md:inline-block md:max-w-xl md:px-8 md:py-10">
          <h2
            id="campaign-heading"
            className="text-display font-black uppercase font-stretch-expanded"
          >
            {campaign.title}
          </h2>
          <p className="mt-4 max-w-md text-base">{campaign.copy}</p>
        </div>
      </div>
    </section>
  );
}
