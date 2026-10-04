import type {
  CreateVariantRequest,
  ProductVariant,
  StockAdjustmentResult,
  UpdateVariantRequest,
} from '@ite/contracts';
import { STOCK_MAX } from '@ite/contracts';
import { withAttribution, type VariantStatus } from '@ite/db';

import type { Clock } from '../../../clock.ts';
import { DomainError } from '../../../errors.ts';
import { catalogError, rethrowCatalogError } from '../errors.ts';
import { storeOverrideAmount } from '../money.ts';
import { toProductVariant } from '../products/mappers.ts';
import type { LockedProduct, LockedVariant, ProductRepository } from '../products/repository.ts';
import { hasQualifyingVariant } from '../readiness.ts';
import type { VariantRepository } from './repository.ts';

type Tx = Parameters<Parameters<ProductRepository['transaction']>[0]>[0];

const productNotFound = () => new DomainError('NOT_FOUND', 404, 'Product not found.');
const variantNotFound = () => new DomainError('NOT_FOUND', 404, 'Variant not found.');
const archived = () =>
  catalogError(
    'INVALID_STATE_TRANSITION',
    'Archived products cannot be edited. Restore the product first.',
  );
const lastActiveVariant = () =>
  catalogError(
    'LAST_ACTIVE_VARIANT',
    'An active product must keep at least one active variant priced above zero.',
  );

type Deps = {
  products: ProductRepository;
  variants: VariantRepository;
  clock: Clock;
  /** STORE_CURRENCY: price overrides must use it (design D2). */
  storeCurrency: string;
};

