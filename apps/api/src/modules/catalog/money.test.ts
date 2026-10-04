import { CATALOG_PRICE_MAX, Price } from '@ite/contracts';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../../errors.ts';
import {
  effectivePrice,
  priceOverride,
  storeAmount,
  storeOverrideAmount,
  toPrice,
} from './money.ts';

describe('store currency', () => {
  it('returns the amount of a price in the store currency', () => {
    expect(storeAmount({ amount: 89_900_000, currency: 'IDR' }, 'IDR', 'basePrice')).toBe(
      89_900_000,
    );
  });

  it('rejects a foreign currency with 422 CURRENCY_MISMATCH', () => {
    let error: unknown;
    try {
      storeAmount({ amount: 5000, currency: 'USD' }, 'IDR', 'basePrice');
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      code: 'CURRENCY_MISMATCH',
      status: 422,
      detail: 'basePrice must be in IDR.',
    });
  });

  it('follows the configured store currency, not a hard-coded one', () => {
    expect(storeAmount({ amount: 5000, currency: 'USD' }, 'USD', 'basePrice')).toBe(5000);
    expect(() => storeAmount({ amount: 5000, currency: 'IDR' }, 'USD', 'basePrice')).toThrow(
      'basePrice must be in USD.',
    );
  });

  it('keeps a null override null and checks a set override', () => {
    expect(storeOverrideAmount(null, 'IDR')).toBeNull();
    expect(storeOverrideAmount({ amount: 0, currency: 'IDR' }, 'IDR')).toBe(0);
    expect(() => storeOverrideAmount({ amount: 1, currency: 'EUR' }, 'IDR')).toThrow(
      expect.objectContaining({
        code: 'CURRENCY_MISMATCH',
        detail: 'priceOverride must be in IDR.',
      }),
    );
  });
});

describe('price boundaries', () => {
  it('the Price contract accepts 0 and the catalog maximum and rejects just outside', () => {
    expect(Price.safeParse({ amount: 0, currency: 'IDR' }).success).toBe(true);
    expect(Price.safeParse({ amount: CATALOG_PRICE_MAX, currency: 'IDR' }).success).toBe(true);
    expect(Price.safeParse({ amount: CATALOG_PRICE_MAX + 1, currency: 'IDR' }).success).toBe(false);
    expect(Price.safeParse({ amount: -1, currency: 'IDR' }).success).toBe(false);
  });

  it('converts stored amounts at both bounds', () => {
    expect(toPrice(0, 'IDR')).toEqual({ amount: 0, currency: 'IDR' });
    expect(toPrice(CATALOG_PRICE_MAX, 'IDR')).toEqual({
      amount: CATALOG_PRICE_MAX,
      currency: 'IDR',
    });
  });

  it.each([-1, CATALOG_PRICE_MAX + 1, 1.5, Number.NaN])(
    'refuses to build a response price from an out-of-range stored amount (%s)',
    (amount) => {
      expect(() => toPrice(amount, 'IDR')).toThrow(RangeError);
    },
  );
});

describe('effective price', () => {
  const product = { basePriceAmount: 349_000_00, currency: 'IDR' };

  it('is the base price when there is no override', () => {
    const variant = { priceOverrideAmount: null };
    expect(priceOverride(product, variant)).toBeNull();
    expect(effectivePrice(product, variant)).toEqual({ amount: 349_000_00, currency: 'IDR' });
  });

  it('is the override when one is set', () => {
    const variant = { priceOverrideAmount: 369_000_00 };
    expect(priceOverride(product, variant)).toEqual({ amount: 369_000_00, currency: 'IDR' });
    expect(effectivePrice(product, variant)).toEqual({ amount: 369_000_00, currency: 'IDR' });
  });

  it('treats an override of 0 as an override, not as missing', () => {
    expect(effectivePrice(product, { priceOverrideAmount: 0 })).toEqual({
      amount: 0,
      currency: 'IDR',
    });
  });

  it("uses the product's currency for overrides", () => {
    expect(
      effectivePrice({ basePriceAmount: 100, currency: 'USD' }, { priceOverrideAmount: 90 }),
    ).toEqual({
      amount: 90,
      currency: 'USD',
    });
  });
});
