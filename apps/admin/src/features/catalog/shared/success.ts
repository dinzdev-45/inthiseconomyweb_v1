/** A monotonic order for success messages (several actions on one page each keep their own). */
let counter = 0;
export function nextSuccessAt(): number {
  counter += 1;
  return counter;
}

/**
 * The newest success message among several actions on one page, so an older message never hides
 * a newer one (e.g. a row change after a create, or the reverse).
 */
export function latestSuccess(
  ...actions: { success: string | null; successAt: number }[]
): string | null {
  let latest: { success: string | null; successAt: number } | undefined;
  for (const action of actions) {
    if (action.success && (!latest || action.successAt > latest.successAt)) latest = action;
  }
  return latest?.success ?? null;
}
