import { describe, expect, it } from 'vitest';

import {
  CheckoutSummary,
  IndonesianPhone,
  OrderNumber,
  PlaceOrderRequest,
  PlaceOrderResponse,
  PostalCode,
  PROVINCES,
  provinceName,
  StoreOrder,
} from './checkout.ts';
import { ErrorCode } from './errors.ts';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  schema.safeParse(v).success;
const idr = (amount: number) => ({ amount, currency: 'IDR' });
const DETAILS = {
  email: ' Ana@Example.COM ',
  name: 'Ana Putri',
  phone: '0812-3456-7890',
  address: { line1: 'Jl. Melati No. 5', city: 'Bandung', province: '32', postalCode: '40115' },
  expectedTotal: idr(154_800_000),
};
const ORDER = {
  number: 'ITE-7KQ2M9XA',
  status: 'AWAITING_PAYMENT',
  placedAt: '2026-10-08T05:00:00.000Z',
  paymentDeadline: '2026-10-09T05:00:00.000Z',
  lines: [
    {
      productName: 'Two Tone Hoodie',
      productSlug: 'two-tone-hoodie',
      colorName: 'Off-White',
      sizeCode: 'M',
      unitPrice: idr(69_900_000),
      quantity: 2,
      lineTotal: idr(139_800_000),
    },
  ],
  subtotal: idr(139_800_000),
  shippingFee: idr(2_000_000),
  total: idr(141_800_000),
  contact: { email: 'ana@example.com', name: 'Ana Putri', phone: '+6281234567890' },
  delivery: {
    line1: 'Jl. Melati No. 5',
    line2: null,
    city: 'Bandung',
    province: { code: '32', name: 'Jawa Barat' },
    postalCode: '40115',
  },
  note: null,
};

describe('checkout primitives', () => {
  it('lists the 38 provinces with unique two-digit codes', () => {
    expect(PROVINCES).toHaveLength(38);
    expect(new Set(PROVINCES.map((p) => p.code)).size).toBe(38);
    for (const p of PROVINCES) expect(p.code).toMatch(/^\d{2}$/);
    expect(provinceName('31')).toBe('DKI Jakarta');
    expect(provinceName('99')).toBeUndefined();
  });

  it.each([
    ['0812 3456 7890', '+6281234567890'],
    ['+62 812-3456-7890', '+6281234567890'],
    ['6281234567', '+6281234567'],
    ['(0812) 345 678', '+62812345678'],
  ])('IndonesianPhone %j → %s', (input, normalized) => {
    expect(IndonesianPhone.parse(input)).toBe(normalized);
  });

  it.each(['021 555 1234', '0812345', `08${'1'.repeat(14)}`, '+1 415 555 0100', 'call me'])(
    'IndonesianPhone rejects %j',
    (input) => expect(ok(IndonesianPhone, input)).toBe(false),
  );

  it('OrderNumber and PostalCode formats', () => {
    expect(ok(OrderNumber, 'ITE-7KQ2M9XA')).toBe(true);
    for (const bad of ['ITE-7KQ2M9X', 'ite-7kq2m9xa', 'ITE-7KQ2M9XI', 'XYZ-7KQ2M9XA']) {
      expect(ok(OrderNumber, bad)).toBe(false);
    }
    expect(PostalCode.parse(' 40115 ')).toBe('40115');
    for (const bad of ['4011', '401155', 'abcde']) expect(ok(PostalCode, bad)).toBe(false);
  });
});

describe('PlaceOrderRequest', () => {
  it('normalizes email and phone, and drops empty optional fields', () => {
    expect(
      PlaceOrderRequest.parse({
        ...DETAILS,
        note: '  ',
        address: { ...DETAILS.address, line2: '' },
      }),
    ).toEqual({
      email: 'ana@example.com',
      name: 'Ana Putri',
      phone: '+6281234567890',
      address: { line1: 'Jl. Melati No. 5', city: 'Bandung', province: '32', postalCode: '40115' },
      expectedTotal: idr(154_800_000),
    });
  });

  it.each([
    ['email', { ...DETAILS, email: 'not-an-email' }],
    ['phone', { ...DETAILS, phone: '021 555 1234' }],
    ['province', { ...DETAILS, address: { ...DETAILS.address, province: '99' } }],
    ['postal code', { ...DETAILS, address: { ...DETAILS.address, postalCode: '4011' } }],
    ['blank name', { ...DETAILS, name: '  ' }],
    ['long note', { ...DETAILS, note: 'x'.repeat(501) }],
    ['unknown field', { ...DETAILS, coupon: 'FREE' }],
    ['unknown address field', { ...DETAILS, address: { ...DETAILS.address, country: 'SG' } }],
    ['missing total', { ...DETAILS, expectedTotal: undefined }],
  ])('rejects %s', (_, body) => expect(ok(PlaceOrderRequest, body)).toBe(false));
});

describe('checkout responses', () => {
  it('CheckoutSummary carries totals and readiness', () => {
    expect(
      ok(CheckoutSummary, {
        lines: [],
        subtotal: idr(0),
        shippingFee: idr(2_000_000),
        total: idr(2_000_000),
        ready: false,
      }),
    ).toBe(true);
  });

  it('StoreOrder is strict: copies only, no internal ids or stock', () => {
    expect(ok(StoreOrder, ORDER)).toBe(true);
    for (const extra of [{ id: 'x' }, { accessKey: 'x' }, { cartId: 'x' }]) {
      expect(ok(StoreOrder, { ...ORDER, ...extra })).toBe(false);
    }
    expect(ok(StoreOrder, { ...ORDER, lines: [{ ...ORDER.lines[0], variantId: 'x' }] })).toBe(
      false,
    );
    expect(ok(StoreOrder, { ...ORDER, status: 'PAID' })).toBe(false);
    expect(ok(PlaceOrderResponse, { order: ORDER, accessKey: 'k'.repeat(43) })).toBe(true);
    expect(ok(PlaceOrderResponse, { order: ORDER, accessKey: 'short' })).toBe(false);
  });

  it('defines the checkout error codes', () => {
    for (const code of ['CART_EMPTY', 'CART_CHANGED', 'ORDER_NOT_FOUND']) {
      expect(ErrorCode.options).toContain(code);
    }
  });
});
