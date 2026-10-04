import { describe, expect, it } from 'vitest';

import { formatMoney, minorUnitDigits, parseMajorAmount, toMajorUnits } from './money.ts';

// Intl separates symbol and number with a no-break space in some locales.
const plain = (value: string) => value.replace(/\u00a0/g, ' ');

describe('minorUnitDigits', () => {
  it('knows ISO 4217 minor units (IDR has 2 although it displays none)', () => {
    expect(minorUnitDigits('IDR')).toBe(2);
    expect(minorUnitDigits('USD')).toBe(2);
    expect(minorUnitDigits('JPY')).toBe(0);
    expect(minorUnitDigits('KWD')).toBe(3);
    expect(minorUnitDigits('CLF')).toBe(4);
  });
});

describe('formatMoney', () => {
  it.each([
    [{ amount: 89_900_000, currency: 'IDR' }, 'Rp 899.000'],
    [{ amount: 129_900_000, currency: 'IDR' }, 'Rp 1.299.000'],
    [{ amount: 0, currency: 'IDR' }, 'Rp 0'],
    [{ amount: 8_900, currency: 'USD' }, '$89.00'],
    [{ amount: 1_999, currency: 'EUR' }, '€19.99'],
    [{ amount: 1_299_000, currency: 'JPY' }, '¥1,299,000'],
    [{ amount: 12_345, currency: 'KWD' }, 'KWD 12.345'],
  ])('formats %j as %s', (money, expected) => {
    expect(plain(formatMoney(money))).toBe(expected);
  });

  it('formats exactly where float division would drift', () => {
    // 0.1 + 0.2-style artefacts: the exact decimal string reaches Intl.
    expect(formatMoney({ amount: 30, currency: 'USD' })).toBe('$0.30');
    expect(formatMoney({ amount: 9_007_199_254_740_991, currency: 'USD' })).toBe(
      '$90,071,992,547,409.91',
    );
  });

  it('accepts an explicit locale', () => {
    expect(plain(formatMoney({ amount: 89_900_000, currency: 'IDR' }, 'en-US'))).toBe(
      'IDR 899,000',
    );
  });
});

describe('toMajorUnits', () => {
  it.each([
    [89_900_000, 'IDR', '899000'],
    [89_900_050, 'IDR', '899000.5'],
    [1_999, 'USD', '19.99'],
    [5, 'USD', '0.05'],
    [0, 'USD', '0'],
    [1_299_000, 'JPY', '1299000'],
    [12_345, 'KWD', '12.345'],
    [-150, 'USD', '-1.5'],
  ])('%i %s → %s', (amount, currency, expected) => {
    expect(toMajorUnits(amount, currency)).toBe(expected);
  });

  it('rejects non-integer amounts', () => {
    expect(() => toMajorUnits(1.5, 'USD')).toThrow(RangeError);
  });
});

describe('parseMajorAmount', () => {
  it.each([
    ['899000', 'IDR', 89_900_000],
    ['  899000  ', 'IDR', 89_900_000],
    ['899000.5', 'IDR', 89_900_050],
    ['899000.50', 'IDR', 89_900_050],
    ['0', 'IDR', 0],
    ['0.07', 'USD', 7],
    ['19.99', 'USD', 1_999],
    ['007', 'USD', 700],
    ['1299000', 'JPY', 1_299_000],
    ['12.345', 'KWD', 12_345],
    ['20000000', 'IDR', 2_000_000_000],
    ['20000000.01', 'IDR', 2_000_000_001],
  ])('reads %j in %s as %i minor units', (input, currency, amount) => {
    expect(parseMajorAmount(input, currency)).toEqual({ ok: true, amount });
  });

  it('round-trips with toMajorUnits without drift', () => {
    for (const amount of [0, 1, 7, 30, 1_999, 89_900_000, 89_900_099, 2_000_000_000]) {
      expect(parseMajorAmount(toMajorUnits(amount, 'IDR'), 'IDR')).toEqual({ ok: true, amount });
    }
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['abc', 'invalid'],
    ['899,000', 'invalid'],
    ['899.000.00', 'invalid'],
    ['1e6', 'invalid'],
    ['Rp 899000', 'invalid'],
    ['.5', 'invalid'],
    ['5.', 'invalid'],
    ['+5', 'invalid'],
    ['NaN', 'invalid'],
    ['Infinity', 'invalid'],
    ['-1', 'negative'],
    ['- 25', 'negative'],
    ['12.345', 'too_precise'],
    ['899000.001', 'too_precise'],
    ['99999999999999999999', 'too_large'],
  ])('rejects %j (%s) for IDR', (input, error) => {
    const result = parseMajorAmount(input, 'IDR');
    expect(result).toMatchObject({ ok: false, error });
    expect(result.ok ? '' : result.message).not.toBe('');
  });

  it('rejects any decimals for zero-decimal currencies', () => {
    expect(parseMajorAmount('100.5', 'JPY')).toEqual({
      ok: false,
      error: 'too_precise',
      message: 'JPY amounts have no decimal places.',
    });
    expect(parseMajorAmount('12.3456', 'KWD')).toMatchObject({ error: 'too_precise' });
  });

  it('leaves business limits to the API', () => {
    // Above the catalog price maximum, but a well-formed amount: the API decides.
    expect(parseMajorAmount('99999999', 'IDR')).toEqual({ ok: true, amount: 9_999_999_900 });
  });
});
