import { parseMajorAmount, type Price } from '@ite/contracts';

export type PriceReading = { ok: true; price: Price } | { ok: false; message: string };

/**
 * Reads a price typed in major units (e.g. "899000") from a form field, in the store currency.
 * The single place admin forms turn price text into `{ amount, currency }`: malformed input is
 * refused here, before any request; range limits are left to the API.
 */
export function readPrice(input: string, storeCurrency: string): PriceReading {
  const result = parseMajorAmount(input, storeCurrency);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, price: { amount: result.amount, currency: storeCurrency } };
}

/** Like `readPrice`, but an empty field means "no price" (e.g. clearing a price override). */
export function readOptionalPrice(
  input: string,
  storeCurrency: string,
): { ok: true; price: Price | null } | { ok: false; message: string } {
  return input.trim() === '' ? { ok: true, price: null } : readPrice(input, storeCurrency);
}
