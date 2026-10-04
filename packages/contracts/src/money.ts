import type { Money } from './primitives.ts';

/*
 * Money helpers shared by the storefront and the admin. `Money` stores integer minor units, so
 * conversions between minor units and the major-unit text people read and type use integer
 * (string/BigInt) arithmetic only: no floating-point division or multiplication, so no drift.
 * Business limits (such as the catalog price maximum) stay with the API.
 */

/**
 * ISO 4217 minor-unit digits where they differ from the default of 2. (Intl's digits are
 * display conventions and can differ: CLDR shows IDR with 0 decimals although its ISO minor
 * unit is 2.)
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

/** The ISO 4217 number of minor-unit digits for a currency (2 unless listed otherwise). */
export function minorUnitDigits(currency: string): number {
  return MINOR_UNIT_DIGITS[currency] ?? 2;
}

/**
 * An integer minor-unit amount as exact major-unit text without grouping, e.g. 89900000 IDR →
 * "899000", 1999 USD → "19.99", 5 USD → "0.05", 1299000 JPY → "1299000". Trailing zero decimals
 * are dropped. Suitable for prefilling a form input that `parseMajorAmount` reads back.
 */
export function toMajorUnits(amount: number, currency: string): string {
  if (!Number.isSafeInteger(amount)) throw new RangeError('Money amounts are safe integers.');
  const digits = minorUnitDigits(currency);
  const sign = amount < 0 ? '-' : '';
  const raw = Math.abs(amount)
    .toString()
    .padStart(digits + 1, '0');
  const whole = raw.slice(0, raw.length - digits);
  const fraction = raw.slice(raw.length - digits).replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

/**
 * Formats a `Money` value for display, e.g. `{ amount: 129900000, currency: 'IDR' }`
 * → "Rp 1.299.000" and `{ amount: 8900, currency: 'USD' }` → "$89.00". Decimal places
 * follow the currency's display convention (Intl/CLDR). Works for any ISO 4217 code.
 * The amount reaches Intl as an exact decimal string, never a rounded float.
 */
export function formatMoney(money: Money, locale?: string): string {
  return new Intl.NumberFormat(locale ?? CURRENCY_LOCALE[money.currency] ?? 'en-US', {
    style: 'currency',
    currency: money.currency,
  }).format(toMajorUnits(money.amount, money.currency) as `${number}`);
}

/** Why a major-unit input could not be read as an amount. */
export type MoneyInputError = 'empty' | 'invalid' | 'negative' | 'too_precise' | 'too_large';

export type MoneyInputResult =
  { ok: true; amount: number } | { ok: false; error: MoneyInputError; message: string };

const fail = (error: MoneyInputError, message: string): MoneyInputResult => ({
  ok: false,
  error,
  message,
});

/**
 * Reads a major-unit amount typed by a person (e.g. "899000" or "19.99") as integer minor units
 * in `currency` (899000 IDR → 89900000). Accepts digits with an optional "." decimal part of at
 * most the currency's minor-unit digits; surrounding spaces are ignored. Rejects, without
 * guessing: empty input, grouping separators or other characters, negative amounts, extra
 * decimal places, and values beyond the safe integer range. Zero is accepted; whether an
 * amount is allowed for a field (for example the catalog price maximum) is the API's decision.
 */
export function parseMajorAmount(input: string, currency: string): MoneyInputResult {
  const text = input.trim();
  if (text === '') return fail('empty', 'Enter an amount.');
  if (/^-\s*\d/.test(text)) return fail('negative', 'The amount cannot be negative.');
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return fail('invalid', 'Enter the amount in digits only, for example 899000.');

  const digits = minorUnitDigits(currency);
  const [, whole = '', fraction = ''] = match;
  if (fraction.length > digits) {
    return fail(
      'too_precise',
      digits === 0
        ? `${currency} amounts have no decimal places.`
        : `Use at most ${digits} decimal places for ${currency}.`,
    );
  }
  const minor = BigInt(whole) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return fail('too_large', 'The amount is too large.');
  return { ok: true, amount: Number(minor) };
}
