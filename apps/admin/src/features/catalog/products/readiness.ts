/**
 * Lays out the API's PRODUCT_NOT_READY detail as a lead sentence and a list, using the API's
 * own words: "The product is not ready to activate: a; b; c." → lead + [A, B, C]. This is
 * formatting only; readiness is never recomputed here. Text in any other form returns null,
 * and callers show it verbatim.
 */
export function readinessReasons(detail: string): { lead: string; reasons: string[] } | null {
  const match = /^(.+?):\s*(.+?)\.?$/.exec(detail.trim());
  if (!match) return null;
  const [, lead = '', list = ''] = match;
  const reasons = list
    .split(';')
    .map((reason) => reason.trim())
    .filter(Boolean)
    .map((reason) => reason.charAt(0).toUpperCase() + reason.slice(1));
  return reasons.length > 0 ? { lead: `${lead}:`, reasons } : null;
}
