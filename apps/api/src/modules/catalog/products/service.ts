import type {
  CreateProductRequest,
  ProductDetail,
  ProductListQuery,
  ProductListResponse,
  ProductStatus,
  UpdateProductRequest,
} from '@ite/contracts';
import { withAttribution } from '@ite/db';

import type { Clock } from '../../../clock.ts';
import { DomainError } from '../../../errors.ts';
import { toPage, type CursorCodec } from '../../../pagination.ts';
import { catalogError, rethrowCatalogError } from '../errors.ts';
import { storeAmount } from '../money.ts';
import { hasQualifyingVariant, readinessProblems } from '../readiness.ts';
import { insertWithGeneratedSlug, slugify } from '../slug.ts';
import { toProductDetail, toProductListItem } from './mappers.ts';
import type { ProductRepository } from './repository.ts';

type LifecycleAction = 'activate' | 'deactivate' | 'archive' | 'restore';

/** Allowed product transitions (design D3): action → statuses it applies to, and the result. */
const TRANSITIONS: Record<LifecycleAction, { from: readonly ProductStatus[]; to: ProductStatus }> =
  {
    activate: { from: ['DRAFT', 'INACTIVE'], to: 'ACTIVE' },
    deactivate: { from: ['ACTIVE'], to: 'INACTIVE' },
    archive: { from: ['DRAFT', 'INACTIVE'], to: 'ARCHIVED' },
    restore: { from: ['ARCHIVED'], to: 'INACTIVE' },
  };

function invalidTransition(action: LifecycleAction, status: ProductStatus): DomainError {
  const hint = action === 'archive' && status === 'ACTIVE' ? ' Deactivate it first.' : '';
  return catalogError(
    'INVALID_STATE_TRANSITION',
    `A product that is ${status} cannot be ${action === 'activate' ? 'activated' : `${action}d`}.${hint}`,
  );
}

const notFound = () => new DomainError('NOT_FOUND', 404, 'Product not found.');

type Deps = {
  repo: ProductRepository;
  clock: Clock;
  /** STORE_CURRENCY: every price must use it (design D2). */
  storeCurrency: string;
  /** Signs `nextCursor` for the product list (bound to that list). */
  cursors: CursorCodec;
};

