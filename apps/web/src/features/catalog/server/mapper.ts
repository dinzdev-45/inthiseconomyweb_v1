import 'server-only';

import type { StoreProductSummary } from '@ite/contracts';

import type { Media, ProductSummary } from '../types.ts';

/*
 * Store catalog API summary → card view model (storefront-catalog design D6, D7). The API owns
 * every product rule; this only decides presentation: which images may load, the color text,
 * and whether the price is a range.
 */

/** Nominal 4:5 dimensions; cards render images with `fill`, so these only satisfy `Media`. */
const CARD_WIDTH = 800;
const CARD_HEIGHT = 1000;

/**
 * Whether `next/image` may load `url`: a root-relative path (the storefront's own files), or an
 * https URL on one of the allowed hosts. Anything else shows the placeholder instead.
 */
export function isAllowedImage(url: string, allowedHosts: readonly string[]): boolean {
  if (url.startsWith('/')) return !url.startsWith('//');
  if (!URL.canParse(url)) return false;
  const parsed = new URL(url);
  return (
    parsed.protocol === 'https:' &&
    parsed.port === '' &&
    allowedHosts.includes(parsed.hostname.toLowerCase())
  );
}

function toMedia(
  image: StoreProductSummary['image'],
  allowedHosts: readonly string[],
): Media | null {
  if (!image || !isAllowedImage(image.url, allowedHosts)) return null;
  return { src: image.url, alt: image.alt, width: CARD_WIDTH, height: CARD_HEIGHT };
}

/** The color name when there is one color, otherwise how many. */
export function colorLabel(colors: StoreProductSummary['colors']): string {
  if (colors.length === 1) return colors[0]!.name;
  return colors.length === 0 ? '' : `${colors.length} colors`;
}

export function toProductSummary(
  product: StoreProductSummary,
  allowedHosts: readonly string[],
): ProductSummary {
  const { min, max } = product.price;
  return {
    slug: product.slug,
    name: product.name,
    color: colorLabel(product.colors),
    price: min,
    ...(max.amount !== min.amount ? { priceMax: max } : {}),
    availability: product.availability,
    image: toMedia(product.image, allowedHosts),
    hoverImage: toMedia(product.secondaryImage, allowedHosts),
  };
}
