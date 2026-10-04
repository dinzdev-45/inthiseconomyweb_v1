import type { Metadata } from 'next';
import Link from 'next/link';

import { NotPermitted } from '@/components/NotPermitted';
import { listCategories, loadCatalogPage, loadProductPage } from '@/features/catalog/data';
import { firstPageHref, parseListState } from '@/features/catalog/products/list-query';
import { ProductFilters } from '@/features/catalog/products/ProductFilters';
import { ProductList } from '@/features/catalog/products/ProductList';
import { PageHeader } from '@/features/catalog/shared/PageHeader';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseListState(await searchParams);
  const page = await loadCatalogPage(async () => {
    const [categories, list] = await Promise.all([listCategories(), loadProductPage(state)]);
    return { categories: categories.data, list };
  });
  if (!page.permitted) return <NotPermitted />;
  const { categories, list } = page.data;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Products"
        actions={
          page.access.canManage ? (
            <Link
              href="/catalog/products/new"
              className="rounded bg-ink px-3 py-2 text-sm font-medium text-paper hover:opacity-90"
            >
              New product
            </Link>
          ) : null
        }
      />
      <ProductFilters state={state} categories={categories} />
      {list.ok ? (
        <ProductList
          items={list.page.data}
          nextCursor={list.page.nextCursor}
          state={state}
          canManage={page.access.canManage}
        />
      ) : (
        <div role="alert" className="space-y-2 rounded border border-line bg-white px-4 py-6">
          <p className="font-medium">This page link is no longer valid.</p>
          <p className="text-sm text-muted">
            Page links expire or stop working when they are changed. Start again from the first
            page.
          </p>
          <Link href={firstPageHref(state)} className="text-sm underline">
            Go to the first page
          </Link>
        </div>
      )}
    </section>
  );
}
