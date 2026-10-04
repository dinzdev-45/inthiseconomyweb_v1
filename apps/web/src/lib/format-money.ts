import type { Money } from '@ite/contracts';

/**
 * ISO 4217 minor-unit digits where they differ from the default of 2. `Money`
 * stores integer minor units, so this converts the integer to a decimal value.
 * (Intl's digits are display conventions and can differ: CLDR shows IDR with 0
 * decimals although its ISO minor unit is 2.)
 */
const MINOR_UNIT_DIGITS: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4,
};

/** Locale used to present a currency; defaults to en-US. */
const CURRENCY_LOCALE: Readonly<Record<string, string>> = { IDR: 'id-ID' };

export function minorUnitDigits(currency: string): number {
  return MINOR_UNIT_DIGITS[currency] ?? 2;
}

/**
 * Formats a `Money` value for display, e.g. `{ amount: 129900000, currency: 'IDR' }`
 * → "Rp 1.299.000" and `{ amount: 8900, currency: 'USD' }` → "$89.00". Decimal places
 * follow the currency's display convention (Intl/CLDR). Works for any ISO 4217 code.
 */
export function formatMoney(money: Money, locale?: string): string {
  const value = money.amount / 10 ** minorUnitDigits(money.currency);
  return new Intl.NumberFormat(locale ?? CURRENCY_LOCALE[money.currency] ?? 'en-US', {
    style: 'currency',
    currency: money.currency,
  }).format(value);
}
