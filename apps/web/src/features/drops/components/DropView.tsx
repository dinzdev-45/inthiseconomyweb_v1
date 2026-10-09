import Link from 'next/link';
import type { ReactNode } from 'react';

import type { DropSummary } from '../types.ts';
import { DropHero } from './DropHero.tsx';

/** /drops/<slug>: the drop's hero and its products (a catalog grid, composed by the route). */
export function DropView({
  drop,
  description,
  products,
  productCount,
}: {
  drop: DropSummary;
  description: string | null;
  products: ReactNode;
  productCount: number;
}) {
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-10 md:px-8 md:py-16">
      <DropHero drop={drop} description={description} />
      <h2 className="mt-16 text-label uppercase">
        {productCount === 1 ? '1 piece' : `${productCount} pieces`}
      </h2>
      <div className="mt-6">{products}</div>
      <Link href="/drops" className="mt-12 inline-block text-sm underline underline-offset-4">
        All drops
      </Link>
    </section>
  );
}
