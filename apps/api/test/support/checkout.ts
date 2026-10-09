import {
  CART_TOKEN_HEADER,
  CheckoutSummary,
  ORDER_KEY_HEADER,
  PlaceOrderResponse,
  type Money,
} from '@ite/contracts';

import { cartClient } from './cart.ts';
import type { CatalogHarness } from './catalog.ts';

/** Valid guest details; `expectedTotal` is filled in per call. */
export const DETAILS = {
  email: 'Ana@Example.com',
  name: 'Ana Putri',
  phone: '0812 3456 7890',
  address: {
    line1: 'Jl. Melati No. 5',
    line2: 'Blok C',
    city: 'Bandung',
    province: '32',
    postalCode: '40115',
  },
  note: 'Leave with the guard',
};

/** Checkout and order API helpers on top of the catalog harness. */
export function checkoutClient(c: CatalogHarness) {
  const cart = cartClient(c);
  const store = (
    method: 'GET' | 'POST',
    url: string,
    headers: Record<string, string>,
    payload?: object,
  ) =>
    c.h.app.inject({
      method,
      url: `/api/v1/store${url}`,
      headers,
      ...(payload ? { payload } : {}),
    });

  return {
    cart,
    summaryResponse: (token?: string) =>
      store('GET', '/checkout', token === undefined ? {} : { [CART_TOKEN_HEADER]: token }),
    async summary(token: string) {
      return CheckoutSummary.parse(
        c.ok(await store('GET', '/checkout', { [CART_TOKEN_HEADER]: token })),
      );
    },
    placeResponse: (token: string, expectedTotal: Money, details: object = DETAILS) =>
      store('POST', '/orders', { [CART_TOKEN_HEADER]: token }, { ...details, expectedTotal }),
    async place(token: string, expectedTotal: Money, details: object = DETAILS) {
      return PlaceOrderResponse.parse(
        c.ok(
          await store(
            'POST',
            '/orders',
            { [CART_TOKEN_HEADER]: token },
            { ...details, expectedTotal },
          ),
          201,
        ),
      );
    },
    /** Places an order for whatever the cart holds, at the summary's total. */
    async placeCart(token: string, details: object = DETAILS) {
      const { total } = await this.summary(token);
      return this.place(token, total, details);
    },
    orderResponse: (number: string, key?: string) =>
      store('GET', `/orders/${number}`, key === undefined ? {} : { [ORDER_KEY_HEADER]: key }),
  };
}

/** Stock of one variant, read straight from the database. */
export async function stockOf(c: CatalogHarness, variantId: string): Promise<number> {
  const variant = await c.h.db.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  return variant.stockQuantity;
}
