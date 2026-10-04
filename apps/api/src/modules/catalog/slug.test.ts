import { Slug } from '@ite/contracts';
import { Prisma } from '@ite/db';
import { describe, expect, it, vi } from 'vitest';

import {
  firstFreeSlug,
  insertWithGeneratedSlug,
  slugify,
  slugSearchPrefix,
  suffixedSlug,
} from './slug.ts';

/** A unique violation shaped like the pg driver adapter reports it. */
function uniqueViolation(constraint: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: {
      driverAdapterError: {
        cause: {
          originalCode: '23505',
          kind: 'UniqueConstraintViolation',
          constraint: { index: constraint },
        },
      },
    },
  });
}

describe('slugify', () => {
  it.each([
    ['Rent Due Coach Jacket', 'rent-due-coach-jacket'],
    ['Inflation Tee', 'inflation-tee'],
    ['  Overdraft   Hoodie  ', 'overdraft-hoodie'],
    ['Crème Brûlée Ñandú Façade', 'creme-brulee-nandu-facade'],
    ['Ｆｕｌｌｗｉｄｔｈ ２０２６', 'fullwidth-2026'],
    ['Rent/Due — "Coach" Jacket!!', 'rent-due-coach-jacket'],
    ['30/32 Cargo', '30-32-cargo'],
    ['--Already-Kebab--', 'already-kebab'],
    ['UPPER_snake_Case', 'upper-snake-case'],
  ])('slugifies %j as %j', (name, slug) => {
    expect(slugify(name, 'product')).toBe(slug);
  });

  it('cuts to 80 characters without a trailing hyphen', () => {
    const slug = slugify(`${'a'.repeat(79)} b`, 'product');
    expect(slug).toBe('a'.repeat(79));
    expect(slugify('word '.repeat(40), 'product').length).toBeLessThanOrEqual(80);
    expect(slugify('word '.repeat(40), 'product')).not.toMatch(/-$/);
  });

  it.each([
    ['', 'product'],
    ['!!! ???', 'category'],
    ['日本語', 'color'],
  ] as const)('falls back to %j → %j when nothing usable remains', (name, fallback) => {
    expect(slugify(name, fallback)).toBe(fallback);
  });

  it('always produces a slug the contract accepts', () => {
    for (const name of ['Ä', 'a—b', `${'x-'.repeat(60)}`, '  ', 'Price Tag Cap', '%_%']) {
      expect(Slug.safeParse(slugify(name, 'product')).success).toBe(true);
    }
  });
});

describe('generated slug suffixes', () => {
  it('keeps the base when it is free', () => {
    expect(firstFreeSlug('inflation-tee', new Set(['other']))).toBe('inflation-tee');
  });

  it('picks -2, -3, … in order', () => {
    expect(firstFreeSlug('inflation-tee', new Set(['inflation-tee']))).toBe('inflation-tee-2');
    expect(firstFreeSlug('inflation-tee', new Set(['inflation-tee', 'inflation-tee-2']))).toBe(
      'inflation-tee-3',
    );
  });

  it('picks the smallest free suffix, filling gaps', () => {
    const taken = new Set(['tee', 'tee-2', 'tee-4', 'tee-5']);
    expect(firstFreeSlug('tee', taken)).toBe('tee-3');
  });

  it('ignores unrelated slugs that share the prefix', () => {
    const taken = new Set(['tee', 'tee-shirt', 'tee-2-pack']);
    expect(firstFreeSlug('tee', taken)).toBe('tee-2');
  });

  it('is deterministic for the same input', () => {
    const taken = new Set(['cap', 'cap-2']);
    expect(firstFreeSlug('cap', taken)).toBe(firstFreeSlug('cap', new Set(taken)));
  });

  it('shortens a long base so the suffixed slug fits 80 characters', () => {
    const base = 'a'.repeat(76) + '-bcd';
    expect(base).toHaveLength(80);
    expect(suffixedSlug(base, 2)).toBe(`${'a'.repeat(76)}-b-2`);
    expect(suffixedSlug(base, 12)).toBe(`${'a'.repeat(76)}-12`);
    expect(suffixedSlug(base, 123)).toBe(`${'a'.repeat(76)}-123`);
    expect(suffixedSlug('a'.repeat(77) + '-cd', 2)).toBe(`${'a'.repeat(77)}-2`);
    for (const n of [2, 99, 12345])
      expect(Slug.safeParse(suffixedSlug(base, n)).success).toBe(true);
  });

  it('searches with a prefix every candidate starts with', () => {
    const base = 'b'.repeat(80);
    const prefix = slugSearchPrefix(base);
    for (const n of [2, 10, 999_999_999])
      expect(suffixedSlug(base, n).startsWith(prefix)).toBe(true);
    expect(slugSearchPrefix('inflation-tee')).toBe('inflation-tee');
  });
});

describe('insertWithGeneratedSlug', () => {
  it('inserts the first free slug', async () => {
    const insert = vi.fn(async (slug: string) => ({ slug }));
    const findSlugsWithPrefix = vi.fn(async () => ['inflation-tee']);
    await expect(
      insertWithGeneratedSlug('inflation-tee', { findSlugsWithPrefix, insert }),
    ).resolves.toEqual({
      slug: 'inflation-tee-2',
    });
    expect(findSlugsWithPrefix).toHaveBeenCalledWith('inflation-tee');
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('retries once with the next suffix after a concurrent insert takes the slug', async () => {
    const existing = ['tee'];
    const insert = vi.fn(async (slug: string) => {
      if (slug === 'tee-2' && !existing.includes('tee-2')) {
        existing.push('tee-2'); // a concurrent writer won the race
        throw uniqueViolation('products_slug_key');
      }
      return { slug };
    });
    const result = await insertWithGeneratedSlug('tee', {
      findSlugsWithPrefix: async () => [...existing],
      insert,
    });
    expect(result).toEqual({ slug: 'tee-3' });
    expect(insert.mock.calls.map(([slug]) => slug)).toEqual(['tee-2', 'tee-3']);
  });

  it('gives up after the retry and surfaces the slug conflict', async () => {
    const conflict = uniqueViolation('products_slug_key');
    const insert = vi.fn(async () => {
      throw conflict;
    });
    await expect(
      insertWithGeneratedSlug('tee', { findSlugsWithPrefix: async () => [], insert }),
    ).rejects.toBe(conflict);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const skuConflict = uniqueViolation('product_variants_sku_key');
    const boom = new Error('connection lost');
    for (const error of [skuConflict, boom]) {
      const insert = vi.fn(async () => {
        throw error;
      });
      await expect(
        insertWithGeneratedSlug('tee', { findSlugsWithPrefix: async () => [], insert }),
      ).rejects.toBe(error);
      expect(insert).toHaveBeenCalledTimes(1);
    }
  });
});
