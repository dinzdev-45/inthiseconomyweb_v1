import type {
  Category,
  CategoryStatus,
  Color,
  CreateCategoryRequest,
  CreateColorRequest,
  CreateSizeRequest,
  Size,
  UpdateCategoryRequest,
  UpdateColorRequest,
  UpdateSizeRequest,
} from '@ite/contracts';
import {
  withAttribution,
  type Category as CategoryRow,
  type Color as ColorRow,
  type Size as SizeRow,
} from '@ite/db';

import type { Clock } from '../../../clock.ts';
import { DomainError } from '../../../errors.ts';
import { attributionFields } from '../attribution.ts';
import { catalogError, isRecordNotFound, rethrowCatalogError } from '../errors.ts';
import { insertWithGeneratedSlug, slugify } from '../slug.ts';
import type { ReferenceRepository } from './repository.ts';

/** Public category representation (API fields only). */
export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    ...attributionFields(row),
  };
}

/** Public size representation (API fields only). */
export function toSize(row: SizeRow): Size {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    sortOrder: row.sortOrder,
    ...attributionFields(row),
  };
}

/** Public color representation (API fields only). */
export function toColor(row: ColorRow): Color {
  return { id: row.id, name: row.name, slug: row.slug, hex: row.hex, ...attributionFields(row) };
}

const notFound = (what: 'Category' | 'Size' | 'Color') =>
  new DomainError('NOT_FOUND', 404, `${what} not found.`);

/**
 * Runs a single-row write: a missing row becomes `404`, a known constraint violation its
 * catalog error (`SLUG_EXISTS`, `CODE_EXISTS`, `IN_USE`, …), anything else is rethrown.
 */
async function write<T>(
  what: 'Category' | 'Size' | 'Color',
  operation: 'write' | 'delete',
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isRecordNotFound(error)) throw notFound(what);
    return rethrowCatalogError(error, operation);
  }
}

type Deps = { repo: ReferenceRepository; clock: Clock };

/** Categories, sizes, and colors (catalog-reference-data spec). */
export function createReferenceService({ repo, clock }: Deps) {
  const created = (actorId: string) => {
    const now = clock.now();
    return withAttribution(actorId, { createdAt: now, updatedAt: now }, 'create');
  };
  const updated = (actorId: string) =>
    withAttribution(actorId, { updatedAt: clock.now() }, 'update');

  /**
   * Inserts with the explicit slug as given (a collision is `409 SLUG_EXISTS`), or with one
   * generated from the name (smallest free `-N` suffix, retried once on a concurrent insert).
   */
  function insertWithSlug<T>(
    explicit: string | undefined,
    name: string,
    fallback: 'category' | 'color',
    findSlugsWithPrefix: (prefix: string) => Promise<string[]>,
    insert: (slug: string) => Promise<T>,
  ): Promise<T> {
    const run = () =>
      explicit === undefined
        ? insertWithGeneratedSlug(slugify(name, fallback), { findSlugsWithPrefix, insert })
        : insert(explicit);
    return write(fallback === 'category' ? 'Category' : 'Color', 'write', run);
  }

  /** Archive (ACTIVE → ARCHIVED, only without ACTIVE products) or restore (ARCHIVED → ACTIVE). */
  async function changeCategoryStatus(
    actorId: string,
    id: string,
    to: CategoryStatus,
  ): Promise<Category> {
    return repo.transaction(async (tx) => {
      const current = await repo.lockCategory(tx, id);
      if (!current) throw notFound('Category');
      if (current.status === to) {
        throw catalogError(
          'INVALID_STATE_TRANSITION',
          to === 'ARCHIVED' ? 'The category is already archived.' : 'The category is not archived.',
        );
      }
      if (to === 'ARCHIVED' && (await repo.countActiveProducts(tx, id)) > 0) {
        throw catalogError('IN_USE', 'Active products still use this category.');
      }
      return toCategory(await repo.setCategoryStatus(tx, id, { status: to, ...updated(actorId) }));
    });
  }

  return {
    // Categories -------------------------------------------------------------

    async listCategories(status?: CategoryStatus): Promise<Category[]> {
      return (await repo.listCategories(status)).map(toCategory);
    },

    async getCategory(id: string): Promise<Category> {
      const row = await repo.findCategory(id);
      if (!row) throw notFound('Category');
      return toCategory(row);
    },

    async createCategory(actorId: string, input: CreateCategoryRequest): Promise<Category> {
      const row = await insertWithSlug(
        input.slug,
        input.name,
        'category',
        repo.categorySlugsWithPrefix,
        (slug) => repo.createCategory({ name: input.name, slug, ...created(actorId) }),
      );
      return toCategory(row);
    },

    async updateCategory(
      actorId: string,
      id: string,
      input: UpdateCategoryRequest,
    ): Promise<Category> {
      const row = await write('Category', 'write', () =>
        repo.updateCategory(id, { ...input, ...updated(actorId) }),
      );
      return toCategory(row);
    },

    archiveCategory(actorId: string, id: string) {
      return changeCategoryStatus(actorId, id, 'ARCHIVED');
    },

    restoreCategory(actorId: string, id: string) {
      return changeCategoryStatus(actorId, id, 'ACTIVE');
    },

    // Sizes ------------------------------------------------------------------

    async listSizes(): Promise<Size[]> {
      return (await repo.listSizes()).map(toSize);
    },

    async createSize(actorId: string, input: CreateSizeRequest): Promise<Size> {
      const row = await write('Size', 'write', () =>
        repo.createSize({ ...input, ...created(actorId) }),
      );
      return toSize(row);
    },

    async updateSize(actorId: string, id: string, input: UpdateSizeRequest): Promise<Size> {
      const row = await write('Size', 'write', () =>
        repo.updateSize(id, { ...input, ...updated(actorId) }),
      );
      return toSize(row);
    },

    /** Deletes a size no variant uses; one in use is `409 IN_USE` (enforced by the foreign key). */
    async deleteSize(id: string): Promise<void> {
      await write('Size', 'delete', () => repo.deleteSize(id));
    },

    // Colors -----------------------------------------------------------------

    async listColors(): Promise<Color[]> {
      return (await repo.listColors()).map(toColor);
    },

    async createColor(actorId: string, input: CreateColorRequest): Promise<Color> {
      const row = await insertWithSlug(
        input.slug,
        input.name,
        'color',
        repo.colorSlugsWithPrefix,
        (slug) =>
          repo.createColor({ name: input.name, slug, hex: input.hex ?? null, ...created(actorId) }),
      );
      return toColor(row);
    },

    async updateColor(actorId: string, id: string, input: UpdateColorRequest): Promise<Color> {
      const row = await write('Color', 'write', () =>
        repo.updateColor(id, { ...input, ...updated(actorId) }),
      );
      return toColor(row);
    },

    /** Deletes a color no variant uses; one in use is `409 IN_USE` (enforced by the foreign key). */
    async deleteColor(id: string): Promise<void> {
      await write('Color', 'delete', () => repo.deleteColor(id));
    },
  };
}

export type ReferenceService = ReturnType<typeof createReferenceService>;
