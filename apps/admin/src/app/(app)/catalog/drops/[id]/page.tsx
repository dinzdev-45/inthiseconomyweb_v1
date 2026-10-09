import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotPermitted } from '@/components/NotPermitted';
import { getDrop, loadCatalogPage } from '@/features/catalog/data';
import { DropActions } from '@/features/catalog/drops/DropActions';
import { DropDetails } from '@/features/catalog/drops/DropDetails';
import { DropForm } from '@/features/catalog/drops/DropForm';
import { DropProductPicker } from '@/features/catalog/drops/DropProductPicker';
import { PageHeader } from '@/features/catalog/shared/PageHeader';

export const metadata: Metadata = { title: 'Drop' };

export default async function DropPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const page = await loadCatalogPage(() => getDrop(id));
  if (!page.permitted) return <NotPermitted />;
  const drop = page.data;
  if (!drop) notFound();
  const { canManage } = page.access;

  return (
    <section className="space-y-8">
      <p className="text-sm">
        <Link href="/catalog/drops" className="underline">
          Drops
        </Link>
      </p>
      <PageHeader
        title={drop.title}
        description={
          <span className="inline-flex items-center gap-2">
            <span className="uppercase">{drop.collection}</span>
            <span className="font-mono">{drop.slug}</span>
          </span>
        }
      />
      {created ? (
        <p role="status" className="rounded border border-line bg-white px-3 py-2 text-sm">
          Drop created as a draft. Add an image and products, then publish it.
        </p>
      ) : null}

      <DropActions drop={drop} canManage={canManage} />

      <section aria-labelledby="details-heading" className="space-y-3">
        <h2 id="details-heading" className="font-semibold">
          Details
        </h2>
        {canManage ? <DropForm drop={drop} /> : <DropDetails drop={drop} />}
      </section>

      <section aria-labelledby="products-heading" className="space-y-3">
        <h2 id="products-heading" className="font-semibold">
          Products
        </h2>
        <DropProductPicker drop={drop} canManage={canManage} />
      </section>
    </section>
  );
}
