import {
  CATALOG_PRICE_MAX,
  ProblemDetails,
  ProductDetail,
  ProductListResponse,
} from '@ite/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ADMIN_ORIGIN,
  createAuthHarness,
  createStaff,
  login,
  minutes,
  sessionCookie,
  type AuthHarness,
} from '../../../../test/support/auth.ts';

const PASSWORD = 'correct-horse-battery';
const UNKNOWN_ID = '0190a000-0000-7000-8000-000000000000';
let h: AuthHarness;
let owner: { id: string };
let admin: { id: string };
let ownerCookie: string;
let adminCookie: string;
let apparel: { id: string };

beforeAll(async () => {
  h = await createAuthHarness();
  owner = await createStaff(h.db, {
    email: 'owner@example.com',
    password: PASSWORD,
    role: 'OWNER',
  });
  admin = await createStaff(h.db, {
    email: 'admin@example.com',
    password: PASSWORD,
    role: 'ADMIN',
  });
  ownerCookie = sessionCookie(await login(h.app, 'owner@example.com', PASSWORD));
  adminCookie = sessionCookie(await login(h.app, 'admin@example.com', PASSWORD));
  apparel = await h.db.category.create({ data: { name: 'Apparel', slug: 'apparel' } });
});
afterAll(async () => h.close());

type Method = 'GET' | 'POST' | 'PATCH';
const call = (method: Method, url: string, payload?: object, cookie: string | null = ownerCookie) =>
  h.app.inject({
    method,
    url: `/api/v1/admin${url}`,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(method === 'GET' ? {} : { origin: ADMIN_ORIGIN }),
    },
    ...(payload ? { payload } : {}),
  });

function problem(res: { statusCode: number; json: () => unknown }, status: number, code?: string) {
  expect(res.statusCode).toBe(status);
  const body = ProblemDetails.parse(res.json());
  if (code) expect(body.code).toBe(code);
  return body;
}

const idr = (amount: number) => ({ amount, currency: 'IDR' });
const body = (overrides: object = {}) => ({
  name: 'Overdraft Hoodie',
  categoryId: apparel.id,
  basePrice: idr(89_900_000),
  ...overrides,
});
async function create(overrides: object = {}, cookie = ownerCookie) {
  const res = await call('POST', '/products', body(overrides), cookie);
  expect(res.statusCode, res.body).toBe(201);
  return ProductDetail.parse(res.json());
}

describe('product-management: Product identity and slug', () => {
  it('Slug generated from name', async () => {
    const product = await create({ name: 'Rent Due Coach Jacket' });
    expect(product.slug).toBe('rent-due-coach-jacket');
  });

  it('Generated slug avoids collision', async () => {
    await create({ name: 'Inflation Tee', slug: 'inflation-tee' });
    const second = await create({ name: 'Inflation Tee' });
    const third = await create({ name: 'Inflation  TEE!' });
    expect(second.slug).toBe('inflation-tee-2');
    expect(third.slug).toBe('inflation-tee-3');
  });

  it('Duplicate product slug', async () => {
    const taken = await create({ name: 'Budget Cut Shorts', slug: 'budget-cut-shorts' });
    const archived = await create({ name: 'Old Drop', slug: 'old-drop' });
    await h.db.product.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });
    const other = await create({ name: 'Other', slug: 'other-shorts' });
    const before = await h.db.product.count();

    // Create with a slug used by another product, including an archived one.
    problem(
      await call('POST', '/products', body({ slug: 'budget-cut-shorts' })),
      409,
      'SLUG_EXISTS',
    );
    problem(await call('POST', '/products', body({ slug: 'old-drop' })), 409, 'SLUG_EXISTS');
    // Update to a used slug.
    problem(await call('PATCH', `/products/${other.id}`, { slug: taken.slug }), 409, 'SLUG_EXISTS');
    problem(
      await call('PATCH', `/products/${other.id}`, { slug: 'old-drop', name: 'Renamed' }),
      409,
      'SLUG_EXISTS',
    );

    expect(await h.db.product.count()).toBe(before);
    expect(await h.db.product.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({
      slug: 'other-shorts',
      name: 'Other',
    });
  });

  it('allows changing the slug of a never-activated product', async () => {
    const product = await create({ name: 'Draft Cap' });
    const res = await call('PATCH', `/products/${product.id}`, { slug: 'price-tag-cap' });
    expect(res.statusCode).toBe(200);
    expect(ProductDetail.parse(res.json()).slug).toBe('price-tag-cap');
  });

  it('Slug locked after activation', async () => {
    const product = await create({ name: 'Locked Hoodie' });
    // Activated once, now INACTIVE (lifecycle endpoints arrive with variants; set it directly).
    await h.db.product.update({
      where: { id: product.id },
      data: { status: 'INACTIVE', activatedAt: new Date('2026-10-01T00:00:00Z') },
    });

    problem(
      await call('PATCH', `/products/${product.id}`, { slug: 'new-slug' }),
      409,
      'SLUG_LOCKED',
    );
    problem(
      await call('PATCH', `/products/${product.id}`, { slug: 'new-slug', name: 'Also Renamed' }),
      409,
      'SLUG_LOCKED',
    );
    expect(await h.db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      slug: 'locked-hoodie',
      name: 'Locked Hoodie',
    });
    // Sending the unchanged slug, and editing other fields, still works.
    const ok = await call('PATCH', `/products/${product.id}`, {
      slug: 'locked-hoodie',
      name: 'Hoodie',
    });
    expect(ok.statusCode).toBe(200);
  });
});

