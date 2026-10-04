import { createHmac } from 'node:crypto';

import { PaginationQuery } from '@ite/contracts';
import { createPrismaClient, type PrismaClient } from '@ite/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase } from '../test/support/database.ts';
import { DomainError } from './errors.ts';
import {
  afterCursor,
  createCursorCodec,
  CURSOR_ORDER_BY,
  toPage,
  type CursorKey,
} from './pagination.ts';

const SECRET = 'test-session-secret-at-least-32-chars!!';
const codec = createCursorCodec(SECRET, 'admin.products');
const key: CursorKey = {
  createdAt: new Date('2026-10-04T08:15:30.123Z'),
  id: '01a105eb-cdee-7649-91a6-5b25ece11c16',
};

function expectInvalid(cursor: string, using = codec) {
  let error: unknown;
  try {
    using.decode(cursor);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(DomainError);
  expect(error).toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
  if (cursor.length > 8) expect((error as DomainError).detail).not.toContain(cursor);
}

describe('cursor encoding', () => {
  it('round-trips the sort key with millisecond precision', () => {
    const cursor = codec.encode(key);
    expect(codec.decode(cursor)).toEqual(key);
  });

  it('is opaque: URL-safe and without the raw values in clear text', () => {
    const cursor = codec.encode(key);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain(key.id);
    expect(cursor.length).toBeLessThanOrEqual(512);
    expect(PaginationQuery.parse({ cursor }).cursor).toBe(cursor);
  });

  it('is deterministic for the same key', () => {
    expect(codec.encode(key)).toBe(codec.encode({ ...key }));
  });
});

describe('cursor rejection', () => {
  it('rejects a tampered payload', () => {
    const [payload, signature] = codec.encode(key).split('.');
    const forged = Buffer.from(
      JSON.stringify({ v: 1, t: '2030-01-01T00:00:00.000Z', i: key.id }),
    ).toString('base64url');
    expectInvalid(`${forged}.${signature}`);
    const flipped = payload!.slice(0, -1) + (payload!.endsWith('A') ? 'B' : 'A');
    expectInvalid(`${flipped}.${signature}`);
  });

  it('rejects a tampered signature', () => {
    const [payload, signature] = codec.encode(key).split('.');
    const flipped = (signature!.startsWith('A') ? 'B' : 'A') + signature!.slice(1);
    expectInvalid(`${payload}.${flipped}`);
    expectInvalid(`${payload}.${signature!.slice(0, -2)}`);
    expectInvalid(`${payload}.${signature}A`);
  });

  it('rejects cursors signed with another secret or for another list', () => {
    const cursor = codec.encode(key);
    expectInvalid(
      cursor,
      createCursorCodec('another-secret-that-is-32-chars-long', 'admin.products'),
    );
    expectInvalid(cursor, createCursorCodec(SECRET, 'admin.categories'));
  });

  it.each(['', 'abc', '.', 'a.b.c', 'not base64!.sig', '%%%.%%%'])(
    'rejects malformed cursor %j',
    (cursor) => {
      expectInvalid(cursor);
    },
  );

  it.each([
    { v: 2, t: '2026-10-04T08:15:30.123Z', i: key.id },
    { v: 1, t: 'yesterday', i: key.id },
    { v: 1, t: '2026-10-04T08:15:30.123Z', i: 'not-a-uuid' },
    { v: 1, t: '2026-10-04T08:15:30.123Z', i: key.id, extra: true },
    [],
  ])('rejects a correctly signed payload that is not a valid key: %j', (json) => {
    // e.g. a cursor from a future format: the signature checks out, the content does not.
    const payload = Buffer.from(JSON.stringify(json)).toString('base64url');
    const signature = createHmac('sha256', SECRET)
      .update(`ite.cursor.v1\nadmin.products\n${payload}`)
      .digest('base64url');
    expectInvalid(`${payload}.${signature}`);
  });

  it('rejects a correctly signed payload that is not JSON', () => {
    const payload = Buffer.from('{oops').toString('base64url');
    const signature = createHmac('sha256', SECRET)
      .update(`ite.cursor.v1\nadmin.products\n${payload}`)
      .digest('base64url');
    expectInvalid(`${payload}.${signature}`);
  });
});

describe('page building', () => {
  const rows = Array.from({ length: 5 }, (_, n) => ({
    createdAt: new Date(Date.UTC(2026, 9, 4, 0, 0, 10 - n)),
    id: `01a105eb-cdee-7649-91a6-5b25ece11c1${n}`,
  }));

  it('returns limit rows and a cursor at the last one when more exist', () => {
    const page = toPage(rows, 4, codec);
    expect(page.rows).toEqual(rows.slice(0, 4));
    expect(codec.decode(page.nextCursor!)).toEqual(rows[3]);
  });

  it('returns no cursor on the last page', () => {
    expect(toPage(rows, 5, codec).nextCursor).toBeNull();
    expect(toPage(rows.slice(0, 2), 5, codec)).toEqual({
      rows: rows.slice(0, 2),
      nextCursor: null,
    });
    expect(toPage([], 20, codec)).toEqual({ rows: [], nextCursor: null });
  });

  it('uses the PaginationQuery limits: default 20, at most 100', () => {
    expect(PaginationQuery.parse({}).limit).toBe(20);
    expect(PaginationQuery.parse({ limit: '100' }).limit).toBe(100);
    expect(PaginationQuery.safeParse({ limit: '101' }).success).toBe(false);
    expect(PaginationQuery.safeParse({ limit: '0' }).success).toBe(false);
  });
});

describe('stable ordering', () => {
  it('orders by createdAt DESC, then id DESC', () => {
    expect(CURSOR_ORDER_BY).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('continues strictly after the cursor key, breaking createdAt ties by id', () => {
    expect(afterCursor(undefined)).toEqual({});
    expect(afterCursor(key)).toEqual({
      OR: [{ createdAt: { lt: key.createdAt } }, { createdAt: key.createdAt, id: { lt: key.id } }],
    });
  });

  describe('against PostgreSQL', () => {
    let db: PrismaClient;

    beforeAll(async () => {
      db = createPrismaClient(await createTestDatabase());
      const category = await db.category.create({ data: { name: 'Apparel', slug: 'apparel' } });
      // 25 products where groups of five share a createdAt, so ties must be broken by id.
      const base = Date.UTC(2026, 9, 1);
      for (let n = 0; n < 25; n++) {
        await db.product.create({
          data: {
            name: `Product ${n}`,
            slug: `product-${n}`,
            categoryId: category.id,
            basePriceAmount: 100,
            currency: 'IDR',
            createdAt: new Date(base + Math.floor(n / 5) * 1000),
          },
        });
      }
    });

    afterAll(async () => {
      await db?.$disconnect();
    });

    async function pageThrough(limit: number) {
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const after: CursorKey | undefined = cursor ? codec.decode(cursor) : undefined;
        const rows: CursorKey[] = await db.product.findMany({
          where: afterCursor(after),
          orderBy: [...CURSOR_ORDER_BY],
          take: limit + 1,
          select: { id: true, createdAt: true },
        });
        const page: { rows: CursorKey[]; nextCursor: string | null } = toPage(rows, limit, codec);
        seen.push(...page.rows.map((row) => row.id));
        cursor = page.nextCursor;
        pages++;
      } while (cursor);
      return { seen, pages };
    }

    it('pages through ties with no duplicates or gaps (20 then 5)', async () => {
      const all = await db.product.findMany({
        orderBy: [...CURSOR_ORDER_BY],
        select: { id: true },
      });
      const { seen, pages } = await pageThrough(20);
      expect(pages).toBe(2);
      expect(seen).toEqual(all.map((row) => row.id));
    });

    it.each([1, 3, 5, 7, 25, 100])('gives the same order for limit %i', async (limit) => {
      const all = await db.product.findMany({
        orderBy: [...CURSOR_ORDER_BY],
        select: { id: true },
      });
      expect((await pageThrough(limit)).seen).toEqual(all.map((row) => row.id));
    });
  });
});
