import { describe, expect, it } from 'vitest';

import { readOptionalPrice, readPrice } from './money-input.ts';

describe('readPrice', () => {
  it('reads major units into a price in the store currency', () => {
    expect(readPrice('899000', 'IDR')).toEqual({
      ok: true,
      price: { amount: 89_900_000, currency: 'IDR' },
    });
    expect(readPrice('19.99', 'USD')).toEqual({
      ok: true,
      price: { amount: 1_999, currency: 'USD' },
    });
  });

  it.each(['abc', '12.345', '', '-5', '899,000'])('refuses %j before any request', (input) => {
    const result = readPrice(input, 'IDR');
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.message).not.toBe('');
  });
});

describe('readOptionalPrice', () => {
  it('treats an empty field as no price', () => {
    expect(readOptionalPrice('  ', 'IDR')).toEqual({ ok: true, price: null });
    expect(readOptionalPrice('949000', 'IDR')).toEqual({
      ok: true,
      price: { amount: 94_900_000, currency: 'IDR' },
    });
    expect(readOptionalPrice('x', 'IDR').ok).toBe(false);
  });
});
