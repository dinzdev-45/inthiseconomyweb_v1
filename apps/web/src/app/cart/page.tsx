import type { Metadata } from 'next';

import { loadEnv } from '@/env';
import { CART_STATUS_MESSAGES, CartView, parseReason, type CartStatus } from '@/features/cart';
import { getCart } from '@/features/cart/server/cart';
import { toCartView } from '@/features/cart/server/mapper';

export const metadata: Metadata = {
  title: 'Cart',
  description: 'Your InThisEconomy cart.',
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** The guest cart, read on the server from the cart cookie; the browser never calls the API. */
export default async function CartPage({ searchParams }: Props) {
  const query = await searchParams;
  const cart = await getCart();
  const added = typeof query.added === 'string' ? query.added : undefined;
  const status = parseReason<CartStatus>(query.status, CART_STATUS_MESSAGES);
  return (
    <CartView
      cart={cart && toCartView(cart, loadEnv().STOREFRONT_IMAGE_HOSTS)}
      {...(added ? { addedLineId: added } : {})}
      {...(status ? { status } : {})}
    />
  );
}
