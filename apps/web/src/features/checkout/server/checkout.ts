import 'server-only';

import {
  CheckoutSummary,
  OrderAccessKey,
  OrderNumber,
  ORDER_KEY_HEADER,
  StoreOrder,
} from '@ite/contracts';

import { StoreApiError, storeRequest } from '@/lib/api/store';
import { readCartToken } from '@/lib/cart-cookie';

/**
 * The cart priced for checkout, or null when there is no cart (no cookie, or the API no longer
 * knows it). Other failures throw for the error boundary.
 */
export async function getCheckoutSummary(): Promise<CheckoutSummary | null> {
  const cartToken = await readCartToken();
  if (!cartToken) return null;
  try {
    return await storeRequest('GET', '/api/v1/store/checkout', CheckoutSummary, { cartToken });
  } catch (error) {
    if (error instanceof StoreApiError && error.code === 'CART_NOT_FOUND') return null;
    throw error;
  }
}

/**
 * An order for whoever holds its key, or null for a malformed, unknown, or wrong number or key
 * (malformed ones never reach the API). Other failures throw.
 */
export async function getOrder(
  number: string,
  key: string | undefined,
): Promise<StoreOrder | null> {
  if (!OrderNumber.safeParse(number).success || !OrderAccessKey.safeParse(key).success) return null;
  try {
    return await storeRequest('GET', `/api/v1/store/orders/${number}`, StoreOrder, {
      headers: { [ORDER_KEY_HEADER]: key! },
    });
  } catch (error) {
    if (error instanceof StoreApiError && error.code === 'ORDER_NOT_FOUND') return null;
    throw error;
  }
}