describe('product-management: Concurrent slugs', () => {
  it('Concurrent creation with the same slug', async () => {
    for (let round = 0; round < 8; round++) {
      const slug = `race-${round}`;
      const results = await Promise.all(
        Array.from({ length: 4 }, () => call('POST', '/products', body({ name: 'Race', slug }))),
      );
      const statuses = results.map((res) => res.statusCode).sort();
      expect(statuses, `round ${round}`).toEqual([201, 409, 409, 409]);
      for (const res of results.filter((r) => r.statusCode === 409)) {
        expect(ProblemDetails.parse(res.json()).code).toBe('SLUG_EXISTS');
      }
      expect(await h.db.product.count({ where: { slug } })).toBe(1);
    }
  });

  it('concurrent creation with the same generated slug never duplicates a slug', async () => {
    for (let round = 0; round < 8; round++) {
      const name = `Parallel Tee ${round}`;
      const pair = await Promise.all([
        call('POST', '/products', body({ name })),
        call('POST', '/products', body({ name })),
      ]);
      expect(
        pair.map((res) => res.statusCode),
        `round ${round}`,
      ).toEqual([201, 201]);
      const slugs = pair.map((res) => ProductDetail.parse(res.json()).slug).sort();
      expect(slugs).toEqual([`parallel-tee-${round}`, `parallel-tee-${round}-2`]);
    }

    // A larger burst: every created slug is distinct; any loser after the retry gets SLUG_EXISTS.
    const burst = await Promise.all(
      Array.from({ length: 6 }, () => call('POST', '/products', body({ name: 'Burst Tee' }))),
    );
    const created = burst.filter((res) => res.statusCode === 201);
    const slugs = created.map((res) => ProductDetail.parse(res.json()).slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(created.length).toBeGreaterThanOrEqual(2);
    for (const res of burst.filter((r) => r.statusCode !== 201)) {
      expect(res.statusCode).toBe(409);
      expect(ProblemDetails.parse(res.json()).code).toBe('SLUG_EXISTS');
    }
    expect(await h.db.product.count({ where: { slug: { startsWith: 'burst-tee' } } })).toBe(
      created.length,
    );
  });
});

describe('product-management: Product pricing and currency', () => {
  it('Negative price rejected', async () => {
    const res = problem(
      await call('POST', '/products', body({ basePrice: idr(-1) })),
      400,
      'VALIDATION_FAILED',
    );
    expect(res.errors?.map((e) => e.path)).toEqual(['basePrice.amount']);
  });

  it('Price above the catalog maximum rejected', async () => {
    const res = problem(
      await call('POST', '/products', body({ basePrice: idr(CATALOG_PRICE_MAX + 1) })),
      400,
      'VALIDATION_FAILED',
    );
    expect(res.errors?.map((e) => e.path)).toEqual(['basePrice.amount']);
    const max = await create({ name: 'Most Expensive', basePrice: idr(CATALOG_PRICE_MAX) });
    expect(max.basePrice).toEqual(idr(2_000_000_000));
    const free = await create({ name: 'Free Sample', basePrice: idr(0) });
    expect(free.basePrice).toEqual(idr(0));
  });

  it('Fractional amount rejected', async () => {
    const res = problem(
      await call('POST', '/products', body({ basePrice: idr(899.5) })),
      400,
      'VALIDATION_FAILED',
    );
    expect(res.errors?.map((e) => e.path)).toEqual(['basePrice.amount']);
  });

  it('Foreign currency rejected', async () => {
    const before = await h.db.product.count();
    const res = problem(
      await call('POST', '/products', body({ basePrice: { amount: 5000, currency: 'USD' } })),
      422,
      'CURRENCY_MISMATCH',
    );
    expect(res.detail).toBe('basePrice must be in IDR.');
    expect(await h.db.product.count()).toBe(before);

    const product = await create({ name: 'Currency Check' });
    problem(
      await call('PATCH', `/products/${product.id}`, { basePrice: { amount: 1, currency: 'EUR' } }),
      422,
      'CURRENCY_MISMATCH',
    );
    expect(
      (await h.db.product.findUniqueOrThrow({ where: { id: product.id } })).basePriceAmount,
    ).toBe(89_900_000);
  });

  it('updates the base price in the store currency', async () => {
    const product = await create({ name: 'Repriced' });
    const res = await call('PATCH', `/products/${product.id}`, { basePrice: idr(79_900_000) });
    expect(ProductDetail.parse(res.json()).basePrice).toEqual(idr(79_900_000));
    problem(
      await call('PATCH', `/products/${product.id}`, { basePrice: idr(-5) }),
      400,
      'VALIDATION_FAILED',
    );
  });
});

describe('product-management: Product lifecycle (creation)', () => {
  it('New product is draft', async () => {
    const product = await create({ name: 'Fresh Draft' });
    expect(product).toMatchObject({ status: 'DRAFT', activatedAt: null, variants: [], images: [] });
  });

  it('rejects a status in the create body', async () => {
    problem(await call('POST', '/products', body({ status: 'ACTIVE' })), 400, 'VALIDATION_FAILED');
    problem(
      await call('PATCH', `/products/${UNKNOWN_ID}`, { status: 'ACTIVE' }),
      400,
      'VALIDATION_FAILED',
    );
  });

  it('rejects an unknown category with 422 UNKNOWN_REFERENCE', async () => {
    problem(
      await call('POST', '/products', body({ categoryId: UNKNOWN_ID })),
      422,
      'UNKNOWN_REFERENCE',
    );
    problem(
      await call('POST', '/products', body({ categoryId: UNKNOWN_ID, slug: 'x-y' })),
      422,
      'UNKNOWN_REFERENCE',
    );
    const product = await create({ name: 'Moves' });
    problem(
      await call('PATCH', `/products/${product.id}`, { categoryId: UNKNOWN_ID }),
      422,
      'UNKNOWN_REFERENCE',
    );
  });
});

describe('product-management: Product updates and attribution', () => {
  it('Update product attribution', async () => {
    const product = await create({ name: 'Attributed', description: 'First' });
    expect(product).toMatchObject({ createdBy: owner.id, updatedBy: owner.id });
    const createdAt = product.createdAt;

    h.clock.advance(minutes(10));
    const res = await call(
      'PATCH',
      `/products/${product.id}`,
      { name: 'Attributed Hoodie' },
      adminCookie,
    );
    expect(res.statusCode).toBe(200);
    const updated = ProductDetail.parse(res.json());
    expect(updated).toEqual({
      ...product,
      name: 'Attributed Hoodie',
      updatedBy: admin.id,
      updatedAt: h.clock.now().toISOString(),
    });
    expect(updated.createdAt).toBe(createdAt);
    expect(updated.createdBy).toBe(owner.id);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(createdAt));
  });

  it('updates description (clearing it with null) and category', async () => {
    const bags = await h.db.category.create({ data: { name: 'Bags', slug: 'bags' } });
    const product = await create({ name: 'Tote', description: 'Canvas' });
    const res = await call('PATCH', `/products/${product.id}`, {
      description: null,
      categoryId: bags.id,
    });
    expect(ProductDetail.parse(res.json())).toMatchObject({
      description: null,
      category: { id: bags.id, slug: 'bags', name: 'Bags', status: 'ACTIVE' },
    });
  });

  it('Edit archived product rejected', async () => {
    const product = await create({ name: 'Archived Jacket' });
    const archived = await h.db.product.update({
      where: { id: product.id },
      data: { status: 'ARCHIVED' },
    });
    problem(
      await call('PATCH', `/products/${product.id}`, { name: 'Changed' }),
      409,
      'INVALID_STATE_TRANSITION',
    );
    expect(await h.db.product.findUniqueOrThrow({ where: { id: product.id } })).toMatchObject({
      name: 'Archived Jacket',
      updatedAt: archived.updatedAt,
    });
  });

  it('keeps an ACTIVE product ready: active category, a variant priced above zero', async () => {
    const archivedCategory = await h.db.category.create({
      data: { name: 'Gone', slug: 'gone', status: 'ARCHIVED' },
    });
    const size = await h.db.size.create({ data: { code: 'RDY', label: 'Ready', sortOrder: 1 } });
    const color = await h.db.color.create({ data: { name: 'Ready', slug: 'ready' } });
    const product = await create({ name: 'Live Product' });
    await h.db.productVariant.create({
      data: { productId: product.id, sizeId: size.id, colorId: color.id, sku: 'LIVE-1' },
    });
    await h.db.product.update({
      where: { id: product.id },
      data: { status: 'ACTIVE', activatedAt: new Date() },
    });

    problem(
      await call('PATCH', `/products/${product.id}`, { categoryId: archivedCategory.id }),
      409,
      'PRODUCT_NOT_READY',
    );
    problem(
      await call('PATCH', `/products/${product.id}`, { basePrice: idr(0) }),
      409,
      'PRODUCT_NOT_READY',
    );
    // A positive price, or a draft product in an archived category, are fine.
    expect((await call('PATCH', `/products/${product.id}`, { basePrice: idr(1) })).statusCode).toBe(
      200,
    );
    const draft = await create({ name: 'Draft Mover' });
    expect(
      (await call('PATCH', `/products/${draft.id}`, { categoryId: archivedCategory.id }))
        .statusCode,
    ).toBe(200);
  });

  it('rejects an empty or unknown-field update and unknown ids', async () => {
    const product = await create({ name: 'Strict' });
    problem(await call('PATCH', `/products/${product.id}`, {}), 400, 'VALIDATION_FAILED');
    problem(
      await call('PATCH', `/products/${product.id}`, { currency: 'USD' }),
      400,
      'VALIDATION_FAILED',
    );
    problem(await call('PATCH', `/products/${UNKNOWN_ID}`, { name: 'x' }), 404, 'NOT_FOUND');
  });
});

