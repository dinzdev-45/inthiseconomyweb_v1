import {
  Category,
  CategoryListResponse,
  Color,
  ColorListResponse,
  ProblemDetails,
  Size,
  SizeListResponse,
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
let h: AuthHarness;
let owner: { id: string };
let admin: { id: string };
let ownerCookie: string;
let adminCookie: string;

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
});
afterAll(async () => h.close());

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
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

const createCategory = async (body: object, cookie = ownerCookie) => {
  const res = await call('POST', '/categories', body, cookie);
  expect(res.statusCode, res.body).toBe(201);
  return Category.parse(res.json());
};
const createSize = async (body: object) => {
  const res = await call('POST', '/sizes', body);
  expect(res.statusCode, res.body).toBe(201);
  return Size.parse(res.json());
};
const createColor = async (body: object) => {
  const res = await call('POST', '/colors', body);
  expect(res.statusCode, res.body).toBe(201);
  return Color.parse(res.json());
};

/** Inserts a product (and optionally a variant) straight into the database. */
async function insertProduct(
  slug: string,
  categoryId: string,
  {
    status = 'DRAFT',
    variant,
  }: { status?: 'DRAFT' | 'ACTIVE'; variant?: { sizeId: string; colorId: string } } = {},
) {
  const product = await h.db.product.create({
    data: { name: slug, slug, categoryId, basePriceAmount: 100_000_00, currency: 'IDR', status },
  });
  if (variant) {
    await h.db.productVariant.create({
      data: { productId: product.id, ...variant, sku: `SKU-${slug}`.toUpperCase() },
    });
  }
  return product;
}

const UNKNOWN_ID = '0190a000-0000-7000-8000-000000000000';

