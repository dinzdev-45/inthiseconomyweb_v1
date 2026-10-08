import { CART_TOKEN_HEADER, CreateCartResponse, StoreCart } from '@ite/contracts';

import type { CatalogHarness } from './catalog.ts';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Store cart API helpers on top of the catalog harness. */
export function cartClient(c: CatalogHarness) {
  const call = (method: Method, url: string, token?: string, payload?: object) =>
    c.h.app.inject({
      method,
      url: `/api/v1/store${url}`,
      headers: token === undefined ? {} : { [CART_TOKEN_HEADER]: token },
      ...(payload ? { payload } : {}),
    });

  return {
    call,
    async create() {
      return CreateCartResponse.parse(c.ok(await call('POST', '/cart'), 201));
    },
    async get(token: string) {
      return StoreCart.parse(c.ok(await call('GET', '/cart', token)));
    },
    add(token: string, item: object) {
      return call('POST', '/cart/items', token, item);
    },
    async added(token: string, item: object) {
      return StoreCart.parse(c.ok(await call('POST', '/cart/items', token, item)));
    },
    update(token: string, lineId: string, quantity: number) {
      return call('PATCH', `/cart/items/${lineId}`, token, { quantity });
    },
    remove(token: string, lineId: string) {
      return call('DELETE', `/cart/items/${lineId}`, token);
    },
  };
}

/**
 * An ACTIVE product with one ACTIVE variant per entry (fresh size and color each unless given),
 * returning the product, its variants, and the add-to-cart keys of each variant.
 */
export async function sellableProduct(
  c: CatalogHarness,
  name: string,
  variants: { stockQuantity?: number; priceOverride?: object }[] = [{ stockQuantity: 5 }],
) {
  const product = await c.product({ name });
  const made = [];
  for (const options of variants) {
    const size = await c.size();
    const color = await c.color();
    const variant = await c.variant(product.id, { sizeId: size.id, colorId: color.id, ...options });
    made.push({
      variant,
      key: { productSlug: product.slug, colorSlug: color.slug, sizeCode: size.code },
    });
  }
  await c.image(product.id);
  await c.activate(product.id);
  return { product, variants: made };
}
