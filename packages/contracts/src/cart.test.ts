import { describe, expect, it } from 'vitest';

import {
  AddCartItemRequest,
  CART_LINE_MAX,
  CART_QUANTITY_MAX,
  CartToken,
  CreateCartResponse,
  StoreCart,
  UpdateCartItemRequest,
} from './cart.ts';
import { ErrorCode } from './errors.ts';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;
const idr = (amount: number) => ({ amount, currency: 'IDR' });
const LINE = {
  id: '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b',
  product: { slug: 'two-tone-hoodie', name: 'Two Tone Hoodie', image: null },
  color: { slug: 'black', name: 'Black' },
  size: { code: 'M', label: 'Medium' },
  quantity: 2,
  unitPrice: idr(69_900_000),
  lineTotal: idr(139_800_000),
  status: 'AVAILABLE',
};
const CART = { lines: [LINE], itemCount: 2, subtotal: idr(139_800_000) };
const TOKEN = 'a'.repeat(43);

describe('cart requests', () => {
  it('AddCartItemRequest identifies a variant by slug, color, and size; quantity defaults to 1', () => {
    expect(
      AddCartItemRequest.parse({
        productSlug: 'two-tone-hoodie',
        colorSlug: 'black',
        sizeCode: 'm',
      }),
    ).toEqual({ productSlug: 'two-tone-hoodie', colorSlug: 'black', sizeCode: 'M', quantity: 1 });
  });

  it.each([
    [{ productSlug: 'Bad Slug', colorSlug: 'black', sizeCode: 'M' }],
    [{ productSlug: 'tee', colorSlug: 'black', sizeCode: 'M L' }],
    [{ productSlug: 'tee', colorSlug: 'black', sizeCode: 'M', quantity: 0 }],
    [{ productSlug: 'tee', colorSlug: 'black', sizeCode: 'M', quantity: 11 }],
    [{ productSlug: 'tee', colorSlug: 'black', sizeCode: 'M', quantity: 1.5 }],
    [{ productSlug: 'tee', colorSlug: 'black', sizeCode: 'M', price: idr(1) }],
    [{ productSlug: 'tee', colorSlug: 'black', sizeCode: 'M', variantId: LINE.id }],
  ])('AddCartItemRequest rejects %j', (body) => expect(ok(AddCartItemRequest, body)).toBe(false));

  it('UpdateCartItemRequest takes a quantity from 1 to 10 only', () => {
    expect(CART_QUANTITY_MAX).toBe(10);
    expect(CART_LINE_MAX).toBe(50);
    for (const quantity of [1, 10]) expect(ok(UpdateCartItemRequest, { quantity })).toBe(true);
    for (const body of [{ quantity: 0 }, { quantity: 11 }, {}, { quantity: 2, price: 1 }]) {
      expect(ok(UpdateCartItemRequest, body)).toBe(false);
    }
  });

  it('CartToken is 43 base64url characters', () => {
    expect(ok(CartToken, TOKEN)).toBe(true);
    for (const token of [
      'a'.repeat(42),
      'a'.repeat(44),
      `${'a'.repeat(42)}=`,
      `${'a'.repeat(42)}/`,
    ]) {
      expect(ok(CartToken, token)).toBe(false);
    }
  });
});

describe('cart responses', () => {
  it('StoreCart is strict and customer-safe', () => {
    expect(ok(StoreCart, CART)).toBe(true);
    expect(ok(StoreCart, { lines: [], itemCount: 0, subtotal: idr(0) })).toBe(true);
    for (const extra of [{ stockQuantity: 3 }, { sku: 'X-1' }, { variantId: LINE.id }]) {
      expect(ok(StoreCart, { ...CART, lines: [{ ...LINE, ...extra }] })).toBe(false);
    }
    expect(
      ok(StoreCart, { ...CART, lines: [{ ...LINE, product: { ...LINE.product, id: LINE.id } }] }),
    ).toBe(false);
    expect(ok(StoreCart, { ...CART, lines: [{ ...LINE, status: 'LOW_STOCK' }] })).toBe(false);
    expect(ok(StoreCart, { ...CART, token: TOKEN })).toBe(false);
  });

  it('CreateCartResponse carries the token once, with the cart', () => {
    expect(ok(CreateCartResponse, { token: TOKEN, cart: CART })).toBe(true);
    expect(ok(CreateCartResponse, { cart: CART })).toBe(false);
  });

  it('defines the cart error codes', () => {
    for (const code of [
      'CART_NOT_FOUND',
      'VARIANT_UNAVAILABLE',
      'QUANTITY_LIMIT',
      'CART_FULL',
      'INSUFFICIENT_STOCK',
    ]) {
      expect(ErrorCode.options).toContain(code);
    }
  });
});
