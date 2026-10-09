'use server';

import {
  AddCartItemRequest,
  CartLineParams,
  CreateCartResponse,
  StoreCart,
  UpdateCartItemRequest,
} from '@ite/contracts';
import { redirect } from 'next/navigation';

import { StoreApiError, storeRequest } from '@/lib/api/store';

import { addFailure, changeFailure, safeReturnTo, withParam } from './outcome.ts';
import { readCartToken, writeCartToken } from '@/lib/cart-cookie';

/*
 * Cart Server Actions (guest-cart design D5): plain form posts that work without client
 * JavaScript, each ending in a redirect. Only contract-parsed form values reach the API; prices
 * and availability always come from it.
 */

const codeOf = (error: unknown) => (error instanceof StoreApiError ? error.code : undefined);

async function newCart(): Promise<string> {
  const { token } = await storeRequest('POST', '/api/v1/store/cart', CreateCartResponse);
  await writeCartToken(token);
  return token;
}

/** Adds one of the selected variant, creating the cart on first use; then /cart or back. */
export async function addToCart(formData: FormData): Promise<void> {
  const productSlug = String(formData.get('productSlug') ?? '');
  const returnTo = safeReturnTo(formData.get('returnTo'), productSlug);
  const item = AddCartItemRequest.safeParse({
    productSlug,
    colorSlug: formData.get('colorSlug'),
    sizeCode: formData.get('sizeCode'),
  });
  if (!item.success) redirect(withParam(returnTo, 'cart', 'unavailable'));

  let target: string;
  try {
    let cartToken = (await readCartToken()) ?? (await newCart());
    let cart: StoreCart;
    try {
      cart = await storeRequest('POST', '/api/v1/store/cart/items', StoreCart, {
        cartToken,
        body: item.data,
      });
    } catch (error) {
      // An expired or unknown cart: start a new one once.
      if (codeOf(error) !== 'CART_NOT_FOUND') throw error;
      cartToken = await newCart();
      cart = await storeRequest('POST', '/api/v1/store/cart/items', StoreCart, {
        cartToken,
        body: item.data,
      });
    }
    const line = cart.lines.find(
      (l) =>
        l.product.slug === item.data.productSlug &&
        l.color.slug === item.data.colorSlug &&
        l.size.code === item.data.sizeCode,
    );
    target = line ? `/cart?added=${line.id}` : '/cart';
  } catch (error) {
    target = withParam(returnTo, 'cart', addFailure(codeOf(error)));
  }
  redirect(target);
}

/** Runs a change to one line, then returns to /cart with its outcome. */
async function changeLine(
  formData: FormData,
  run: (cartToken: string, lineId: string) => Promise<unknown>,
  success: 'updated' | 'removed',
): Promise<void> {
  const params = CartLineParams.safeParse({ lineId: formData.get('lineId') });
  const cartToken = await readCartToken();
  if (!params.success || !cartToken) redirect('/cart');
  let target: string;
  try {
    await run(cartToken, params.data.lineId);
    target = `/cart?status=${success}`;
  } catch (error) {
    const code = codeOf(error);
    target =
      code === 'CART_NOT_FOUND' || code === 'NOT_FOUND'
        ? '/cart'
        : `/cart?status=${changeFailure(code)}`;
  }
  redirect(target);
}

export async function updateLine(formData: FormData): Promise<void> {
  const body = UpdateCartItemRequest.safeParse({ quantity: Number(formData.get('quantity')) });
  if (!body.success) redirect('/cart?status=limit');
  await changeLine(
    formData,
    (cartToken, lineId) =>
      storeRequest('PATCH', `/api/v1/store/cart/items/${lineId}`, StoreCart, {
        cartToken,
        body: body.data,
      }),
    'updated',
  );
}

export async function removeLine(formData: FormData): Promise<void> {
  await changeLine(
    formData,
    (cartToken, lineId) =>
      storeRequest('DELETE', `/api/v1/store/cart/items/${lineId}`, StoreCart, { cartToken }),
    'removed',
  );
}
