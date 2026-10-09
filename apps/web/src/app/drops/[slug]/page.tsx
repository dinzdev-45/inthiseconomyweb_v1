import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { loadEnv } from '@/env';
import { CatalogGrid } from '@/features/catalog';
import { toProductSummary } from '@/features/catalog/server/mapper';
import { DropView } from '@/features/drops';
import { getDrop, toDropSummary } from '@/features/drops/server/drops';

type Props = { params: Promise<{ slug: string }> };

// Metadata and page share one memoized GET for the drop.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const drop = await getDrop((await params).slug);
  if (!drop) return { robots: { index: false } };
  return {
    title: `${drop.title} · ${drop.collection}`,
    description:
      drop.description?.slice(0, 160) ??
      `${drop.collection}: ${drop.title}, an InThisEconomy drop.`,
    alternates: { canonical: `/drops/${drop.slug}` },
  };
}

/**
 * One published drop and its products. A draft or unknown drop is the storefront's 404 (no
 * loading.tsx: a loading boundary would stream a 200 before the 404 is known).
 */
export default async function DropPage({ params }: Props) {
  const drop = await getDrop((await params).slug);
  if (!drop) notFound();
  const hosts = loadEnv().STOREFRONT_IMAGE_HOSTS;
  return (
    <DropView
      drop={toDropSummary(drop, hosts)}
      description={drop.description}
      productCount={drop.products.length}
      products={
        <CatalogGrid products={drop.products.map((product) => toProductSummary(product, hosts))} />
      }
    />
  );
}
