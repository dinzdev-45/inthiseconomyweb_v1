import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { OrderView } from '@/features/checkout';
import { getOrder } from '@/features/checkout/server/checkout';

export const metadata: Metadata = {
  title: 'Your order',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * A guest order, for whoever holds its key (the link from checkout). A wrong or missing key is the
 * storefront's 404. No loading.tsx: a loading boundary would stream a 200 before the 404 is known.
 */
export default async function OrderPage({ params, searchParams }: Props) {
  const key = (await searchParams).key;
  const order = await getOrder((await params).number, typeof key === 'string' ? key : undefined);
  if (!order) notFound();
  return <OrderView order={order} />;
}
