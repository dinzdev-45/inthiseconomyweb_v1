import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProductGrid, ProductRail, type ProductSummary } from '@/features/catalog';
import { DropFeature } from '@/features/drops';
import { HOME_CONTENT } from '@/features/home/content';

/**
 * Test-only page for the storefront Playwright suite: renders catalog and drop
 * components in a real browser before the homepage composes them. It exists only
 * when STOREFRONT_E2E_FIXTURES=1 at runtime (set by playwright.config.ts);
 * everywhere else it is a 404.
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

const withImages: ProductSummary = {
  ...HOME_CONTENT.featured.products[0]!,
  image: { src: '/e2e-fixtures/product-front.png', alt: 'Front view', width: 800, height: 1000 },
  hoverImage: { src: '/e2e-fixtures/product-back.png', alt: 'Back view', width: 800, height: 1000 },
};

export default function CatalogFixturesPage() {
  if (process.env.STOREFRONT_E2E_FIXTURES !== '1') notFound();
  const { featured, newArrivals, drop } = HOME_CONTENT;

  return (
    <div className="mx-auto max-w-[1600px] space-y-24 px-4 py-16 md:px-8">
      <h1 className="sr-only">Catalog fixtures</h1>
      <section aria-label="Grid" data-fixture="grid">
        <ProductGrid products={[withImages, ...featured.products.slice(1)]} />
      </section>
      <section aria-label="Rail" data-fixture="rail">
        <ProductRail products={newArrivals.products} />
      </section>
      <div data-fixture="drop-live">
        <DropFeature drop={drop} headingId="fixture-drop-live" />
      </div>
      <div data-fixture="drop-upcoming">
        <DropFeature
          drop={drop && { ...drop, status: 'upcoming', startsAt: '2026-11-20T03:00:00.000Z' }}
          headingId="fixture-drop-upcoming"
        />
      </div>
    </div>
  );
}
