import 'server-only';

import type { StoreProductDetail } from '@ite/contracts';

import { isAllowedImage } from '@/lib/images';

import type { ProductDetail } from '../types.ts';

/** Nominal 4:5 dimensions; the gallery renders images with `fill`, so these only satisfy `Media`. */
const WIDTH = 1200;
const HEIGHT = 1500;

/**
 * Store API product detail → page view model (product-detail design D3). The API owns every
 * product rule (visibility, prices, availability, which images belong to which color); this
 * only drops images that may not load here.
 */
export function toProductDetail(
  product: StoreProductDetail,
  allowedHosts: readonly string[],
): ProductDetail {
  return {
    slug: product.slug,
    name: product.name,
    category: product.category,
    description: product.description,
    price: product.price,
    availability: product.availability,
    images: product.images
      .filter((image) => isAllowedImage(image.url, allowedHosts))
      .map((image) => ({
        src: image.url,
        alt: image.alt,
        width: WIDTH,
        height: HEIGHT,
        color: image.color,
      })),
    variants: product.variants,
  };
}
