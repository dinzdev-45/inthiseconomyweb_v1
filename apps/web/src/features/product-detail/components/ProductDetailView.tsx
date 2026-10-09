import Link from 'next/link';
import type { ReactNode } from 'react';

import type { Selection } from '../selection.ts';
import type { SizeGuide as SizeGuideData } from '../size-guide.ts';
import type { ProductDetail } from '../types.ts';
import { ColorOptions } from './ColorOptions.tsx';
import { Gallery } from './Gallery.tsx';
import { PriceBlock } from './PriceBlock.tsx';
import { SizeGuide } from './SizeGuide.tsx';
import { SizeOptions } from './SizeOptions.tsx';

type ProductDetailViewProps = {
  product: ProductDetail;
  selection: Selection;
  sizeGuide: SizeGuideData | null;
  /** The add-to-cart control, from the cart feature (composed by the route). */
  cartControl?: ReactNode;
};

/**
 * The product detail page (storefront-product-detail): gallery, then name, category, price,
 * color and size options, the add-to-cart control, size guide, and description. No quantity or
 * wishlist controls.
 */
export function ProductDetailView({
  product,
  selection,
  sizeGuide,
  cartControl,
}: ProductDetailViewProps) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-8 md:px-8 md:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <Gallery images={selection.gallery} />
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="text-label text-stone uppercase">{product.category.name}</p>
          <h1 className="mt-2 text-title font-black uppercase font-stretch-expanded break-words">
            {product.name}
          </h1>
          <PriceBlock selection={selection} releaseAt={product.releaseAt} drop={product.drop} />
          <ColorOptions colors={selection.colors} selected={selection.color} />
          <SizeOptions
            sizes={selection.sizes}
            selected={selection.size}
            colorName={selection.color.name}
          />
          {cartControl}
          {sizeGuide ? <SizeGuide guide={sizeGuide} /> : null}
          {product.description ? (
            <div className="mt-8">
              <h2 className="text-label uppercase">Details</h2>
              <p className="mt-2 max-w-prose text-sm whitespace-pre-line">{product.description}</p>
            </div>
          ) : null}
          <Link href="/shop" className="mt-10 inline-block text-sm underline underline-offset-4">
            Back to the shop
          </Link>
        </div>
      </div>
    </section>
  );
}
