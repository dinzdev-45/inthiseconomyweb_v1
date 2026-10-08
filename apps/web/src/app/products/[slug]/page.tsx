import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  ProductDetailView,
  productMetadata,
  resolveSelection,
  sizeGuideFor,
} from '@/features/product-detail';
import { getProductDetail } from '@/features/product-detail/server/product';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Metadata and page call getProductDetail with the same GET; Next memoizes it (one request).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductDetail((await params).slug);
  return product ? productMetadata(product) : { robots: { index: false } };
}

/**
 * The product detail page: server-rendered from the product and the URL's `color` and `size`;
 * the browser never calls the API. Anything but an active product is a 404. There is deliberately
 * no loading.tsx here: a loading boundary would start streaming with status 200 before the 404 is
 * known, and the spec requires the 404 status.
 */
export default async function ProductPage({ params, searchParams }: Props) {
  const product = await getProductDetail((await params).slug);
  if (!product) notFound();
  const selection = resolveSelection(product, await searchParams);
  const sizeGuide = sizeGuideFor(selection.sizes.map((size) => size.code));
  return <ProductDetailView product={product} selection={selection} sizeGuide={sizeGuide} />;
}