describe('catalog-reference-data: Categories', () => {
  it('Create category', async () => {
    const res = await call('POST', '/categories', { name: 'Outerwear' });
    expect(res.statusCode).toBe(201);
    const category = Category.parse(res.json());
    expect(category).toMatchObject({
      name: 'Outerwear',
      slug: 'outerwear',
      status: 'ACTIVE',
      createdBy: owner.id,
      updatedBy: owner.id,
    });
    expect(category.createdAt).toBe(h.clock.now().toISOString());

    const fetched = await call('GET', `/categories/${category.id}`);
    expect(fetched.statusCode).toBe(200);
    expect(Category.parse(fetched.json())).toEqual(category);
  });

  it('Duplicate category slug', async () => {
    const existing = await createCategory({ name: 'Bags', slug: 'bags' });
    const other = await createCategory({ name: 'Hats', slug: 'hats' });
    const archived = await createCategory({ name: 'Old Drops', slug: 'old-drops' });
    expect((await call('POST', `/categories/${archived.id}/archive`)).statusCode).toBe(200);

    // Create with a used slug, including an archived category's.
    problem(
      await call('POST', '/categories', { name: 'Bags 2', slug: 'bags' }),
      409,
      'SLUG_EXISTS',
    );
    problem(
      await call('POST', '/categories', { name: 'New', slug: 'old-drops' }),
      409,
      'SLUG_EXISTS',
    );
    // Rename to a used slug.
    problem(await call('PATCH', `/categories/${other.id}`, { slug: 'bags' }), 409, 'SLUG_EXISTS');

    // Nothing changed.
    expect(await h.db.category.count({ where: { slug: 'bags' } })).toBe(1);
    expect((await h.db.category.findUniqueOrThrow({ where: { id: other.id } })).slug).toBe('hats');
    expect((await h.db.category.findUniqueOrThrow({ where: { id: existing.id } })).name).toBe(
      'Bags',
    );
  });

  it('generates a free slug from the name when none is given', async () => {
    const first = await createCategory({ name: 'Knitwear & Fleece' });
    const second = await createCategory({ name: 'Knitwear — Fleece' });
    const third = await createCategory({ name: 'knitwear fleece' });
    expect([first.slug, second.slug, third.slug]).toEqual([
      'knitwear-fleece',
      'knitwear-fleece-2',
      'knitwear-fleece-3',
    ]);
    expect((await createCategory({ name: '!!!' })).slug).toBe('category');
  });

  it('Archive category in use', async () => {
    const category = await createCategory({ name: 'Denim' });
    await insertProduct('denim-jacket', category.id, { status: 'ACTIVE' });

    problem(await call('POST', `/categories/${category.id}/archive`), 409, 'IN_USE');
    expect((await h.db.category.findUniqueOrThrow({ where: { id: category.id } })).status).toBe(
      'ACTIVE',
    );
  });

  it('Archive and restore unused category', async () => {
    const category = await createCategory({ name: 'Swim' });
    // A DRAFT product does not block archiving: only ACTIVE products do.
    await insertProduct('swim-shorts', category.id);

    h.clock.advance(minutes(1));
    const archived = await call(
      'POST',
      `/categories/${category.id}/archive`,
      undefined,
      adminCookie,
    );
    expect(archived.statusCode).toBe(200);
    expect(Category.parse(archived.json())).toMatchObject({
      status: 'ARCHIVED',
      createdBy: owner.id,
      updatedBy: admin.id,
      updatedAt: h.clock.now().toISOString(),
    });
    const whileArchived = await call('GET', `/categories/${category.id}`);
    expect(whileArchived.statusCode).toBe(200);
    expect(Category.parse(whileArchived.json()).status).toBe('ARCHIVED');

    const restored = await call('POST', `/categories/${category.id}/restore`);
    expect(restored.statusCode).toBe(200);
    expect(Category.parse(restored.json())).toMatchObject({
      status: 'ACTIVE',
      updatedBy: owner.id,
    });
    expect((await call('GET', `/categories/${category.id}`)).statusCode).toBe(200);
  });

  it('rejects archiving an archived category and restoring an active one', async () => {
    const category = await createCategory({ name: 'Socks' });
    problem(
      await call('POST', `/categories/${category.id}/restore`),
      409,
      'INVALID_STATE_TRANSITION',
    );
    await call('POST', `/categories/${category.id}/archive`);
    problem(
      await call('POST', `/categories/${category.id}/archive`),
      409,
      'INVALID_STATE_TRANSITION',
    );
    expect((await h.db.category.findUniqueOrThrow({ where: { id: category.id } })).status).toBe(
      'ARCHIVED',
    );
  });

  it('lists categories, optionally filtered by status', async () => {
    const all = CategoryListResponse.parse((await call('GET', '/categories')).json()).data;
    expect(all.map((c) => c.status)).toContain('ARCHIVED');
    expect(all.map((c) => c.status)).toContain('ACTIVE');
    const archived = CategoryListResponse.parse(
      (await call('GET', '/categories?status=ARCHIVED')).json(),
    ).data;
    expect(archived.length).toBeGreaterThan(0);
    expect(archived.every((c) => c.status === 'ARCHIVED')).toBe(true);
    problem(await call('GET', '/categories?status=DELETED'), 400, 'VALIDATION_FAILED');
  });

  it('updates name and slug with attribution, keeping creation fields', async () => {
    const category = await createCategory({ name: 'Tees' });
    h.clock.advance(minutes(5));
    const res = await call(
      'PATCH',
      `/categories/${category.id}`,
      { name: 'T-Shirts', slug: 't-shirts' },
      adminCookie,
    );
    expect(res.statusCode).toBe(200);
    expect(Category.parse(res.json())).toEqual({
      ...category,
      name: 'T-Shirts',
      slug: 't-shirts',
      updatedBy: admin.id,
      updatedAt: h.clock.now().toISOString(),
    });
  });

  it('rejects invalid category bodies and unknown ids', async () => {
    problem(
      await call('POST', '/categories', { name: 'X', slug: 'Not Kebab' }),
      400,
      'VALIDATION_FAILED',
    );
    problem(await call('POST', '/categories', { name: '' }), 400, 'VALIDATION_FAILED');
    problem(
      await call('POST', '/categories', { name: 'X', status: 'ARCHIVED' }),
      400,
      'VALIDATION_FAILED',
    );
    problem(await call('PATCH', `/categories/${UNKNOWN_ID}`, {}), 400, 'VALIDATION_FAILED');
    problem(await call('GET', `/categories/${UNKNOWN_ID}`), 404, 'NOT_FOUND');
    problem(await call('PATCH', `/categories/${UNKNOWN_ID}`, { name: 'X' }), 404, 'NOT_FOUND');
    problem(await call('POST', `/categories/${UNKNOWN_ID}/archive`), 404, 'NOT_FOUND');
    problem(await call('GET', '/categories/not-a-uuid'), 400, 'VALIDATION_FAILED');
  });

  it('has no delete endpoint for categories', async () => {
    const category = await createCategory({ name: 'Keepers' });
    expect((await call('DELETE', `/categories/${category.id}`)).statusCode).toBe(404);
    expect(await h.db.category.count({ where: { id: category.id } })).toBe(1);
  });
});

