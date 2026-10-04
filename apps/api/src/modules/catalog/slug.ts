import { isSlugConflict } from './errors.ts';

/** Longest slug allowed (matches the `Slug` contract and the database check). */
export const SLUG_MAX_LENGTH = 80;

/** Slug used when a name has no letters or digits left after slugifying. */
export type SlugFallback = 'product' | 'category' | 'color';

/** Cuts a slug to `max` characters without leaving a trailing hyphen. */
function truncate(slug: string, max: number): string {
  return slug.slice(0, max).replace(/-+$/, '');
}

/**
 * Turns a display name into a slug (product-domain design D4): NFKD-normalize and strip
 * diacritics, lowercase, collapse every run of other characters into one hyphen, trim hyphens,
 * and cut to 80 characters. A name with nothing usable left gets `fallback`.
 */
export function slugify(name: string, fallback: SlugFallback): string {
  const slug = truncate(
    name
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
    SLUG_MAX_LENGTH,
  );
  return slug === '' ? fallback : slug;
}

/** `base` with suffix `-n` (n ≥ 2), shortening `base` so the result still fits 80 characters. */
export function suffixedSlug(base: string, n: number): string {
  const suffix = `-${n}`;
  return `${truncate(base, SLUG_MAX_LENGTH - suffix.length)}${suffix}`;
}

/**
 * The prefix every candidate for `base` starts with (`base` itself, or `base` shortened to make
 * room for a suffix of up to nine digits). Querying slugs that start with it finds every
 * existing slug that could collide with a candidate.
 */
export function slugSearchPrefix(base: string): string {
  return truncate(base, SLUG_MAX_LENGTH - 10);
}

/**
 * The first free candidate for a generated slug: `base` itself, then `base-2`, `base-3`, …
 * Deterministic: the same `taken` set always gives the same answer.
 */
export function firstFreeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = suffixedSlug(base, n);
    if (!taken.has(candidate)) return candidate;
  }
}

/** Attempts for a generated slug: the first pick, plus one retry after a concurrent insert took it. */
export const GENERATED_SLUG_ATTEMPTS = 2;

type GeneratedSlugDeps<T> = {
  /** Existing slugs (of the same table) that start with `prefix`, including archived rows. */
  findSlugsWithPrefix: (prefix: string) => Promise<readonly string[]>;
  /**
   * Inserts the row with `slug`; a slug collision must surface as the unique violation. Each
   * call must be its own statement or transaction: a failed statement aborts an enclosing
   * PostgreSQL transaction, so a retry inside it would fail too.
   */
  insert: (slug: string) => Promise<T>;
};

/**
 * Inserts a row whose slug was generated from its name (no explicit slug given): picks the
 * smallest free suffix, and if a concurrent insert takes that slug first (unique violation),
 * looks again and retries once. The database unique index stays the source of truth, so two
 * writers can never end up with the same slug. Explicit slugs must NOT use this: they are
 * inserted as given, and a collision maps to `409 SLUG_EXISTS`.
 */
export async function insertWithGeneratedSlug<T>(
  base: string,
  { findSlugsWithPrefix, insert }: GeneratedSlugDeps<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const taken = new Set(await findSlugsWithPrefix(slugSearchPrefix(base)));
    try {
      return await insert(firstFreeSlug(base, taken));
    } catch (error) {
      if (attempt >= GENERATED_SLUG_ATTEMPTS || !isSlugConflict(error)) throw error;
    }
  }
}
