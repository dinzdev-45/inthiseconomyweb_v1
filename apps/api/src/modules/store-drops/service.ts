import type {
  StoreDropDetail,
  StoreDropStatus,
  StoreDropsOverview,
  StoreDropSummary,
} from '@ite/contracts';

import type { Clock } from '../../clock.ts';
import { DomainError } from '../../errors.ts';
import type { StoreCatalogService } from '../store-catalog/service.ts';
import type { PublishedDropRow, StoreDropRepository } from './repository.ts';

/*
 * Published drops for the storefront (store-drops-api spec, drops design D4). Statuses come from
 * the clock: ahead → UPCOMING, the most recently released → LIVE, earlier ones → PAST.
 */

const summary = (row: PublishedDropRow, status: StoreDropStatus): StoreDropSummary => ({
  slug: row.slug,
  collection: row.collection,
  title: row.title,
  releaseAt: row.releaseAt.toISOString(),
  status,
  image: row.imageUrl && row.imageAlt ? { url: row.imageUrl, alt: row.imageAlt } : null,
  productCount: row.productCount,
});

export function createStoreDropService({
  repo,
  catalog,
  clock,
}: {
  repo: StoreDropRepository;
  catalog: StoreCatalogService;
  clock: Clock;
}) {
  /** Published drops split by the clock: upcoming soonest first, released most recent first. */
  async function split() {
    const now = clock.now().getTime();
    const rows = await repo.published();
    const upcoming = rows.filter((row) => row.releaseAt.getTime() > now);
    const released = rows.filter((row) => row.releaseAt.getTime() <= now).reverse();
    return { upcoming, current: released[0] ?? null, archive: released.slice(1) };
  }

  return {
    async overview(): Promise<StoreDropsOverview> {
      const { upcoming, current, archive } = await split();
      return {
        upcoming: upcoming.map((row) => summary(row, 'UPCOMING')),
        current: current ? summary(current, 'LIVE') : null,
        archive: archive.map((row) => summary(row, 'PAST')),
      };
    },

    /** One published drop with its products; drafts and unknown slugs are the same 404. */
    async get(slug: string): Promise<StoreDropDetail> {
      const { upcoming, current, archive } = await split();
      const row = [...upcoming, ...(current ? [current] : []), ...archive].find(
        (candidate) => candidate.slug === slug,
      );
      if (!row) throw new DomainError('NOT_FOUND', 404, 'Drop not found.');
      const status: StoreDropStatus = upcoming.includes(row)
        ? 'UPCOMING'
        : row === current
          ? 'LIVE'
          : 'PAST';
      return {
        ...summary(row, status),
        description: row.description,
        products: await catalog.dropProducts(row.id),
      };
    },
  };
}

export type StoreDropService = ReturnType<typeof createStoreDropService>;