describe('catalog-reference-data: Sizes', () => {
  it('Numeric and letter size codes', async () => {
    const waist = await createSize({ code: '28', label: 'Waist 28', sortOrder: 10 });
    const combo = await createSize({ code: '30/32', label: 'Waist 30 / Leg 32', sortOrder: 20 });
    const xl = await createSize({ code: 'xl', label: 'Extra Large', sortOrder: 5 });
    expect([waist.code, combo.code, xl.code]).toEqual(['28', '30/32', 'XL']);
    expect(xl).toMatchObject({ createdBy: owner.id, updatedBy: owner.id, sortOrder: 5 });

    const list = SizeListResponse.parse((await call('GET', '/sizes')).json()).data;
    const codes = list.map((size) => size.code);
    expect(codes.indexOf('XL')).toBeLessThan(codes.indexOf('28'));
    expect(codes.indexOf('28')).toBeLessThan(codes.indexOf('30/32'));
  });

  it('accepts generic codes such as S, OS, and EU-42', async () => {
    for (const [code, sortOrder] of [
      [' s ', 31],
      ['os', 32],
      ['eu-42', 33],
      ['W32.L34', 34],
    ] as const) {
      await createSize({ code, label: `Size ${code}`, sortOrder });
    }
    const codes = SizeListResponse.parse((await call('GET', '/sizes')).json()).data.map(
      (s) => s.code,
    );
    expect(codes).toEqual(expect.arrayContaining(['S', 'OS', 'EU-42', 'W32.L34']));
  });

  it('Sizes listed in display order', async () => {
    // Same sortOrder: ties are broken by code.
    await createSize({ code: 'B2', label: 'Tie B', sortOrder: 900 });
    await createSize({ code: 'A2', label: 'Tie A', sortOrder: 900 });
    await createSize({ code: 'Z0', label: 'First', sortOrder: 0 });
    const list = SizeListResponse.parse((await call('GET', '/sizes')).json()).data;
    const keys = list.map((size) => [size.sortOrder, size.code] as const);
    const sorted = [...keys].sort(
      (a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0),
    );
    expect(keys).toEqual(sorted);
    expect(list[0]!.code).toBe('Z0');
    expect(list.slice(-2).map((size) => size.code)).toEqual(['A2', 'B2']);
  });

  it.each(['M L', '--', 'ABCDEFGHIJKLM', '30//32', '-M', 'M-', 'X_L', ''])(
    'Invalid size code (%j)',
    async (code) => {
      const body = problem(
        await call('POST', '/sizes', { code, label: 'Bad', sortOrder: 1 }),
        400,
        'VALIDATION_FAILED',
      );
      expect(body.errors?.map((error) => error.path)).toContain('code');
    },
  );

  it('Duplicate size code', async () => {
    await createSize({ code: 'M', label: 'Medium', sortOrder: 30 });
    problem(
      await call('POST', '/sizes', { code: 'm', label: 'medium again', sortOrder: 31 }),
      409,
      'CODE_EXISTS',
    );
    expect(await h.db.size.count({ where: { code: 'M' } })).toBe(1);

    const large = await createSize({ code: 'L', label: 'Large', sortOrder: 40 });
    problem(await call('PATCH', `/sizes/${large.id}`, { code: ' m ' }), 409, 'CODE_EXISTS');
  });

  it('updates a size with attribution and keeps its explicit sortOrder', async () => {
    const size = await createSize({ code: 'XXL', label: 'XXL', sortOrder: 60 });
    h.clock.advance(minutes(2));
    const res = await call(
      'PATCH',
      `/sizes/${size.id}`,
      { label: '2X Large', code: '2xl' },
      adminCookie,
    );
    expect(res.statusCode).toBe(200);
    expect(Size.parse(res.json())).toEqual({
      ...size,
      code: '2XL',
      label: '2X Large',
      updatedBy: admin.id,
      updatedAt: h.clock.now().toISOString(),
    });
    problem(await call('PATCH', `/sizes/${size.id}`, { sortOrder: -1 }), 400, 'VALIDATION_FAILED');
    problem(await call('PATCH', `/sizes/${size.id}`, { sortOrder: 1.5 }), 400, 'VALIDATION_FAILED');
    problem(await call('PATCH', `/sizes/${UNKNOWN_ID}`, { label: 'x' }), 404, 'NOT_FOUND');
  });

  it('Delete size in use', async () => {
    const category = await createCategory({ name: 'Size Users' });
    const size = await createSize({ code: 'XS', label: 'Extra Small', sortOrder: 10 });
    const color = await createColor({ name: 'Size Test Grey' });
    await insertProduct('xs-tee', category.id, { variant: { sizeId: size.id, colorId: color.id } });

    problem(await call('DELETE', `/sizes/${size.id}`), 409, 'IN_USE');
    expect(await h.db.size.count({ where: { id: size.id } })).toBe(1);
  });

  it('deletes an unused size', async () => {
    const size = await createSize({ code: 'XXXL', label: 'XXXL', sortOrder: 70 });
    const res = await call('DELETE', `/sizes/${size.id}`);
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    expect(await h.db.size.count({ where: { id: size.id } })).toBe(0);
    problem(await call('DELETE', `/sizes/${size.id}`), 404, 'NOT_FOUND');
  });
});

