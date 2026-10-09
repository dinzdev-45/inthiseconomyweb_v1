import type { Metadata } from 'next';

import { CheckoutView } from '@/features/checkout';
import { getCheckoutSummary } from '@/features/checkout/server/checkout';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Check out your InThisEconomy cart as a guest.',
  robots: { index: false, follow: false },
};

/** Guest checkout, read on the server from the cart cookie; the browser never calls the API. */
export default async function CheckoutPage() {
  return <CheckoutView summary={await getCheckoutSummary()} />;
}
