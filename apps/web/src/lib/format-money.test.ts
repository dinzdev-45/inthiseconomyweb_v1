import { describe, expect, it } from 'vitest';

import { formatMoney, minorUnitDigits } from './format-money.ts';

// Intl separates symbol and number with a no-break space in some locales.
const plain = (value: string) => value.replace(/\u00a0/g, ' ');

describe('storefront-homepage: Product cards', () => {
  it('Price formatting', () => {
    expect(plain(formatMoney({ amount: 129_900_000, currency: 'IDR' }))).toBe('Rp 1.299.000');
    expect(formatMoney({ amount: 8_900, currency: 'USD' })).toBe('$89.00');
    // Never the raw minor-unit integer.
    expect(formatMoney({ amount: 129_900_000, currency: 'IDR' })).not.toContain('129900000');
    expect(formatMoney({ amount: 8_900, currency: 'USD' })).not.toContain('8900');
  });
});

describe('formatMoney', () => {
  it.each([
    [{ amount: 1_299_000, currency: 'JPY' }, '¥1,299,000'],
    [{ amount: 12_345, currency: 'KWD' }, 'KWD 12.345'],
    [{ amount: 1_999, currency: 'EUR' }, '€19.99'],
    [{ amount: 0, currency: 'IDR' }, 'Rp 0'],
  ])('formats %j as %s', (money, expected) => {
    expect(plain(formatMoney(money))).toBe(expected);
  });

  it('accepts an explicit locale', () => {
    expect(plain(formatMoney({ amount: 129_900_000, currency: 'IDR' }, 'en-US'))).toBe(
      'IDR 1,299,000',
    );
  });

  it('knows ISO 4217 minor units (IDR has 2 although it displays none)', () => {
    expect(minorUnitDigits('IDR')).toBe(2);
    expect(minorUnitDigits('JPY')).toBe(0);
    expect(minorUnitDigits('BHD')).toBe(3);
    expect(minorUnitDigits('SGD')).toBe(2);
  });
});
