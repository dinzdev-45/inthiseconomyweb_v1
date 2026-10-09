'use client';

import { CheckoutUnavailable } from '@/features/checkout';

/** The checkout API failed or is unreachable: a friendly message, never error details. */
export default function CheckoutError() {
  return <CheckoutUnavailable />;
}
