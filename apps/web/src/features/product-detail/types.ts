import type { Money, StoreAvailability } from '@ite/contracts';

import type { Media } from '@/features/catalog';

/** A gallery image: allowed to load (see `isAllowedImage`) and tagged with its color, if any. */
export type GalleryImage = Media & { color: string | null };

export type DetailVariant = {
  size: { code: string; label: string };
  color: { slug: string; name: string; hex: string | null };
  price: Money;
  availability: StoreAvailability;
};

/**
 * What the product detail page needs: a view model local to the storefront, mapped from the
 * store API's product detail by `server/mapper.ts`.
 */
export type ProductDetail = {
  slug: string;
  name: string;
  category: { slug: string; name: string };
  description: string | null;
  /** Lowest and highest price among the product's variants. */
  price: { min: Money; max: Money };
  availability: StoreAvailability;
  /** In display order; images on hosts that are not allowed are left out. */
  images: GalleryImage[];
  /** By size display order, then color name (as the API orders them). */
  variants: DetailVariant[];
  /** When the product's drop releases (ISO 8601), or null once released or in no drop. */
  releaseAt: string | null;
  /** The published drop the product belongs to, if any. */
  drop: { slug: string; title: string } | null;
};
