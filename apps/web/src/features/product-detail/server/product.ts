import 'server-only';

import { Slug, StoreProductDetail } from '@ite/contracts';

import { loadEnv } from '@/env';
import { StoreApiError, storeGet } from '@/lib/api/store';

import type { ProductDetail } from '../types.ts';
import { toProductDetail } from './mapper.ts';

/** Matches the API's `Cache-Control: max-age=60`. */
const REVALIDATE_SECONDS = 60;

/**
 * One active product's detail, or null when the slug is not an active product (malformed slugs
 * never reach the API). Exactly one GET with a fixed URL and options, so the route's metadata
 * and page share it through Next's fetch memoization (design D3). Other failures throw.
 */
export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  if (!Slug.safeParse(slug).success) return null;
  try {
    const product = await storeGet(`/api/v1/store/products/${slug}`, StoreProductDetail, {
      revalidate: REVALIDATE_SECONDS,
    });
    return toProductDetail(product, loadEnv().STOREFRONT_IMAGE_HOSTS);
  } catch (error) {
    if (error instanceof StoreApiError && error.status === 404) return null;
    throw error;
  }
}
