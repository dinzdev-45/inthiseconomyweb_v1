import type { ProductSummary } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';

/** Product grid: two columns below 1024 px, four at 1024 px and wider (spec: Featured products grid). */
export function ProductGrid({ products }: { products: readonly ProductSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-6 lg:grid-cols-4">
      {products.map((product) => (
        <li key={product.slug} className="min-w-0">
          <ProductCard product={product} sizes="(min-width: 1024px) 25vw, 50vw" />
        </li>
      ))}
    </ul>
  );
}