/** Products: create, read, update, list, and lifecycle (product-management spec). */
export function createProductService({ repo, clock, storeCurrency, cursors }: Deps) {
  return {
    async list(query: ProductListQuery): Promise<ProductListResponse> {
      const after = query.cursor === undefined ? undefined : cursors.decode(query.cursor);
      const rows = await repo.list(
        { status: query.status, categoryId: query.categoryId, q: query.q },
        after,
        query.limit + 1,
      );
      const page = toPage(rows, query.limit, cursors);
      // One aggregate query for the whole page, never one per row.
      const stock = await repo.stockSummaries(page.rows.map((row) => row.id));
      return {
        data: page.rows.map((row) => toProductListItem(row, stock.get(row.id))),
        nextCursor: page.nextCursor,
      };
    },

    async get(id: string): Promise<ProductDetail> {
      const row = await repo.findDetail(id);
      if (!row) throw notFound();
      return toProductDetail(row);
    },

    /**
     * Creates a DRAFT product. An explicit slug is inserted as given (taken: `409 SLUG_EXISTS`);
     * without one, a slug is generated from the name with the smallest free `-N` suffix. Each
     * insert is a single statement outside any transaction, so the generated-slug retry never
     * runs inside a transaction a failed INSERT has aborted.
     */
    async create(actorId: string, input: CreateProductRequest): Promise<ProductDetail> {
      const basePriceAmount = storeAmount(input.basePrice, storeCurrency, 'basePrice');
      const now = clock.now();
      const insert = (slug: string) =>
        repo.create(
          withAttribution(
            actorId,
            {
              name: input.name,
              slug,
              description: input.description ?? null,
              categoryId: input.categoryId,
              basePriceAmount,
              currency: storeCurrency,
              createdAt: now,
              updatedAt: now,
            },
            'create',
          ),
        );
      try {
        const row =
          input.slug === undefined
            ? await insertWithGeneratedSlug(slugify(input.name, 'product'), {
                findSlugsWithPrefix: repo.slugsWithPrefix,
                insert,
              })
            : await insert(input.slug);
        return toProductDetail(row);
      } catch (error) {
        // Unknown category: 422 UNKNOWN_REFERENCE; taken slug: 409 SLUG_EXISTS.
        return rethrowCatalogError(error, 'write');
      }
    },

    /**
     * Partial update of name, slug, description, category, and base price. Runs under the fixed
     * lock order (new category, then product): ARCHIVED products are read-only, the slug is
     * locked once the product has been activated, and an ACTIVE product must stay ready (active
     * category, an active variant priced above zero).
     */
    async update(actorId: string, id: string, input: UpdateProductRequest): Promise<ProductDetail> {
      const basePriceAmount =
        input.basePrice === undefined
          ? undefined
          : storeAmount(input.basePrice, storeCurrency, 'basePrice');

      return repo
        .transaction(async (tx) => {
          const category =
            input.categoryId === undefined
              ? undefined
              : await repo.lockCategoryShared(tx, input.categoryId);
          const product = await repo.lockProduct(tx, id);
          if (!product) throw notFound();
          if (category === null) throw catalogError('UNKNOWN_REFERENCE', 'Category not found.');

          if (product.status === 'ARCHIVED') {
            throw catalogError(
              'INVALID_STATE_TRANSITION',
              'Archived products cannot be edited. Restore the product first.',
            );
          }
          if (
            input.slug !== undefined &&
            input.slug !== product.slug &&
            product.activatedAt !== null
          ) {
            throw catalogError(
              'SLUG_LOCKED',
              'The slug cannot change after the product has been activated.',
            );
          }
          if (product.status === 'ACTIVE') {
            if (category && category.status !== 'ACTIVE') {
              throw catalogError(
                'PRODUCT_NOT_READY',
                'An active product must stay in an active category.',
              );
            }
            if (basePriceAmount !== undefined) {
              const variants = await repo.lockVariants(tx, id);
              if (!hasQualifyingVariant(basePriceAmount, variants)) {
                throw catalogError(
                  'PRODUCT_NOT_READY',
                  'An active product must keep at least one active variant priced above zero.',
                );
              }
            }
          }

          return repo.update(
            tx,
            id,
            withAttribution(
              actorId,
              {
                name: input.name,
                slug: input.slug,
                description: input.description,
                categoryId: input.categoryId,
                basePriceAmount,
                updatedAt: clock.now(),
              },
              'update',
            ),
          );
        })
        .then(toProductDetail, (error: unknown) => rethrowCatalogError(error, 'write'));
    },

    /**
     * DRAFT or INACTIVE → ACTIVE when every readiness condition holds, otherwise
     * `409 PRODUCT_NOT_READY` listing each unmet one. Locks in the fixed order: category (shared,
     * so it cannot be archived meanwhile), product, variants; images are counted under the
     * product lock, which image changes also take. `activatedAt` is set only the first time.
     */
    async activate(actorId: string, id: string): Promise<ProductDetail> {
      const row = await repo.transaction(async (tx) => {
        const categoryId = await repo.productCategoryId(tx, id);
        if (categoryId === null) throw notFound();
        let category = await repo.lockCategoryShared(tx, categoryId);
        const product = await repo.lockProduct(tx, id);
        if (!product) throw notFound();
        // A concurrent edit moved it between the two reads; the product lock now pins the
        // category, so locking the new one is still safe (category locks are only ever shared
        // here and in edits, and archiving never waits on a product lock).
        if (product.categoryId !== categoryId) {
          category = await repo.lockCategoryShared(tx, product.categoryId);
        }
        if (!TRANSITIONS.activate.from.includes(product.status)) {
          throw invalidTransition('activate', product.status);
        }

        const variants = await repo.lockVariants(tx, id);
        const problems = readinessProblems({
          categoryStatus: category!.status,
          basePriceAmount: product.basePriceAmount,
          variants,
          ...(await repo.imageCounts(tx, id)),
        });
        if (problems.length > 0) {
          throw catalogError(
            'PRODUCT_NOT_READY',
            `The product is not ready to activate: ${problems.join('; ')}.`,
          );
        }

        const now = clock.now();
        return repo.setLifecycle(
          tx,
          id,
          withAttribution(
            actorId,
            { status: 'ACTIVE', activatedAt: product.activatedAt ?? now, updatedAt: now },
            'update',
          ),
        );
      });
      return toProductDetail(row);
    },

    deactivate(actorId: string, id: string) {
      return transition(actorId, id, 'deactivate');
    },

    archive(actorId: string, id: string) {
      return transition(actorId, id, 'archive');
    },

    restore(actorId: string, id: string) {
      return transition(actorId, id, 'restore');
    },
  };

  /** A transition with no readiness requirement: deactivate, archive, restore (product lock only). */
  async function transition(
    actorId: string,
    id: string,
    action: Exclude<LifecycleAction, 'activate'>,
  ): Promise<ProductDetail> {
    const row = await repo.transaction(async (tx) => {
      const product = await repo.lockProduct(tx, id);
      if (!product) throw notFound();
      const { from, to } = TRANSITIONS[action];
      if (!from.includes(product.status)) throw invalidTransition(action, product.status);
      return repo.setLifecycle(
        tx,
        id,
        withAttribution(actorId, { status: to, updatedAt: clock.now() }, 'update'),
      );
    });
    return toProductDetail(row);
  }
}

export type ProductService = ReturnType<typeof createProductService>;
