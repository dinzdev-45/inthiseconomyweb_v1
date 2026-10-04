import { CategoryStatus } from '@ite/contracts';
import type { Metadata } from 'next';

import { NotPermitted } from '@/components/NotPermitted';
import { listCategories, loadCatalogPage } from '@/features/catalog/data';
import { CategoriesManager } from '@/features/catalog/reference/CategoriesManager';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  // An unknown status value falls back to "All" rather than failing the page.
  const parsed = CategoryStatus.safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : undefined;

  const page = await loadCatalogPage(() => listCategories(status));
  if (!page.permitted) return <NotPermitted />;
  return (
    <CategoriesManager
      categories={page.data.data}
      status={status}
      canManage={page.access.canManage}
    />
  );
}
