import { z } from 'zod';

import { StoreCartLine } from './cart.ts';
import { Slug, SizeCode } from './catalog.ts';
import { Money, Timestamp } from './primitives.ts';

/*
 * Guest checkout contracts (store-checkout-api spec). An order is reachable only with its access
 * key, sent in the `X-Order-Key` header. Orders carry copies of what was bought, never live
 * catalog data, and never internal ids.
 */

/** Request header that carries an order's access key. */
export const ORDER_KEY_HEADER = 'x-order-key';

/** Indonesia's 38 provinces by their two-digit BPS code. */
export const PROVINCES = [
  { code: '11', name: 'Aceh' },
  { code: '12', name: 'Sumatera Utara' },
  { code: '13', name: 'Sumatera Barat' },
  { code: '14', name: 'Riau' },
  { code: '15', name: 'Jambi' },
  { code: '16', name: 'Sumatera Selatan' },
  { code: '17', name: 'Bengkulu' },
  { code: '18', name: 'Lampung' },
  { code: '19', name: 'Kepulauan Bangka Belitung' },
  { code: '21', name: 'Kepulauan Riau' },
  { code: '31', name: 'DKI Jakarta' },
  { code: '32', name: 'Jawa Barat' },
  { code: '33', name: 'Jawa Tengah' },
  { code: '34', name: 'DI Yogyakarta' },
  { code: '35', name: 'Jawa Timur' },
  { code: '36', name: 'Banten' },
  { code: '51', name: 'Bali' },
  { code: '52', name: 'Nusa Tenggara Barat' },
  { code: '53', name: 'Nusa Tenggara Timur' },
  { code: '61', name: 'Kalimantan Barat' },
  { code: '62', name: 'Kalimantan Tengah' },
  { code: '63', name: 'Kalimantan Selatan' },
  { code: '64', name: 'Kalimantan Timur' },
  { code: '65', name: 'Kalimantan Utara' },
  { code: '71', name: 'Sulawesi Utara' },
  { code: '72', name: 'Sulawesi Tengah' },
  { code: '73', name: 'Sulawesi Selatan' },
  { code: '74', name: 'Sulawesi Tenggara' },
  { code: '75', name: 'Gorontalo' },
  { code: '76', name: 'Sulawesi Barat' },
  { code: '81', name: 'Maluku' },
  { code: '82', name: 'Maluku Utara' },
  { code: '91', name: 'Papua' },
  { code: '92', name: 'Papua Barat' },
  { code: '93', name: 'Papua Selatan' },
  { code: '94', name: 'Papua Tengah' },
  { code: '95', name: 'Papua Pegunungan' },
  { code: '96', name: 'Papua Barat Daya' },
] as const;

export const ProvinceCode = z.enum(PROVINCES.map((p) => p.code) as [string, ...string[]], {
  error: 'Choose a province',
});

/** `ITE-` plus 8 Crockford base32 characters. */
export const OrderNumber = z
  .string()
  .regex(/^ITE-[0-9A-HJKMNP-TV-Z]{8}$/, 'Must be an order number');

/** An order access key: 256 random bits, base64url without padding (43 characters). */
export const OrderAccessKey = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Must be an order key');

/**
 * An Indonesian mobile number (`08…`, `628…`, or `+628…`; spaces, hyphens, and parentheses
 * ignored), 10–15 digits in local form, normalized to `+628…`.
 */
export const IndonesianPhone = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .pipe(
    z
      .string()
      .regex(/^(?:\+?62|0)8\d{7,12}$/, 'Enter an Indonesian mobile number, e.g. 0812 3456 7890'),
  )
  .transform((value) => `+62${value.replace(/^(?:\+?62|0)/, '')}`);

export const PostalCode = z
  .string()
  .trim()
  .regex(/^\d{5}$/, 'Enter a 5-digit postal code');

const text = (max: number, message: string) => z.string().trim().min(1, message).max(max);
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const PlaceOrderRequest = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email address')),
  name: text(100, 'Enter the recipient’s name'),
  phone: IndonesianPhone,
  address: z.strictObject({
    line1: text(200, 'Enter the street address'),
    line2: optionalText(200),
    city: text(100, 'Enter the city or regency'),
    province: ProvinceCode,
    postalCode: PostalCode,
  }),
  note: optionalText(500),
  /** The total the customer was shown; the order is refused when it no longer matches. */
  expectedTotal: Money,
});
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequest>;

/** `GET /checkout`: the cart priced for checkout. */
export const CheckoutSummary = z.strictObject({
  lines: z.array(StoreCartLine),
  subtotal: Money,
  shippingFee: Money,
  total: Money,
  /** True when the cart has lines and all of them can be bought as they are. */
  ready: z.boolean(),
});
export type CheckoutSummary = z.infer<typeof CheckoutSummary>;

export const OrderStatus = z.enum(['AWAITING_PAYMENT', 'EXPIRED']);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const StoreOrderLine = z.strictObject({
  productName: z.string(),
  productSlug: Slug,
  colorName: z.string(),
  sizeCode: SizeCode,
  unitPrice: Money,
  quantity: z.int().min(1).max(10),
  lineTotal: Money,
});
export type StoreOrderLine = z.infer<typeof StoreOrderLine>;

export const StoreOrder = z.strictObject({
  number: OrderNumber,
  status: OrderStatus,
  placedAt: Timestamp,
  paymentDeadline: Timestamp,
  lines: z.array(StoreOrderLine),
  subtotal: Money,
  shippingFee: Money,
  total: Money,
  contact: z.strictObject({ email: z.string(), name: z.string(), phone: z.string() }),
  delivery: z.strictObject({
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string(),
    province: z.strictObject({ code: ProvinceCode, name: z.string() }),
    postalCode: z.string(),
  }),
  note: z.string().nullable(),
});
export type StoreOrder = z.infer<typeof StoreOrder>;

/** `POST /orders`: the access key is shown only here. */
export const PlaceOrderResponse = z.strictObject({ order: StoreOrder, accessKey: OrderAccessKey });
export type PlaceOrderResponse = z.infer<typeof PlaceOrderResponse>;

export const OrderNumberParams = z.strictObject({ number: OrderNumber });

/** A province's name by code (for display). */
export function provinceName(code: string): string | undefined {
  return PROVINCES.find((province) => province.code === code)?.name;
}
