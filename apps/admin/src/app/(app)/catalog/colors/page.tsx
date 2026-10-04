import type { Metadata } from 'next';

import { NotPermitted } from '@/components/NotPermitted';
import { listColors, loadCatalogPage } from '@/features/catalog/data';
import { ColorsManager } from '@/features/catalog/reference/ColorsManager';

export const metadata: Metadata = { title: 'Colors' };

export default async function ColorsPage() {
  const page = await loadCatalogPage(() => listColors());
  if (!page.permitted) return <NotPermitted />;
  return <ColorsManager colors={page.data.data} canManage={page.access.canManage} />;
}
