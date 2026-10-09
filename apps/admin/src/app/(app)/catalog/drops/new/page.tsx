import type { Metadata } from 'next';
import Link from 'next/link';

import { NotPermitted } from '@/components/NotPermitted';
import { loadCatalogPage } from '@/features/catalog/data';
import { DropForm } from '@/features/catalog/drops/DropForm';
import { PageHeader } from '@/features/catalog/shared/PageHeader';

export const metadata: Metadata = { title: 'New drop' };

export default async function NewDropPage() {
  const page = await loadCatalogPage(async () => null, { requireManage: true });
  if (!page.permitted) return <NotPermitted />;

  return (
    <section className="space-y-6">
      <p className="text-sm">
        <Link href="/catalog/drops" className="underline">
          Drops
        </Link>
      </p>
      <PageHeader
        title="New drop"
        description="New drops start as drafts. Add an image and products, then publish."
      />
      <DropForm />
    </section>
  );
}
