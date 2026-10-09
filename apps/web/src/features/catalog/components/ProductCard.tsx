import Link from 'next/link';

import { FallbackImage } from '@/components/FallbackImage';
import { formatReleaseDate } from '@/lib/release-date';
import { formatMoney } from '@/lib/format-money';

import type { ProductSummary } from '../types.ts';

type HeadingLevel = 'h2' | 'h3' | 'h4';

type ProductCardProps = {
  product: ProductSummary;
  /** next/image `sizes` for the card's width in its layout. */
  sizes?: string;
  /** Heading level for the product name, following the surrounding section (default h3). */
  as?: HeadingLevel;
  /** Load the primary image eagerly (cards in a grid's first row). */
  eager?: boolean;
  /** Let the price wrap below the name when the card is too narrow for both (catalog grids). */
  wrap?: boolean;
};

/**
 * Borderless editorial product card (design D1/D3/D5): image, then name, color,
 * and price. The whole card is one link to the product page. No wishlist,
 * quick-add, or cart controls. Server Component; the hover image swap is CSS
 * only and applies to fine-pointer devices without a reduced-motion preference.
 *
 * Catalog cards (storefront-catalog design D6) may add "From" for a price range and a
 * "Sold out" text label inside the link; homepage cards set neither and render as before.
 * Images that are missing or fail to load show the placeholder (`FallbackImage`).
 */
export function ProductCard({
  product,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  as: Heading = 'h3',
  eager = false,
  wrap = false,
}: ProductCardProps) {
  const { slug, name, color, price, priceMax, availability, releaseAt, image, hoverImage } =
    product;
  const isRange = priceMax !== undefined && priceMax.amount !== price.amount;
  const swap = image !== null && hoverImage !== null;

  return (
    <article className="group">
      <Link href={`/products/${slug}`} className="block">
        <div className="relative">
          <FallbackImage image={image} ratio={4 / 5} sizes={sizes} eager={eager} />
          {swap ? (
            <div
              aria-hidden="true"
              data-hover-image
              className="absolute inset-0 opacity-0 transition-opacity duration-300 hover-fine:group-hover:opacity-100 hover-fine:group-focus-within:opacity-100"
            >
              <FallbackImage image={hoverImage} ratio={4 / 5} sizes={sizes} />
            </div>
          ) : null}
        </div>
        <div
          className={`mt-3 flex items-start justify-between gap-4${wrap ? ' flex-wrap gap-y-1' : ''}`}
        >
          <div className="min-w-0">
            <Heading className="text-sm font-semibold uppercase">{name}</Heading>
            <p className="mt-1 text-sm text-ink/70">{color}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-brand-dark tabular-nums">
            {isRange ? `From ${formatMoney(price)}` : formatMoney(price)}
          </p>
        </div>
        {/* Text, inside the link, so it is part of the accessible name (never color alone). */}
        {releaseAt ? (
          <p className="mt-1 text-right text-label text-ink uppercase" data-release>
            Releases {formatReleaseDate(releaseAt)}
          </p>
        ) : null}
        {availability === 'SOLD_OUT' && !releaseAt ? (
          <p className="mt-1 text-right text-label text-ink uppercase">Sold out</p>
        ) : null}
      </Link>
    </article>
  );
}
