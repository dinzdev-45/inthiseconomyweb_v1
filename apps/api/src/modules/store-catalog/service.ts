import {
  STORE_PAGE_SIZE,
  type StoreCatalogFilters,
  type StoreProductListQuery,
  type StoreProductListResponse,
  type StoreProductSummary,
} from '@ite/contracts';

import { DomainError } from '../../errors.ts';
import { toPrice } from '../catalog/money.ts';
import type { StoreCatalogRepository, StoreProductExtras, StoreProductRow } from './repository.ts';

const NO_EXTRAS: StoreProductExtras = { colors: [], image: null, secondaryImage: null };

/** Hex is stored uppercase; normalized again so the contract holds for any stored value. */
const toColor = (color: { slug: string; name: string; hex: string | null }) => ({
  slug: color.slug,
  name: color.name,
  hex: color.hex?.toUpperCase() ?? null,
});

/** A page row and its extras as the customer-safe summary (store-catalog-api spec). */
function toSummary(row: StoreProductRow, extras: StoreProductExtras): StoreProductSummary {
  return {
    slug: row.slug,
    name: row.name,
    category: { slug: row.categorySlug, name: row.categoryName },
    price: { min: toPrice(row.minPrice, row.currency), max: toPrice(row.maxPrice, row.currency) },
    availability: row.inStock ? 'IN_STOCK' : 'SOLD_OUT',
    colors: extras.colors.map(toColor),
    image: extras.image,
    secondaryImage: extras.secondaryImage,
  };
}

/** The public, read-only catalog. Visibility and pricing rules live here and in the repository. */
export function createStoreCatalogService({ repo }: { repo: StoreCatalogRepository }) {
  return {
    async list(query: StoreProductListQuery): Promise<StoreProductListResponse> {
      const { rows, total } = await repo.page(
        {
          category: query.category,
          size: query.size,
          color: query.color,
          inStock: query.availability === 'in-stock',
          q: query.q,
        },
        query.sort,
        STORE_PAGE_SIZE,
        (query.page - 1) * STORE_PAGE_SIZE,
      );
      const extras = await repo.extras(rows.map((row) => row.id));
      return {
        data: rows.map((row) => toSummary(row, extras.get(row.id) ?? NO_EXTRAS)),
        page: query.page,
        pageSize: STORE_PAGE_SIZE,
        totalItems: total,
        totalPages: Math.ceil(total / STORE_PAGE_SIZE),
      };
    },

    /**
     * One ACTIVE product's summary. Draft, inactive, archived, and unknown slugs all give the
     * same 404, so a hidden product cannot be told apart from a missing one.
     */
    async get(slug: string): Promise<StoreProductSummary> {
      const { rows } = await repo.page({ slug }, 'newest', 1, 0);
      const row = rows[0];
      if (!row) throw new DomainError('NOT_FOUND', 404, 'Product not found.');
      const extras = await repo.extras([row.id]);
      return toSummary(row, extras.get(row.id) ?? NO_EXTRAS);
    },

    async filters(): Promise<StoreCatalogFilters> {
      const { categories, sizes, colors } = await repo.filterOptions();
      return { categories, sizes, colors: colors.map(toColor) };
    },
  };
}

export type StoreCatalogService = ReturnType<typeof createStoreCatalogService>;
