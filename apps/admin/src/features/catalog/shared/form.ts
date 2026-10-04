/** A text field's value, trimmed ("" when absent). */
export function textValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * A number field as the API should receive it: a number when the text is numeric, otherwise
 * the raw text (so the API's own validation reports it at this field), or undefined when empty.
 */
export function numberValue(form: FormData, name: string): number | string | undefined {
  const text = textValue(form, name);
  if (text === '') return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}

/**
 * The fields of `next` whose values differ from `initial`, for partial updates (`PATCH` sends
 * only what changed). Undefined values in `next` are ignored.
 */
export function changedFields<T extends Record<string, unknown>>(
  initial: T,
  next: { [K in keyof T]?: T[K] },
): Partial<T> {
  const changes: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    const value = next[key];
    if (value !== undefined && value !== initial[key]) changes[key] = value;
  }
  return changes;
}
