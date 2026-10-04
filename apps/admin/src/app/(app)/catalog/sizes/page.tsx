import type { Metadata } from 'next';

import { NotPermitted } from '@/components/NotPermitted';
import { listSizes, loadCatalogPage } from '@/features/catalog/data';
import { SizesManager } from '@/features/catalog/reference/SizesManager';

export const metadata: Metadata = { title: 'Sizes' };

export default async function SizesPage() {
  const page = await loadCatalogPage(() => listSizes());
  if (!page.permitted) return <NotPermitted />;
  return <SizesManager sizes={page.data.data} canManage={page.access.canManage} />;
}