describe('product-management: Product listing and detail', () => {
  it('Product detail shape', async () => {
    const product = await create({ name: 'Detailed Tee', description: 'Heavyweight cotton.' });
    const size = await h.db.size.create({ data: { code: 'DM', label: 'Detail M', sortOrder: 30 } });
    const color = await h.db.color.create({
      data: { name: 'Detail Black', slug: 'detail-black', hex: '#171615' },
    });
    const variant = await h.db.productVariant.create({
      data: {
        productId: product.id,
        sizeId: size.id,
        colorId: color.id,
        sku: 'DT-BL-M',
        stockQuantity: 7,
        priceOverrideAmount: 99_000_000,
      },
    });
    await h.db.productImage.createMany({
      data: [
        { productId: product.id, url: '/b.jpg', alt: 'Back', sortOrder: 1 },
        {
          productId: product.id,
          url: 'https://cdn.example.com/f.jpg',
          alt: 'Front',
          sortOrder: 0,
          isPrimary: true,
          variantId: variant.id,
        },
      ],
    });

    const res = await call('GET', `/products/${product.id}`);
    expect(res.statusCode).toBe(200);
    const detail = ProductDetail.parse(res.json());
    expect(detail).toMatchObject({
      name: 'Detailed Tee',
      description: 'Heavyweight cotton.',
      category: { id: apparel.id, slug: 'apparel' },
      createdBy: owner.id,
      updatedBy: owner.id,
    });
    expect(detail.variants).toEqual([
      expect.objectContaining({
        sku: 'DT-BL-M',
        size: { id: size.id, code: 'DM', label: 'Detail M' },
        color: { id: color.id, name: 'Detail Black', slug: 'detail-black', hex: '#171615' },
        priceOverride: idr(99_000_000),
        effectivePrice: idr(99_000_000),
        stockQuantity: 7,
        status: 'ACTIVE',
      }),
    ]);
    expect(detail.images.map((image) => [image.alt, image.sortOrder, image.isPrimary])).toEqual([
      ['Front', 0, true],
      ['Back', 1, false],
    ]);
    // No database-only fields anywhere in the body.
    expect(res.body).not.toMatch(/Amount|currency_|_id|createdById|categoryId|productId/);
  });

  it('Unknown product', async () => {
    problem(await call('GET', `/products/${UNKNOWN_ID}`), 404, 'NOT_FOUND');
    problem(await call('GET', '/products/not-a-uuid'), 400, 'VALIDATION_FAILED');
  });

  it('keeps draft, inactive, and archived products retrievable by id', async () => {
    for (const status of ['DRAFT', 'INACTIVE', 'ARCHIVED'] as const) {
      const product = await create({ name: `Kept ${status}` });
      await h.db.product.update({ where: { id: product.id }, data: { status } });
      const res = await call('GET', `/products/${product.id}`);
      expect(res.statusCode).toBe(200);
      expect(ProductDetail.parse(res.json()).status).toBe(status);
    }
  });
});

