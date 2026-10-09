import type { Metadata } from 'next';
import Link from 'next/link';

import { NotPermitted } from '@/components/NotPermitted';
import { listDrops, loadCatalogPage } from '@/features/catalog/data';
import { DropList } from '@/features/catalog/drops/DropList';
import { PageHeader } from '@/features/catalog/shared/PageHeader';

export const metadata: Metadata = { title: 'Drops' };

export default async function DropsPage() {
  const page = await loadCatalogPage(async () => (await listDrops()).data);
  if (!page.permitted) return <NotPermitted />;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Drops"
        description="Release times are in Western Indonesian Time (WIB)."
        actions={
          page.access.canManage ? (
            <Link
              href="/catalog/drops/new"
              className="rounded bg-ink px-3 py-2 text-sm font-medium text-paper hover:opacity-90"
            >
              New drop
            </Link>
          ) : null
        }
      />
      <DropList items={page.data} canManage={page.access.canManage} />
    </section>
  );
}
