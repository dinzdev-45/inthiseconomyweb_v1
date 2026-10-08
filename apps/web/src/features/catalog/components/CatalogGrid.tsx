import type { ProductSummary } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';

/** Grid classes shared with the loading skeleton, so both have the same card dimensions. */
export const CATALOG_GRID =
  'grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4';
const SIZES = '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw';
/** Cards in the first row at the widest layout load eagerly; the rest lazily. */
const EAGER_COUNT = 4;

/** Catalog products as a list of cards: two columns, three from 768 px, four from 1024 px. */
export function CatalogGrid({ products }: { products: readonly ProductSummary[] }) {
  return (
    <ul className={CATALOG_GRID}>
      {products.map((product, index) => (
        <li key={product.slug} className="min-w-0">
          <ProductCard product={product} sizes={SIZES} as="h2" eager={index < EAGER_COUNT} wrap />
        </li>
      ))}
    </ul>
  );
}
