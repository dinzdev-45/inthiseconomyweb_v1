import 'server-only';

import { HOME_CONTENT } from '../content.ts';
import type { HomeContent } from '../types.ts';

/**
 * The homepage's single data seam (storefront-homepage design D2).
 *
 * Today it returns static placeholder content and makes no API calls. A later
 * change replaces the product, drop, and lookbook parts with mapped results of
 * `storeGet(...)` (src/lib/api/store.ts, with `revalidate` to keep the page
 * statically generated), while editorial copy may stay here. Callers and
 * components do not change.
 */
export async function getHomeContent(): Promise<HomeContent> {
  return HOME_CONTENT;
}
