import { CATALOG_PRICE_MAX, type Price } from '@ite/contracts';

import { catalogError } from './errors.ts';

/*
 * Catalog money (product-domain design D1, D2). Request bodies are already validated by the
 * `Price` contract (integer minor units, 0 to the catalog maximum, ISO 4217 code); these helpers
 * add the one rule that needs server configuration, the store currency, and convert between
 * `Price` and the `*_amount` columns. Prices are stored without currency on variants: an override
 * is in its product's currency.
 */

/**
 * Checks that an incoming price uses the store currency and returns its amount for storage.
 * Throws `422 CURRENCY_MISMATCH` naming the field (e.g. `basePrice`) and the expected currency.
 */
export function storeAmount(price: Price, storeCurrency: string, field: string): number {
  if (price.currency !== storeCurrency) {
    throw catalogError('CURRENCY_MISMATCH', `${field} must be in ${storeCurrency}.`);
  }
  return price.amount;
}

/** Like `storeAmount` for a variant's `priceOverride`: null (no override) stays null. */
export function storeOverrideAmount(price: Price | null, storeCurrency: string): number | null {
  return price === null ? null : storeAmount(price, storeCurrency, 'priceOverride');
}

/**
 * A stored amount as `Price`. Stored amounts are within the catalog range (contract and database
 * check), so a value outside it is a bug and throws instead of producing an invalid response.
 */
export function toPrice(amount: number, currency: string): Price {
  if (!Number.isInteger(amount) || amount < 0 || amount > CATALOG_PRICE_MAX) {
    throw new RangeError('Stored catalog amount is outside the catalog price range.');
  }
  return { amount, currency };
}

type PricedProduct = { basePriceAmount: number; currency: string };
type PricedVariant = { priceOverrideAmount: number | null };

/** A variant's `priceOverride`: null when it has none (the base price applies). */
export function priceOverride(product: PricedProduct, variant: PricedVariant): Price | null {
  return variant.priceOverrideAmount === null
    ? null
    : toPrice(variant.priceOverrideAmount, product.currency);
}

/**
 * The price a variant sells at: its override when set (including an override of 0), otherwise
 * the product's base price. Always in the product's currency.
 */
export function effectivePrice(product: PricedProduct, variant: PricedVariant): Price {
  return toPrice(variant.priceOverrideAmount ?? product.basePriceAmount, product.currency);
}
