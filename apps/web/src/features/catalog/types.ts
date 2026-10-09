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
 * storefront: `server/mapper.ts` converts store catalog API summaries into this
 * shape. `color` is the shown color text (a name, or "3 colors").
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
  /** Catalog only: shown as "Sold out" text when SOLD_OUT. Homepage cards leave it unset. */
  availability?: 'IN_STOCK' | 'SOLD_OUT';
  /** Catalog only: the highest price; when it differs from `price` the card reads "From". */
  priceMax?: Money;
  /** Catalog only: set while the product is unreleased; the card then says when it releases. */
  releaseAt?: string;
};
