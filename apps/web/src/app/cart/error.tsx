'use client';

import { CartUnavailable } from '@/features/cart';

/** The cart API failed or is unreachable: a friendly message, never error details. */
export default function CartError() {
  return <CartUnavailable />;
}
