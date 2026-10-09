import type { ErrorCode } from '@ite/contracts';

/*
 * Cart outcomes carried in redirect URLs (guest-cart design D5): a failed add returns to the
 * product page with `cart=<reason>`; cart page changes land on `/cart?status=<status>`.
 */

export type AddFailure = 'unavailable' | 'notReleased' | 'stock' | 'limit' | 'full' | 'failed';
export type CartStatus = 'updated' | 'removed' | Exclude<AddFailure, 'full' | 'notReleased'>;

/** Why an add failed, from the API's problem code (anything unexpected is "failed"). */
export function addFailure(code: ErrorCode | undefined): AddFailure {
  switch (code) {
    case 'VARIANT_UNAVAILABLE':
      return 'unavailable';
    case 'NOT_RELEASED':
      return 'notReleased';
    case 'INSUFFICIENT_STOCK':
      return 'stock';
    case 'QUANTITY_LIMIT':
      return 'limit';
    case 'CART_FULL':
      return 'full';
    default:
      return 'failed';
  }
}

/** Why a cart page change failed. */
export function changeFailure(code: ErrorCode | undefined): CartStatus {
  const reason = addFailure(code);
  if (reason === 'notReleased') return 'unavailable';
  return reason === 'full' ? 'failed' : reason;
}

export const ADD_FAILURE_MESSAGES: Record<AddFailure, string> = {
  unavailable: 'This item is no longer available in that color and size.',
  notReleased: 'This item isn’t released yet.',
  stock: 'There isn’t enough stock to add another one.',
  limit: 'You already have the most of this item a cart can hold (10).',
  full: 'Your cart is full. Remove something to add this item.',
  failed: 'We couldn’t add this item right now. Please try again.',
};

export const CART_STATUS_MESSAGES: Record<CartStatus, string> = {
  updated: 'Quantity updated.',
  removed: 'Item removed.',
  unavailable: 'That item is no longer available, so its quantity can’t be raised.',
  stock: 'There isn’t enough stock for that quantity.',
  limit: 'A cart can hold at most 10 of one item.',
  failed: 'We couldn’t update your cart right now. Please try again.',
};

/** Parses a reason from a search param value, or undefined. */
export function parseReason<T extends string>(
  value: string | string[] | undefined,
  allowed: Record<T, string>,
): T | undefined {
  return typeof value === 'string' && value in allowed ? (value as T) : undefined;
}

/** A product page path (with its selection) that is safe to redirect back to. */
export function safeReturnTo(value: unknown, productSlug: string): string {
  return typeof value === 'string' && /^\/products\/[a-z0-9-]+(\?[A-Za-z0-9=&%._-]*)?$/.test(value)
    ? value
    : `/products/${productSlug}`;
}

/** `path` with `name=value` set (keeping its other parameters). */
export function withParam(path: string, name: string, value: string): string {
  const url = new URL(path, 'http://storefront.invalid');
  url.searchParams.set(name, value);
  return `${url.pathname}${url.search}`;
}