describe('product-management: Product list', () => {
  let listCategory: { id: string };
  const list = async (query: string) => {
    const res = await call('GET', `/products?${query}`);
    expect(res.statusCode, res.body).toBe(200);
    return ProductListResponse.parse(res.json());
  };

  beforeAll(async () => {
    listCategory = await h.db.category.create({ data: { name: 'Listed', slug: 'listed' } });
    // 25 products in one category; groups of five share a createdAt so ties break by id.
    const base = Date.UTC(2026, 8, 1);
    for (let n = 0; n < 25; n++) {
      await h.db.product.create({
        data: {
          name: `Listed ${String(n).padStart(2, '0')}`,
          slug: `listed-${n}`,
          categoryId: listCategory.id,
          basePriceAmount: 1000 * (n + 1),
          currency: 'IDR',
          createdAt: new Date(base + Math.floor(n / 5) * 60_000),
        },
      });
    }
  });

  it('Paginate products', async () => {
    const first = await list(`categoryId=${listCategory.id}&limit=20`);
    expect(first.data).toHaveLength(20);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = await list(
      `categoryId=${listCategory.id}&limit=20&cursor=${encodeURIComponent(first.nextCursor!)}`,
    );
    expect(second.data).toHaveLength(5);
    expect(second.nextCursor).toBeNull();

    const ids = [...first.data, ...second.data].map((item) => item.id);
    expect(new Set(ids).size).toBe(25);
    const expected = await h.db.product.findMany({
      where: { categoryId: listCategory.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    expect(ids).toEqual(expected.map((row) => row.id));
  });

  it('defaults to 20 per page, allows up to 100, and rejects more', async () => {
    expect((await list(`categoryId=${listCategory.id}`)).data).toHaveLength(20);
    const all = await list(`categoryId=${listCategory.id}&limit=100`);
    expect(all.data).toHaveLength(25);
    expect(all.nextCursor).toBeNull();
    problem(await call('GET', '/products?limit=101'), 400, 'VALIDATION_FAILED');
    problem(await call('GET', '/products?limit=0'), 400, 'VALIDATION_FAILED');
  });

  it('walks every page with small limits without duplicates or gaps', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: ProductListResponse = await list(
        `categoryId=${listCategory.id}&limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      seen.push(...page.data.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });

  it('rejects a tampered or malformed cursor', async () => {
    const { nextCursor } = await list(`categoryId=${listCategory.id}&limit=5`);
    const [payload, signature] = nextCursor!.split('.');
    const forged = Buffer.from(
      JSON.stringify({ v: 1, t: '2030-01-01T00:00:00.000Z', i: UNKNOWN_ID }),
    ).toString('base64url');
    for (const cursor of [
      `${forged}.${signature}`,
      `${payload}.x${signature}`,
      'garbage',
      `${payload}`,
    ]) {
      problem(
        await call('GET', `/products?cursor=${encodeURIComponent(cursor)}`),
        400,
        'VALIDATION_FAILED',
      );
    }
  });

  it('Archived products hidden by default', async () => {
    const archived = await create({ name: 'Hidden Archive', categoryId: listCategory.id });
    await h.db.product.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });

    const byDefault = await list(`categoryId=${listCategory.id}&limit=100`);
    expect(byDefault.data.map((item) => item.id)).not.toContain(archived.id);
    expect(byDefault.data.every((item) => item.status !== 'ARCHIVED')).toBe(true);

    const onlyArchived = await list(`categoryId=${listCategory.id}&status=ARCHIVED`);
    expect(onlyArchived.data.map((item) => item.id)).toEqual([archived.id]);
    await h.db.product.update({ where: { id: archived.id }, data: { categoryId: apparel.id } });
  });

  it('filters by status, category, and case-insensitive name', async () => {
    const drafts = await list(`categoryId=${listCategory.id}&status=DRAFT&limit=100`);
    expect(drafts.data).toHaveLength(25);
    expect((await list(`categoryId=${listCategory.id}&status=ACTIVE`)).data).toEqual([]);

    const search = await list(
      `categoryId=${listCategory.id}&q=${encodeURIComponent('  lIsTeD 0')}`,
    );
    expect(search.data.map((item) => item.name).sort()).toEqual(
      Array.from({ length: 10 }, (_, n) => `Listed 0${n}`),
    );
    // LIKE wildcards in q are literal text.
    expect((await list(`q=${encodeURIComponent('%')}`)).data).toEqual([]);
    expect((await list(`q=${encodeURIComponent('Listed _1')}`)).data).toEqual([]);
    expect((await list(`q=${encodeURIComponent('\\')}`)).data).toEqual([]);
    const literal = await create({ name: '100% Cotton_Tee \\ Raw', categoryId: listCategory.id });
    for (const q of ['100%', 'cotton_tee', '\\ raw']) {
      expect((await list(`q=${encodeURIComponent(q)}`)).data.map((item) => item.id)).toEqual([
        literal.id,
      ]);
    }
    await h.db.product.update({ where: { id: literal.id }, data: { categoryId: apparel.id } });

    problem(await call('GET', '/products?status=DELETED'), 400, 'VALIDATION_FAILED');
    problem(await call('GET', '/products?categoryId=nope'), 400, 'VALIDATION_FAILED');
    problem(await call('GET', '/products?unknown=1'), 400, 'VALIDATION_FAILED');
    expect((await list(`categoryId=${UNKNOWN_ID}`)).data).toEqual([]);
  });

  it('list items carry category, base price, variant count, and primary image', async () => {
    const product = await create({ name: 'Listed Item Shape', categoryId: listCategory.id });
    const size = await h.db.size.create({ data: { code: 'LS', label: 'List S', sortOrder: 1 } });
    const color = await h.db.color.create({ data: { name: 'List Grey', slug: 'list-grey' } });
    await h.db.productVariant.create({
      data: { productId: product.id, sizeId: size.id, colorId: color.id, sku: 'LIS-1' },
    });
    await h.db.productImage.createMany({
      data: [
        { productId: product.id, url: '/side.jpg', alt: 'Side', sortOrder: 0 },
        { productId: product.id, url: '/front.jpg', alt: 'Front', sortOrder: 1, isPrimary: true },
      ],
    });
    const item = (await list(`categoryId=${listCategory.id}&q=Item%20Shape`)).data[0]!;
    expect(item).toMatchObject({
      id: product.id,
      category: { id: listCategory.id, name: 'Listed', slug: 'listed', status: 'ACTIVE' },
      basePrice: idr(89_900_000),
      variantCount: 1,
      primaryImage: { url: '/front.jpg', alt: 'Front' },
      activatedAt: null,
    });
  });
});

describe('product-management: Catalog permissions', () => {
  it('Admin manages catalog', async () => {
    const res = await call('POST', '/products', body({ name: 'Admin Made Tee' }), adminCookie);
    expect(res.statusCode).toBe(201);
    expect(ProductDetail.parse(res.json())).toMatchObject({
      createdBy: admin.id,
      updatedBy: admin.id,
    });
    expect((await call('GET', '/products', undefined, adminCookie)).statusCode).toBe(200);
  });
});