describe('catalog-reference-data: Colors', () => {
  it('Create color with hex', async () => {
    const res = await call('POST', '/colors', { name: 'Washed Black', hex: '#2b2a28' });
    expect(res.statusCode).toBe(201);
    expect(Color.parse(res.json())).toMatchObject({
      name: 'Washed Black',
      slug: 'washed-black',
      hex: '#2B2A28',
      createdBy: owner.id,
      updatedBy: owner.id,
    });
  });

  it('creates colors without hex and with generated, suffixed, or explicit slugs', async () => {
    const plain = await createColor({ name: 'Off-White' });
    expect(plain).toMatchObject({ slug: 'off-white', hex: null });
    expect((await createColor({ name: 'Off White' })).slug).toBe('off-white-2');
    expect((await createColor({ name: 'Bone', slug: 'bone-white', hex: null })).slug).toBe(
      'bone-white',
    );
    problem(await call('POST', '/colors', { name: 'Ecru', slug: 'off-white' }), 409, 'SLUG_EXISTS');
  });

  it.each(['#12345', 'red', '#1234567', '123456', '#GGGGGG'])('Invalid hex (%j)', async (hex) => {
    const body = problem(
      await call('POST', '/colors', { name: 'Bad', hex }),
      400,
      'VALIDATION_FAILED',
    );
    expect(body.errors?.map((error) => error.path)).toContain('hex');
  });

  it('updates a color, uppercasing hex and clearing it with null', async () => {
    const color = await createColor({ name: 'Sand', hex: '#ccb99f' });
    h.clock.advance(minutes(3));
    const res = await call(
      'PATCH',
      `/colors/${color.id}`,
      { hex: '#d9b48c', name: 'Soft Sand' },
      adminCookie,
    );
    expect(Color.parse(res.json())).toEqual({
      ...color,
      name: 'Soft Sand',
      hex: '#D9B48C',
      updatedBy: admin.id,
      updatedAt: h.clock.now().toISOString(),
    });
    // Renaming does not change the slug.
    expect(Color.parse(res.json()).slug).toBe('sand');
    const cleared = await call('PATCH', `/colors/${color.id}`, { hex: null });
    expect(Color.parse(cleared.json()).hex).toBeNull();
    problem(
      await call('PATCH', `/colors/${color.id}`, { slug: 'washed-black' }),
      409,
      'SLUG_EXISTS',
    );
    problem(await call('PATCH', `/colors/${color.id}`, { hex: 'red' }), 400, 'VALIDATION_FAILED');
    problem(await call('PATCH', `/colors/${UNKNOWN_ID}`, { name: 'x' }), 404, 'NOT_FOUND');
  });

  it('Delete unused color', async () => {
    const color = await createColor({ name: 'Disposable Teal', hex: '#008080' });
    const res = await call('DELETE', `/colors/${color.id}`);
    expect(res.statusCode).toBe(204);
    const list = ColorListResponse.parse((await call('GET', '/colors')).json()).data;
    expect(list.map((c) => c.id)).not.toContain(color.id);
  });

  it('rejects deleting a color in use', async () => {
    const category = await createCategory({ name: 'Color Users' });
    const size = await createSize({ code: 'C1', label: 'Color test', sortOrder: 500 });
    const color = await createColor({ name: 'Used Navy' });
    await insertProduct('navy-tee', category.id, {
      variant: { sizeId: size.id, colorId: color.id },
    });

    problem(await call('DELETE', `/colors/${color.id}`), 409, 'IN_USE');
    expect(await h.db.color.count({ where: { id: color.id } })).toBe(1);
  });
});

