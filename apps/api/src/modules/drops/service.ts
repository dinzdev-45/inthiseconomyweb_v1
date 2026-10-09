import type {
  AdminDrop,
  AdminDropListItem,
  CreateDropRequest,
  DropCandidate,
  FieldError,
  UpdateDropRequest,
} from '@ite/contracts';
import { withAttribution } from '@ite/db';

import type { Clock } from '../../clock.ts';
import { DomainError } from '../../errors.ts';
import { rethrowCatalogError, uniqueViolationOf } from '../catalog/errors.ts';
import { insertWithGeneratedSlug, slugify } from '../catalog/slug.ts';
import type { DropDetailRow, DropRepository } from './repository.ts';

/*
 * Drops (drops-management spec, drops design D3). Writes lock the drop row; one drop per product
 * is a database rule (unique product_id), surfaced as PRODUCT_IN_OTHER_DROP.
 */

const errors = {
  notFound: () => new DomainError('NOT_FOUND', 404, 'Drop not found.'),
  inOtherDrop: (items: FieldError[]) =>
    new DomainError(
      'PRODUCT_IN_OTHER_DROP',
      409,
      'A product already belongs to another drop.',
      items,
    ),
  unknownProduct: () => new DomainError('UNKNOWN_REFERENCE', 422, 'Product not found.'),
  notReady: (items: FieldError[]) =>
    new DomainError(
      'DROP_NOT_READY',
      409,
      `The drop cannot be published yet: it needs ${items.map((item) => item.message).join(', ')}.`,
      items,
    ),
  invalidState: (detail: string) => new DomainError('INVALID_STATE_TRANSITION', 409, detail),
};

function toDrop(row: DropDetailRow): AdminDrop {
  return {
    id: row.id,
    slug: row.slug,
    collection: row.collection,
    title: row.title,
    description: row.description,
    releaseAt: row.releaseAt.toISOString(),
    image: row.imageUrl && row.imageAlt ? { url: row.imageUrl, alt: row.imageAlt } : null,
    status: row.status,
    products: row.products.map(({ product }) => {
      const image = product.images[0];
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        status: product.status,
        primaryImage: image ? { id: image.id, url: image.url, alt: image.alt } : null,
      };
    }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    createdBy: row.createdById,
    updatedBy: row.updatedById,
  };
}

const imageFields = (image: CreateDropRequest['image']) =>
  image === undefined ? {} : { imageUrl: image?.url ?? null, imageAlt: image?.alt ?? null };

