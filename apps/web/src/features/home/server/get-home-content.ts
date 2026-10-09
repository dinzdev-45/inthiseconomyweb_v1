import 'server-only';

import type { DropSummary } from '@/features/drops';
import { getDropsOverview } from '@/features/drops/server/drops';

import { HOME_CONTENT } from '../content.ts';
import type { HomeContent } from '../types.ts';

/** Matches the homepage's `revalidate`: the drop is read when the page is (re)generated. */
const DROP_REVALIDATE_SECONDS = 300;

/**
 * The homepage's single data seam (storefront-homepage design D2; drops design D5).
 *
 * Editorial copy, products, and the look are static placeholder content. The featured drop is
 * the next upcoming published drop, or else the current live one, read from the store drops API
 * only when the page is generated or revalidated, never per visit. When the API fails the drop
 * is null and the section is omitted, so the homepage never depends on the API.
 */
export async function getHomeContent(): Promise<HomeContent> {
  return { ...HOME_CONTENT, drop: await featuredDrop() };
}

async function featuredDrop(): Promise<DropSummary | null> {
  try {
    const overview = await getDropsOverview(DROP_REVALIDATE_SECONDS);
    return overview.upcoming[0] ?? overview.current;
  } catch {
    return null;
  }
}