describe('catalog-reference-data: authorization and response shape', () => {
  it('ADMIN can read and manage reference data', async () => {
    const category = await createCategory({ name: 'Admin Made' }, adminCookie);
    expect(category.createdBy).toBe(admin.id);
    expect((await call('GET', '/sizes', undefined, adminCookie)).statusCode).toBe(200);
    expect((await call('POST', '/colors', { name: 'Admin Color' }, adminCookie)).statusCode).toBe(
      201,
    );
  });

  it.each([
    ['GET', '/categories'],
    ['POST', '/categories'],
    ['GET', `/categories/${UNKNOWN_ID}`],
    ['PATCH', `/categories/${UNKNOWN_ID}`],
    ['POST', `/categories/${UNKNOWN_ID}/archive`],
    ['POST', `/categories/${UNKNOWN_ID}/restore`],
    ['GET', '/sizes'],
    ['POST', '/sizes'],
    ['PATCH', `/sizes/${UNKNOWN_ID}`],
    ['DELETE', `/sizes/${UNKNOWN_ID}`],
    ['GET', '/colors'],
    ['POST', '/colors'],
    ['PATCH', `/colors/${UNKNOWN_ID}`],
    ['DELETE', `/colors/${UNKNOWN_ID}`],
  ] as const)('requires a session for %s %s', async (method, url) => {
    const before = await h.db.category.count();
    problem(
      await call(method, url, method === 'GET' ? undefined : { name: 'X' }, null),
      401,
      'UNAUTHENTICATED',
    );
    expect(await h.db.category.count()).toBe(before);
  });

  it('rejects changes from another origin', async () => {
    const res = await h.app.inject({
      method: 'POST',
      url: '/api/v1/admin/categories',
      headers: { cookie: ownerCookie, origin: 'https://evil.example' },
      payload: { name: 'Forged' },
    });
    expect(res.statusCode).toBe(403);
    expect(await h.db.category.count({ where: { name: 'Forged' } })).toBe(0);
  });

  it('responses contain only API fields', async () => {
    const category = (await call('GET', '/categories')).json().data[0];
    expect(Object.keys(category).sort()).toEqual(
      ['createdAt', 'createdBy', 'id', 'name', 'slug', 'status', 'updatedAt', 'updatedBy'].sort(),
    );
    const size = (await call('GET', '/sizes')).json().data[0];
    expect(Object.keys(size)).not.toContain('createdById');
    const color = (await call('GET', '/colors')).json().data[0];
    expect(Object.keys(color).sort()).toEqual(
      ['createdAt', 'createdBy', 'hex', 'id', 'name', 'slug', 'updatedAt', 'updatedBy'].sort(),
    );
  });
});