export function createDropService({ repo, clock }: { repo: DropRepository; clock: Clock }) {
  async function locked<T>(
    id: string,
    fn: (
      tx: Parameters<Parameters<DropRepository['transaction']>[0]>[0],
      status: 'DRAFT' | 'PUBLISHED',
    ) => Promise<T>,
  ) {
    return repo.transaction(async (tx) => {
      const drop = await repo.lock(tx, id);
      if (!drop) throw errors.notFound();
      return fn(tx, drop.status);
    });
  }

  return {
    async list(): Promise<AdminDropListItem[]> {
      const rows = await repo.list();
      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        collection: row.collection,
        title: row.title,
        releaseAt: row.releaseAt.toISOString(),
        status: row.status,
        productCount: row._count.products,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async get(id: string): Promise<AdminDrop> {
      const row = await repo.findDetail(id);
      if (!row) throw errors.notFound();
      return toDrop(row);
    },

    async create(actor: string, body: CreateDropRequest): Promise<AdminDrop> {
      const now = clock.now();
      const insert = (slug: string) =>
        repo.create(
          withAttribution(
            actor,
            {
              slug,
              collection: body.collection,
              title: body.title,
              description: body.description ?? null,
              releaseAt: new Date(body.releaseAt),
              ...imageFields(body.image ?? null),
              createdAt: now,
              updatedAt: now,
            },
            'create',
          ),
        );
      try {
        const row = body.slug
          ? await insert(body.slug)
          : await insertWithGeneratedSlug(slugify(body.title, 'drop'), {
              findSlugsWithPrefix: repo.slugsWithPrefix,
              insert,
            });
        return toDrop(row);
      } catch (error) {
        rethrowCatalogError(error, 'write');
      }
    },

    async update(actor: string, id: string, body: UpdateDropRequest): Promise<AdminDrop> {
      try {
        return toDrop(
          await locked(id, (tx) =>
            repo.update(tx, id, {
              ...(body.slug !== undefined ? { slug: body.slug } : {}),
              ...(body.collection !== undefined ? { collection: body.collection } : {}),
              ...(body.title !== undefined ? { title: body.title } : {}),
              ...(body.description !== undefined ? { description: body.description } : {}),
              ...(body.releaseAt !== undefined ? { releaseAt: new Date(body.releaseAt) } : {}),
              ...imageFields(body.image),
              updatedById: actor,
            }),
          ),
        );
      } catch (error) {
        rethrowCatalogError(error, 'write');
      }
    },

    /** Replaces the drop's products (in order). Unknown products and other drops' are refused. */
    async setProducts(actor: string, id: string, productIds: string[]): Promise<AdminDrop> {
      try {
        return toDrop(
          await locked(id, async (tx) => {
            const existing = await repo.existingProducts(tx, productIds);
            if (productIds.some((productId) => !existing.has(productId)))
              throw errors.unknownProduct();
            const taken = await repo.inOtherDrops(tx, id, productIds);
            if (taken.length > 0) {
              throw errors.inOtherDrop(
                taken.map((row) => ({
                  path: `productIds.${productIds.indexOf(row.productId)}`,
                  message: `Already in drop ${row.dropId}`,
                })),
              );
            }
            await repo.setProducts(tx, id, productIds);
            return repo.update(tx, id, { updatedById: actor });
          }),
        );
      } catch (error) {
        // A concurrent change put the product in another drop first (unique product_id).
        if (uniqueViolationOf(error) === 'drop_products_product_id_key') {
          throw errors.inOtherDrop([]);
        }
        throw error;
      }
    },

    /** DRAFT → PUBLISHED when it has a title, a release time, an image, and products. */
    async publish(actor: string, id: string): Promise<AdminDrop> {
      return toDrop(
        await locked(id, async (tx, status) => {
          if (status === 'PUBLISHED') throw errors.invalidState('The drop is already published.');
          const drop = await repo.imageAndProductCount(tx, id);
          const missing: FieldError[] = [];
          if (!drop.title.trim()) missing.push({ path: 'title', message: 'a title' });
          if (!drop.releaseAt) missing.push({ path: 'releaseAt', message: 'a release time' });
          if (!drop.imageUrl) missing.push({ path: 'image', message: 'an image' });
          if (drop._count.products === 0)
            missing.push({ path: 'products', message: 'at least one product' });
          if (missing.length > 0) throw errors.notReady(missing);
          return repo.update(tx, id, { status: 'PUBLISHED', updatedById: actor });
        }),
      );
    },

    async unpublish(actor: string, id: string): Promise<AdminDrop> {
      return toDrop(
        await locked(id, async (tx, status) => {
          if (status === 'DRAFT') throw errors.invalidState('The drop is not published.');
          return repo.update(tx, id, { status: 'DRAFT', updatedById: actor });
        }),
      );
    },

    /** Deletes a DRAFT drop; its products leave it. Published drops are unpublished first. */
    async remove(id: string): Promise<void> {
      await locked(id, async (tx, status) => {
        if (status === 'PUBLISHED') {
          throw errors.invalidState('Unpublish the drop before deleting it.');
        }
        await repo.delete(tx, id);
      });
    },

    async candidates(id: string, q: string): Promise<DropCandidate[]> {
      if (!(await repo.findDetail(id))) throw errors.notFound();
      const rows = await repo.candidates(q);
      return rows.map((product) => {
        const image = product.images[0];
        const drop = product.dropProduct?.drop;
        return {
          id: product.id,
          name: product.name,
          slug: product.slug,
          status: product.status,
          primaryImage: image ? { id: image.id, url: image.url, alt: image.alt } : null,
          drop: drop ? { id: drop.id, title: drop.title } : null,
        };
      });
    },
  };
}

export type DropService = ReturnType<typeof createDropService>;
