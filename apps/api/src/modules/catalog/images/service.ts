import {
  PRODUCT_IMAGE_MAX,
  type CreateImageRequest,
  type ProductImage,
  type ReorderImagesRequest,
  type UpdateImageRequest,
} from '@ite/contracts';
import { withAttribution } from '@ite/db';

import type { Clock } from '../../../clock.ts';
import { DomainError } from '../../../errors.ts';
import { catalogError, rethrowCatalogError } from '../errors.ts';
import { toProductImage } from '../products/mappers.ts';
import type { LockedProduct, ProductRepository } from '../products/repository.ts';
import type { ImageRepository } from './repository.ts';

type Tx = Parameters<Parameters<ProductRepository['transaction']>[0]>[0];

const productNotFound = () => new DomainError('NOT_FOUND', 404, 'Product not found.');
const imageNotFound = () => new DomainError('NOT_FOUND', 404, 'Image not found.');

type Deps = { products: ProductRepository; images: ImageRepository; clock: Clock };

/**
 * Product image metadata (product-management spec, design D6). Every operation runs in one
 * transaction holding the product row lock, the same lock activation takes, so:
 * - when a product has images, exactly one is primary (readers never see zero or two);
 * - an ACTIVE product never loses its last image;
 * - concurrent image changes on one product apply one after another.
 */
export function createImageService({ products, images, clock }: Deps) {
  /** Locks the product (rejecting unknown and ARCHIVED ones) and runs `fn` in that transaction. */
  async function onProduct<T>(
    productId: string,
    fn: (tx: Tx, product: LockedProduct, attribution: ReturnType<typeof updated>) => Promise<T>,
    actorId: string,
  ): Promise<T> {
    try {
      return await products.transaction(async (tx) => {
        const product = await products.lockProduct(tx, productId);
        if (!product) throw productNotFound();
        if (product.status === 'ARCHIVED') {
          throw catalogError(
            'INVALID_STATE_TRANSITION',
            'Archived products cannot be edited. Restore the product first.',
          );
        }
        return fn(tx, product, updated(actorId));
      });
    } catch (error) {
      return rethrowCatalogError(error, 'write');
    }
  }

  const updated = (actorId: string) =>
    withAttribution(actorId, { updatedAt: clock.now() }, 'update');

  /** `422 UNKNOWN_REFERENCE` for an unknown variant, `422 VARIANT_MISMATCH` for another product's. */
  async function checkVariant(tx: Tx, productId: string, variantId: string | null | undefined) {
    if (variantId === null || variantId === undefined) return;
    const owner = await images.variantProductId(tx, variantId);
    if (owner === null) throw catalogError('UNKNOWN_REFERENCE', 'Variant not found.');
    if (owner !== productId) {
      throw catalogError('VARIANT_MISMATCH', 'The variant belongs to a different product.');
    }
  }

  return {
    /**
     * Adds an image at the end of the order. The product's first image is always primary;
     * `isPrimary: true` on a later one moves the primary to it.
     */
    add(actorId: string, productId: string, input: CreateImageRequest): Promise<ProductImage> {
      return onProduct(
        productId,
        async (tx, _product, attribution) => {
          const existing = await images.list(tx, productId);
          if (existing.length >= PRODUCT_IMAGE_MAX) {
            throw catalogError(
              'IMAGE_LIMIT',
              `A product can have at most ${PRODUCT_IMAGE_MAX} images.`,
            );
          }
          await checkVariant(tx, productId, input.variantId);

          const isPrimary = existing.length === 0 || input.isPrimary === true;
          if (isPrimary && existing.length > 0) {
            await images.unsetPrimary(tx, productId, attribution);
          }
          const last = existing.at(-1);
          const row = await images.create(tx, {
            productId,
            variantId: input.variantId ?? null,
            url: input.url,
            alt: input.alt,
            sortOrder: last ? last.sortOrder + 1 : 0,
            isPrimary,
            ...withAttribution(actorId, { createdAt: attribution.updatedAt }, 'create'),
            ...attribution,
          });
          return toProductImage(row);
        },
        actorId,
      );
    },

    /** Changes URL, alt text, or variant; `isPrimary: true` moves the primary here atomically. */
    update(
      actorId: string,
      productId: string,
      imageId: string,
      input: UpdateImageRequest,
    ): Promise<ProductImage> {
      return onProduct(
        productId,
        async (tx, _product, attribution) => {
          const existing = await images.list(tx, productId);
          const target = existing.find((image) => image.id === imageId);
          if (!target) throw imageNotFound();
          await checkVariant(tx, productId, input.variantId);

          if (input.isPrimary && !target.isPrimary) {
            await images.unsetPrimary(tx, productId, attribution);
          }
          const row = await images.update(tx, imageId, {
            url: input.url,
            alt: input.alt,
            variantId: input.variantId,
            isPrimary: input.isPrimary,
            ...attribution,
          });
          return toProductImage(row);
        },
        actorId,
      );
    },

    /**
     * Deletes an image. The last image of an ACTIVE product cannot go (`409 LAST_IMAGE`);
     * deleting the primary promotes the remaining image with the lowest sortOrder.
     */
    delete(actorId: string, productId: string, imageId: string): Promise<void> {
      return onProduct(
        productId,
        async (tx, product, attribution) => {
          const existing = await images.list(tx, productId);
          const target = existing.find((image) => image.id === imageId);
          if (!target) throw imageNotFound();
          if (product.status === 'ACTIVE' && existing.length === 1) {
            throw catalogError(
              'LAST_IMAGE',
              'An active product must keep at least one image. Deactivate the product first.',
            );
          }
          await images.delete(tx, imageId);
          const next = existing.find((image) => image.id !== imageId);
          if (target.isPrimary && next) {
            await images.update(tx, next.id, { isPrimary: true, ...attribution });
          }
        },
        actorId,
      );
    },

    /**
     * Rewrites sortOrder to 0..n-1 in the given order. The list must be exactly the product's
     * image ids (none missing, repeated, or foreign), otherwise `400`.
     */
    reorder(
      actorId: string,
      productId: string,
      input: ReorderImagesRequest,
    ): Promise<ProductImage[]> {
      return onProduct(
        productId,
        async (tx, _product, attribution) => {
          const existing = await images.list(tx, productId);
          const current = new Set(existing.map((image) => image.id));
          const exact =
            input.imageIds.length === current.size && input.imageIds.every((id) => current.has(id));
          if (!exact) {
            throw new DomainError(
              'VALIDATION_FAILED',
              400,
              "imageIds must list each of the product's images exactly once.",
            );
          }
          const rows = [];
          for (const [sortOrder, id] of input.imageIds.entries()) {
            rows.push(await images.update(tx, id, { sortOrder, ...attribution }));
          }
          return rows.map(toProductImage);
        },
        actorId,
      );
    },
  };
}

export type ImageService = ReturnType<typeof createImageService>;
