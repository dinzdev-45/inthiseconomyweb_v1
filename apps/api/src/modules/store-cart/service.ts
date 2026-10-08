import {
  CART_LINE_MAX,
  CART_QUANTITY_MAX,
  CartToken,
  type AddCartItemRequest,
  type CreateCartResponse,
  type StoreCart,
} from '@ite/contracts';

import type { Clock } from '../../clock.ts';
import { DomainError } from '../../errors.ts';
import type { CartViewRow, StoreCartRepository } from './repository.ts';
import { CART_TTL_MS, generateCartToken, hashCartToken } from './token.ts';

/*
 * Guest carts (store-cart-api spec, guest-cart design D3). The server owns every rule: which
 * variants are sellable, the quantity limit, stock checks, and prices. Errors never state stock.
 */

const cartNotFound = () => new DomainError('CART_NOT_FOUND', 404, 'Cart not found.');
const errors = {
  unavailable: () =>
    new DomainError(
      'VARIANT_UNAVAILABLE',
      409,
      'This product is not available in that color and size.',
    ),
  quantityLimit: () =>
    new DomainError(
      'QUANTITY_LIMIT',
      409,
      `A cart can hold at most ${CART_QUANTITY_MAX} of one item.`,
    ),
  stock: () => new DomainError('INSUFFICIENT_STOCK', 409, 'Not enough stock for this quantity.'),
  full: () => new DomainError('CART_FULL', 409, `A cart can hold at most ${CART_LINE_MAX} items.`),
  lineNotFound: () => new DomainError('NOT_FOUND', 404, 'Cart line not found.'),
};

export function createStoreCartService({
  repo,
  clock,
  secret,
  storeCurrency,
}: {
  repo: StoreCartRepository;
  clock: Clock;
  secret: string;
  storeCurrency: string;
}) {
  const expiry = (now: Date) => new Date(now.getTime() + CART_TTL_MS);

  /** The token's hash; a missing or malformed token is "not found", like an unknown one. */
  function tokenHash(token: string | undefined): string {
    if (!CartToken.safeParse(token).success) throw cartNotFound();
    return hashCartToken(secret, token!);
  }

  function toCart(rows: CartViewRow[]): StoreCart {
    const lines = rows.map((row) => ({
      id: row.id,
      product: { slug: row.productSlug, name: row.productName, image: row.image },
      color: { slug: row.colorSlug, name: row.colorName },
      size: { code: row.sizeCode, label: row.sizeLabel },
      quantity: row.quantity,
      unitPrice: { amount: row.unitAmount, currency: row.currency },
      lineTotal: { amount: row.unitAmount * row.quantity, currency: row.currency },
      status: row.status,
    }));
    const counted = lines.filter((line) => line.status === 'AVAILABLE');
    return {
      lines,
      itemCount: counted.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: {
        amount: counted.reduce((sum, line) => sum + line.lineTotal.amount, 0),
        currency: storeCurrency,
      },
    };
  }

  /** Runs a cart change on the locked cart, then returns the cart as it is now. */
  async function change(
    token: string | undefined,
    fn: (
      cartId: string,
      tx: Parameters<Parameters<StoreCartRepository['transaction']>[0]>[0],
    ) => Promise<void>,
  ): Promise<StoreCart> {
    const hash = tokenHash(token);
    const now = clock.now();
    const cartId = await repo.transaction(async (tx) => {
      const cart = await repo.lockLive(tx, hash, now);
      if (!cart) throw cartNotFound();
      await fn(cart.id, tx);
      await repo.touch(tx, cart.id, now, expiry(now));
      return cart.id;
    });
    return toCart(await repo.view(cartId));
  }

  return {
    async create(): Promise<CreateCartResponse> {
      const token = generateCartToken();
      const now = clock.now();
      await repo.create({
        tokenHash: hashCartToken(secret, token),
        createdAt: now,
        expiresAt: expiry(now),
      });
      return { token, cart: toCart([]) };
    },

    async get(token: string | undefined): Promise<StoreCart> {
      const cart = await repo.findLive(tokenHash(token), clock.now());
      if (!cart) throw cartNotFound();
      return toCart(await repo.view(cart.id));
    },

    /** Adds a sellable variant, merging into its existing line. A rejected add changes nothing. */
    addItem(token: string | undefined, item: AddCartItemRequest): Promise<StoreCart> {
      return change(token, async (cartId, tx) => {
        const variant = await repo.findSellableVariant(tx, item);
        if (!variant) throw errors.unavailable();
        const existing = await repo.findLineByVariant(tx, cartId, variant.variantId);
        const quantity = (existing?.quantity ?? 0) + item.quantity;
        if (quantity > CART_QUANTITY_MAX) throw errors.quantityLimit();
        if (quantity > variant.stock) throw errors.stock();
        if (existing) {
          await repo.setQuantity(tx, existing.id, quantity, clock.now());
        } else {
          if ((await repo.lineCount(tx, cartId)) >= CART_LINE_MAX) throw errors.full();
          await repo.insertLine(tx, {
            cartId,
            variantId: variant.variantId,
            quantity,
            now: clock.now(),
          });
        }
      });
    },

    /** Sets a line's quantity. Lowering it is always allowed; raising it needs a sellable variant and stock. */
    updateItem(token: string | undefined, lineId: string, quantity: number): Promise<StoreCart> {
      return change(token, async (cartId, tx) => {
        const line = await repo.findLine(tx, cartId, lineId);
        if (!line) throw errors.lineNotFound();
        if (quantity > line.quantity) {
          if (!line.sellable) throw errors.unavailable();
          if (quantity > line.stock) throw errors.stock();
        }
        await repo.setQuantity(tx, line.id, quantity, clock.now());
      });
    },

    removeItem(token: string | undefined, lineId: string): Promise<StoreCart> {
      return change(token, async (cartId, tx) => {
        const line = await repo.findLine(tx, cartId, lineId);
        if (!line) throw errors.lineNotFound();
        await repo.deleteLine(tx, line.id);
      });
    },
  };
}

export type StoreCartService = ReturnType<typeof createStoreCartService>;
