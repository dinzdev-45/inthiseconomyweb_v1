import 'server-only';

import { StoreCart } from '@ite/contracts';

import { StoreApiError, storeRequest } from '@/lib/api/store';

import { readCartToken } from '@/lib/cart-cookie';

/**
 * The customer's cart, or null when there is no cart cookie or the API no longer knows the cart
 * (unknown or expired: treated as no cart). Other failures throw for the error boundary.
 */
export async function getCart(): Promise<StoreCart | null> {
  const cartToken = await readCartToken();
  if (!cartToken) return null;
  try {
    return await storeRequest('GET', '/api/v1/store/cart', StoreCart, { cartToken });
  } catch (error) {
    if (error instanceof StoreApiError && error.code === 'CART_NOT_FOUND') return null;
    throw error;
  }
}
