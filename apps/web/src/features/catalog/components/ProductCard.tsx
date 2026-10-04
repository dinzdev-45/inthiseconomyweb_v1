import Link from 'next/link';

import { MediaFrame } from '@/components/MediaFrame';
import { formatMoney } from '@/lib/format-money';

import type { ProductSummary } from '../types.ts';

type HeadingLevel = 'h2' | 'h3' | 'h4';

type ProductCardProps = {
  product: ProductSummary;
  /** next/image `sizes` for the card's width in its layout. */
  sizes?: string;
  /** Heading level for the product name, following the surrounding section (default h3). */
  as?: HeadingLevel;
};

/**
 * Borderless editorial product card (design D1/D3/D5): image, then name, color,
 * and price. The whole card is one link to the product page. No wishlist,
 * quick-add, or cart controls. Server Component; the hover image swap is CSS
 * only and applies to fine-pointer devices without a reduced-motion preference.
 */
export function ProductCard({
  product,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  as: Heading = 'h3',
}: ProductCardProps) {
  const { slug, name, color, price, image, hoverImage } = product;
  const swap = image !== null && hoverImage !== null;

  return (
    <article className="group">
      <Link href={`/products/${slug}`} className="block">
        <div className="relative">
          <MediaFrame image={image} ratio={4 / 5} sizes={sizes} />
          {swap ? (
            <div
              aria-hidden="true"
              data-hover-image
              className="absolute inset-0 opacity-0 transition-opacity duration-300 hover-fine:group-hover:opacity-100 hover-fine:group-focus-within:opacity-100"
            >
              <MediaFrame image={hoverImage} ratio={4 / 5} sizes={sizes} />
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Heading className="text-sm font-semibold uppercase">{name}</Heading>
            <p className="mt-1 text-sm text-ink/70">{color}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-brand-dark tabular-nums">
            {formatMoney(price)}
          </p>
        </div>
      </Link>
    </article>
  );
}
