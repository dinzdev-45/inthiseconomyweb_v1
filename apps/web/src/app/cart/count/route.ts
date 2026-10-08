import { getCart } from '@/features/cart/server/cart';

const NO_STORE = { 'cache-control': 'no-store' };

/**
 * The cart's item count for the header (guest-cart design D6). Without a cart cookie it answers 0
 * without calling the API; an unknown or expired cart is 0; an API failure is 503 (the header then
 * keeps a plain Cart link).
 */
export async function GET(): Promise<Response> {
  try {
    const cart = await getCart();
    return Response.json({ count: cart?.itemCount ?? 0 }, { headers: NO_STORE });
  } catch {
    return Response.json({ count: null }, { status: 503, headers: NO_STORE });
  }
}
