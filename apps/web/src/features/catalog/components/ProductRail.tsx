import type { ProductSummary } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';

/**
 * A horizontally scrollable row below 1024 px (with scroll snapping, contained
 * in its own box so the page never scrolls sideways), and a single-row grid at
 * 1024 px and wider (spec: New arrivals layout). Cards are links, so keyboard
 * focus scrolls the row.
 */
export function ProductRail({ products }: { products: readonly ProductSummary[] }) {
  return (
    <ul
      data-product-rail
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-2 pb-2 md:-mx-8 md:scroll-px-8 md:gap-6 md:px-8 lg:mx-0 lg:grid lg:auto-cols-fr lg:grid-flow-col lg:overflow-visible lg:px-0 lg:pt-0 lg:pb-0"
    >
      {products.map((product) => (
        <li
          key={product.slug}
          className="w-[68%] shrink-0 snap-start sm:w-[42%] md:w-[31%] lg:w-auto lg:min-w-0"
        >
          <ProductCard
            product={product}
            sizes="(min-width: 1024px) 20vw, (min-width: 768px) 31vw, 68vw"
          />
        </li>
      ))}
    </ul>
  );
}
