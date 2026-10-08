import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { productMetadata, ProductPlaceholder } from '@/features/catalog';
import { getStoreProduct } from '@/features/catalog/server/catalog';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getStoreProduct((await params).slug);
  return product ? productMetadata(product.name) : { robots: { index: false } };
}

/** Placeholder until product detail exists; anything but an active product is a 404. */
export default async function ProductPage({ params }: Props) {
  const product = await getStoreProduct((await params).slug);
  if (!product) notFound();
  return <ProductPlaceholder product={product} />;
}
