'use server';

import { PlaceOrderResponse } from '@ite/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { StoreApiError, storeRequest } from '@/lib/api/store';
import { readCartToken } from '@/lib/cart-cookie';

import { fieldOf, readValues, toRequest, type CheckoutFormState, type Field } from './form.ts';

/**
 * Places the order (storefront-checkout spec, guest-checkout design D7). Used with
 * `useActionState`, so it works without client JavaScript: problems come back as state (with the
 * values entered); success redirects to the order page, the only place the access key appears.
 */
export async function placeOrder(
  _previous: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  const values = readValues(formData);
  const expectedTotal = {
    amount: Number(formData.get('expectedAmount')),
    currency: String(formData.get('expectedCurrency') ?? ''),
  };
  const parsed = toRequest(values, expectedTotal);
  if (!parsed.ok) return { status: 'invalid', errors: parsed.errors, values };

  const cartToken = await readCartToken();
  if (!cartToken) {
    revalidatePath('/checkout');
    return { status: 'changed', values };
  }

  let target: string;
  try {
    const { order, accessKey } = await storeRequest(
      'POST',
      '/api/v1/store/orders',
      PlaceOrderResponse,
      { cartToken, body: parsed.request },
    );
    target = `/orders/${order.number}?key=${encodeURIComponent(accessKey)}`;
  } catch (error) {
    const code = error instanceof StoreApiError ? error.code : undefined;
    if (code === 'CART_CHANGED' || code === 'CART_EMPTY' || code === 'CART_NOT_FOUND') {
      // Re-render the page with the cart as it is now.
      revalidatePath('/checkout');
      return { status: 'changed', values };
    }
    if (code === 'VALIDATION_FAILED' && error instanceof StoreApiError) {
      return { status: 'invalid', errors: apiFieldErrors(error), values };
    }
    return { status: 'failed', values };
  }
  redirect(target);
}

/** Field errors from the API's problem details (a fallback: the form validates first). */
function apiFieldErrors(error: StoreApiError): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const { path, message } of error.problem?.errors ?? []) {
    const field = fieldOf(path);
    if (field && !errors[field]) errors[field] = message;
  }
  return errors;
}
