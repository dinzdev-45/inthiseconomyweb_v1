import type { Money } from '@ite/contracts';

/** An image ready for next/image. `alt` describes the image; never empty for real media. */
export type Media = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

/**
 * What a product card needs. A presentation view model local to the
 * storefront: when catalog contracts exist, a mapper in the catalog feature's
 * server/ folder converts API responses into this shape.
 */
export type ProductSummary = {
  slug: string;
  name: string;
  color: string;
  price: Money;
  /** null until real photography exists; the card shows a placeholder frame. */
  image: Media | null;
  /** Optional second image shown on hover/focus on fine-pointer devices. */
  hoverImage: Media | null;
};