/** Variants and stock (product-variants-inventory spec). */
export function createVariantService({ products, variants, clock, storeCurrency }: Deps) {
  /**
   * Runs `fn` with the product (and, when asked, all its variants) locked in the fixed order,
   * after rejecting unknown and ARCHIVED products. Constraint violations map to catalog errors.
   */
  async function onProduct<T>(
    productId: string,
    fn: (tx: Tx, product: LockedProduct) => Promise<T>,
  ): Promise<T> {
    try {
      return await products.transaction(async (tx) => {
        const product = await products.lockProduct(tx, productId);
        if (!product) throw productNotFound();
        if (product.status === 'ARCHIVED') throw archived();
        return fn(tx, product);
      });
    } catch (error) {
      return rethrowCatalogError(error, 'write');
    }
  }

  /** Locks the product's variants and returns them with the one addressed (404 if not its own). */
  async function lockTarget(tx: Tx, productId: string, variantId: string) {
    const locked = await products.lockVariants(tx, productId);
    const target = locked.find((variant) => variant.id === variantId);
    if (!target) throw variantNotFound();
    return { locked, target };
  }

  /** Whether an ACTIVE product stays ready after the target variant changes to `next`. */
  function staysReady(
    product: LockedProduct,
    locked: readonly LockedVariant[],
    targetId: string,
    next: Pick<LockedVariant, 'status' | 'priceOverrideAmount'>,
  ): boolean {
    if (product.status !== 'ACTIVE') return true;
    const after = locked.map((variant) =>
      variant.id === targetId ? { ...variant, ...next } : variant,
    );
    return hasQualifyingVariant(product.basePriceAmount, after);
  }

  async function setStatus(
    actorId: string,
    productId: string,
    variantId: string,
    to: VariantStatus,
  ): Promise<ProductVariant> {
    return onProduct(productId, async (tx, product) => {
      const { locked, target } = await lockTarget(tx, productId, variantId);
      if (target.status === to) {
        throw catalogError(
          'INVALID_STATE_TRANSITION',
          to === 'ACTIVE' ? 'The variant is already active.' : 'The variant is already inactive.',
        );
      }
      if (!staysReady(product, locked, variantId, { ...target, status: to })) {
        throw lastActiveVariant();
      }
      const row = await variants.update(
        tx,
        variantId,
        withAttribution(actorId, { status: to, updatedAt: clock.now() }, 'update'),
      );
      return toProductVariant(product, row);
    });
  }

  return {
    /** Adds an ACTIVE variant to a product that is not ARCHIVED. */
    create(
      actorId: string,
      productId: string,
      input: CreateVariantRequest,
    ): Promise<ProductVariant> {
      const priceOverrideAmount = storeOverrideAmount(input.priceOverride ?? null, storeCurrency);
      return onProduct(productId, async (tx, product) => {
        const now = clock.now();
        const row = await variants.create(
          tx,
          withAttribution(
            actorId,
            {
              productId,
              sizeId: input.sizeId,
              colorId: input.colorId,
              sku: input.sku,
              priceOverrideAmount,
              stockQuantity: input.stockQuantity,
              createdAt: now,
              updatedAt: now,
            },
            'create',
          ),
        );
        return toProductVariant(product, row);
      });
    },

    /**
     * Changes size, color, SKU, or price override (never stock). The SKU is locked once the
     * product has been activated; on an ACTIVE product, an override that leaves no active
     * variant priced above zero is `409 LAST_ACTIVE_VARIANT`.
     */
    update(
      actorId: string,
      productId: string,
      variantId: string,
      input: UpdateVariantRequest,
    ): Promise<ProductVariant> {
      const priceOverrideAmount =
        input.priceOverride === undefined
          ? undefined
          : storeOverrideAmount(input.priceOverride, storeCurrency);
      return onProduct(productId, async (tx, product) => {
        const { locked, target } = await lockTarget(tx, productId, variantId);
        if (input.sku !== undefined && input.sku !== target.sku && product.activatedAt !== null) {
          throw catalogError(
            'SKU_LOCKED',
            'The SKU cannot change after the product has been activated.',
          );
        }
        if (
          priceOverrideAmount !== undefined &&
          !staysReady(product, locked, variantId, { ...target, priceOverrideAmount })
        ) {
          throw lastActiveVariant();
        }
        const row = await variants.update(
          tx,
          variantId,
          withAttribution(
            actorId,
            {
              sizeId: input.sizeId,
              colorId: input.colorId,
              sku: input.sku,
              priceOverrideAmount,
              updatedAt: clock.now(),
            },
            'update',
          ),
        );
        return toProductVariant(product, row);
      });
    },

    activate(actorId: string, productId: string, variantId: string) {
      return setStatus(actorId, productId, variantId, 'ACTIVE');
    },

    /** ACTIVE → INACTIVE; refused with `409 LAST_ACTIVE_VARIANT` if an ACTIVE product needs it. */
    deactivate(actorId: string, productId: string, variantId: string) {
      return setStatus(actorId, productId, variantId, 'INACTIVE');
    },

    /**
     * Adds `delta` to the stock in one atomic statement. Below zero: `409 INSUFFICIENT_STOCK`;
     * above the storable maximum: `400`; unknown variant: `404`; archived product: `409`.
     */
    async adjustStock(
      actorId: string,
      productId: string,
      variantId: string,
      delta: number,
    ): Promise<StockAdjustmentResult> {
      const stockQuantity = await variants.adjustStock(
        productId,
        variantId,
        delta,
        actorId,
        clock.now(),
      );
      if (stockQuantity !== null) return { variantId, stockQuantity };

      const state = await variants.stockState(productId, variantId);
      if (!state) throw variantNotFound();
      if (state.product.status === 'ARCHIVED') throw archived();
      if (state.stockQuantity + delta > STOCK_MAX) {
        throw new DomainError(
          'VALIDATION_FAILED',
          400,
          'The adjustment would exceed the maximum stock quantity.',
        );
      }
      throw catalogError(
        'INSUFFICIENT_STOCK',
        `Not enough stock: ${state.stockQuantity} available, adjustment of ${delta}.`,
      );
    },
  };
}

export type VariantService = ReturnType<typeof createVariantService>;
