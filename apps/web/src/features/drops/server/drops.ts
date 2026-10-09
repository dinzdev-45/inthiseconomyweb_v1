import 'server-only';

import { Slug, StoreDropDetail, StoreDropsOverview, type StoreDropSummary } from '@ite/contracts';

import { loadEnv } from '@/env';
import { StoreApiError, storeGet } from '@/lib/api/store';
import { isAllowedImage } from '@/lib/images';

import type { DropSummary } from '../types.ts';

/** Matches the API's `Cache-Control: max-age=60`. */
const REVALIDATE_SECONDS = 60;

const STATUS: Record<StoreDropSummary['status'], DropSummary['status']> = {
  UPCOMING: 'upcoming',
  LIVE: 'live',
  PAST: 'past',
};

/** A store drop summary as the storefront's drop view model (allowed-host image only). */
export function toDropSummary(
  drop: StoreDropSummary,
  allowedHosts: readonly string[],
): DropSummary {
  return {
    slug: drop.slug,
    collection: drop.collection,
    title: drop.title,
    status: STATUS[drop.status],
    startsAt: drop.releaseAt,
    image:
      drop.image && isAllowedImage(drop.image.url, allowedHosts)
        ? { src: drop.image.url, alt: drop.image.alt, width: 1600, height: 1200 }
        : null,
  };
}

export type DropsOverview = {
  upcoming: DropSummary[];
  current: DropSummary | null;
  archive: DropSummary[];
};

/** Published drops: upcoming (soonest first), the current one, and the archive. Throws on failure. */
export async function getDropsOverview(revalidate = REVALIDATE_SECONDS): Promise<DropsOverview> {
  const overview = await storeGet('/api/v1/store/drops', StoreDropsOverview, { revalidate });
  const hosts = loadEnv().STOREFRONT_IMAGE_HOSTS;
  return {
    upcoming: overview.upcoming.map((drop) => toDropSummary(drop, hosts)),
    current: overview.current && toDropSummary(overview.current, hosts),
    archive: overview.archive.map((drop) => toDropSummary(drop, hosts)),
  };
}

/** One published drop with its store products, or null for a draft or unknown slug. */
export async function getDrop(slug: string): Promise<StoreDropDetail | null> {
  if (!Slug.safeParse(slug).success) return null;
  try {
    return await storeGet(`/api/v1/store/drops/${slug}`, StoreDropDetail, {
      revalidate: REVALIDATE_SECONDS,
    });
  } catch (error) {
    if (error instanceof StoreApiError && error.status === 404) return null;
    throw error;
  }
}
