import type { Metadata } from 'next';

import type { ProductDetail } from './types.ts';

/** Longest meta description (characters), by the product-detail spec. */
export const DESCRIPTION_MAX = 160;

/**
 * Text collapsed to single spaces and cut at a word boundary to at most `max` characters,
 * ending in "…" when shortened.
 */
export function shorten(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > 0 ? cut.slice(0, boundary) : cut).replace(/[\s,.;:–-]+$/, '')}…`;
}

/**
 * Product page metadata (product-detail design D7): indexable, titled by the product name, with a
 * canonical URL that ignores `color` and `size` (made absolute by the layout's `metadataBase`).
 */
export function productMetadata(
  product: Pick<ProductDetail, 'slug' | 'name' | 'description'>,
): Metadata {
  return {
    title: product.name,
    description: product.description?.trim()
      ? shorten(product.description)
      : `${product.name} from InThisEconomy.`,
    alternates: { canonical: `/products/${product.slug}` },
  };
}
