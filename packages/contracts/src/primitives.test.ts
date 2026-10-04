import { describe, expect, it } from 'vitest';

import { AttributionFields, Id, Money, Timestamp } from './primitives.ts';

const UUID_V7 = '0199a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b';
const UUID_V4 = '9b2f6c1e-4d3a-4b5c-8d7e-1f2a3b4c5d6e';

describe('Id', () => {
  it('accepts a UUIDv7', () => {
    expect(Id.safeParse(UUID_V7).success).toBe(true);
  });

  it.each([UUID_V4, '42', 'not-a-uuid', ''])('rejects %j', (value) => {
    expect(Id.safeParse(value).success).toBe(false);
  });
});

describe('Timestamp', () => {
  it.each(['2026-10-02T08:11:59Z', '2026-10-02T08:11:59.123Z'])('accepts UTC %s', (value) => {
    expect(Timestamp.safeParse(value).success).toBe(true);
  });

  it.each(['2026-10-02T15:11:59+07:00', '2026-10-02', '2026-10-02 08:11:59', 'yesterday'])(
    'rejects %s',
    (value) => expect(Timestamp.safeParse(value).success).toBe(false),
  );
});

describe('api-conventions: Money and identifier representation', () => {
  it('Money in a response', () => {
    const body = { price: { amount: 249000, currency: 'IDR' } };
    expect(Money.parse(body.price)).toEqual({ amount: 249000, currency: 'IDR' });
    // Decimals, string amounts, and missing or non-ISO currencies are not valid money.
    for (const price of [
      { amount: 2490.5, currency: 'IDR' },
      { amount: '249000', currency: 'IDR' },
      { amount: 249000 },
      { amount: 249000, currency: 'Rp' },
    ]) {
      expect(Money.safeParse(price).success).toBe(false);
    }
  });
});

describe('Money', () => {
  it.each([
    { amount: 150000, currency: 'IDR' },
    { amount: 0, currency: 'USD' },
  ])('accepts %j', (value) => {
    expect(Money.safeParse(value).success).toBe(true);
  });

  it.each([
    { amount: 19.99, currency: 'USD' },
    { amount: '1000', currency: 'IDR' },
    { amount: 1000, currency: 'idr' },
    { amount: 1000, currency: 'RUPIAH' },
    { amount: 1000 },
    { amount: 1000, currency: 'IDR', display: 'Rp 1.000' },
  ])('rejects %j', (value) => {
    expect(Money.safeParse(value).success).toBe(false);
  });
});

describe('AttributionFields', () => {
  const base = {
    createdAt: '2026-10-02T08:11:59.000Z',
    updatedAt: '2026-10-02T08:11:59.000Z',
  };

  it('accepts staff attribution', () => {
    const value = { ...base, createdBy: UUID_V7, updatedBy: UUID_V7 };
    expect(AttributionFields.safeParse(value).success).toBe(true);
  });

  it('accepts null (system) attribution', () => {
    expect(AttributionFields.safeParse({ ...base, createdBy: null, updatedBy: null }).success).toBe(
      true,
    );
  });

  it.each(['createdBy', 'updatedBy', 'createdAt', 'updatedAt'])('rejects missing %s', (key) => {
    const value: Record<string, unknown> = { ...base, createdBy: null, updatedBy: null };
    delete value[key];
    expect(AttributionFields.safeParse(value).success).toBe(false);
  });

  it('rejects a non-UUIDv7 actor', () => {
    const value = { ...base, createdBy: 'system', updatedBy: null };
    expect(AttributionFields.safeParse(value).success).toBe(false);
  });
});
