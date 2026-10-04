import type { Media, ProductSummary } from '../catalog/types.ts';
import type { DropSummary } from '../drops/types.ts';

export type Link = { label: string; href: string };

/** An editorial visual: a real image when available, otherwise a captioned placeholder. */
export type Visual = {
  image: Media | null;
  /** Shown on the placeholder only, e.g. "CAMPAIGN IMAGE". */
  placeholderLabel: string;
};

/** A product in a look. `position` (percent of the look image) is reserved for future hotspots. */
export type LookItem = {
  product: ProductSummary;
  position: { x: number; y: number } | null;
};

/** Everything the homepage renders, in section order. */
export type HomeContent = {
  hero: {
    headline: string;
    collection: string;
    campaign: string;
    supportingLine: string;
    cta: Link;
    visual: Visual;
  };
  /** null when there is no drop to feature; the section is then omitted. */
  drop: DropSummary | null;
  featured: { heading: string; products: ProductSummary[]; cta: Link };
  campaign: { title: string; copy: string; visual: Visual };
  look: { heading: string; visual: Visual; items: LookItem[]; cta: Link };
  newArrivals: { heading: string; products: ProductSummary[] };
  lookbook: { heading: string; visuals: Visual[]; cta: Link };
  manifesto: { headline: string; copy: string; cta: Link };
  newsletter: { heading: string; copy: string };
};
