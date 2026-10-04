export type StockDeltaReading = { ok: true; delta: number } | { ok: false; message: string };

/**
 * Reads a stock adjustment typed by staff: a whole number other than zero, with an optional
 * sign ("+5" adds five, "-3" removes three). Malformed input is refused before any request;
 * the API decides the rest (the ±100,000 range, and that stock never goes below zero).
 */
export function parseStockDelta(input: string): StockDeltaReading {
  const text = input.trim();
  if (text === '') return { ok: false, message: 'Enter how many units to add or remove.' };
  if (!/^[+-]?\d+$/.test(text)) {
    return { ok: false, message: 'Enter a whole number, for example 5 or -3.' };
  }
  const delta = Number(text);
  if (!Number.isSafeInteger(delta)) return { ok: false, message: 'The number is too large.' };
  if (delta === 0) return { ok: false, message: 'Enter a number other than 0.' };
  return { ok: true, delta };
}

/** What an adjustment will do, in words (shown while typing). */
export function describeDelta(delta: number): string {
  const units = (n: number) => `${n} ${n === 1 ? 'unit' : 'units'}`;
  return delta > 0 ? `Adds ${units(delta)}` : `Removes ${units(-delta)}`;
}
