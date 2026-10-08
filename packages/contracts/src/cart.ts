import { z } from 'zod';

import { ImageUrl, SizeCode, Slug } from './catalog.ts';
import { Id, Money } from './primitives.ts';

/*
 * Guest cart contracts (store-cart-api spec). A cart is identified only by a random token sent
 * in the `X-Cart-Token` header. Responses carry current prices and line statuses, never stock
 * quantities, SKUs, or product and variant ids.
 */

/** Request header that carries the cart token (never a URL or query parameter). */
export const CART_TOKEN_HEADER = 'x-cart-token';
/** Most of one variant a cart line may hold. */
export const CART_QUANTITY_MAX = 10;
/** Most lines one cart may hold. */
export const CART_LINE_MAX = 50;

/** A cart token: 256 random bits, base64url without padding (43 characters). */
export const CartToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Must be a cart token');

const Quantity = z.int().min(1).max(CART_QUANTITY_MAX);

export const AddCartItemRequest = z.strictObject({
  productSlug: Slug,
  colorSlug: Slug,
  sizeCode: SizeCode,
  quantity: Quantity.default(1),
});
export type AddCartItemRequest = z.infer<typeof AddCartItemRequest>;

export const UpdateCartItemRequest = z.strictObject({ quantity: Quantity });
export type UpdateCartItemRequest = z.infer<typeof UpdateCartItemRequest>;

export const CartLineParams = z.strictObject({ lineId: Id });

/**
 * `AVAILABLE`: can be bought as is. `INSUFFICIENT_STOCK`: stock is now below the quantity.
 * `UNAVAILABLE`: the product or variant is no longer sold. Only AVAILABLE lines count.
 */
export const CartLineStatus = z.enum(['AVAILABLE', 'INSUFFICIENT_STOCK', 'UNAVAILABLE']);
export type CartLineStatus = z.infer<typeof CartLineStatus>;

export const StoreCartLine = z.strictObject({
  /** The line's own id (a cart resource, not a product or variant id). */
  id: Id,
  product: z.strictObject({
    slug: Slug,
    name: z.string(),
    image: z.strictObject({ url: ImageUrl, alt: z.string() }).nullable(),
  }),
  color: z.strictObject({ slug: Slug, name: z.string() }),
  size: z.strictObject({ code: SizeCode, label: z.string() }),
  quantity: Quantity,
  /** The variant's current effective price. */
  unitPrice: Money,
  lineTotal: Money,
  status: CartLineStatus,
});
export type StoreCartLine = z.infer<typeof StoreCartLine>;

export const StoreCart = z.strictObject({
  /** In the order they were added. */
  lines: z.array(StoreCartLine),
  /** Sum of quantities of AVAILABLE lines. */
  itemCount: z.int().min(0),
  /** Sum of AVAILABLE line totals, in the store currency. */
  subtotal: Money,
});
export type StoreCart = z.infer<typeof StoreCart>;

/** `POST /cart`: the token is shown only here. */
export const CreateCartResponse = z.strictObject({ token: CartToken, cart: StoreCart });
export type CreateCartResponse = z.infer<typeof CreateCartResponse>;
