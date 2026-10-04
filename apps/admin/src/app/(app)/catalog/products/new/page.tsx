import type { Metadata } from 'next';
import Link from 'next/link';

import { NotPermitted } from '@/components/NotPermitted';
import { getCatalogSettings, listCategories, loadCatalogPage } from '@/features/catalog/data';
import { ProductForm } from '@/features/catalog/products/ProductForm';
import { EmptyState } from '@/features/catalog/shared/EmptyState';
import { PageHeader } from '@/features/catalog/shared/PageHeader';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage() {
  const page = await loadCatalogPage(
    async () => {
      const [categories, settings] = await Promise.all([listCategories(), getCatalogSettings()]);
      return { categories: categories.data, storeCurrency: settings.storeCurrency };
    },
    { requireManage: true },
  );
  if (!page.permitted) return <NotPermitted />;
  const { categories, storeCurrency } = page.data;

  return (
    <section className="space-y-6">
      <p className="text-sm">
        <Link href="/catalog/products" className="underline">
          Products
        </Link>
      </p>
      <PageHeader
        title="New product"
        description="New products start as drafts. Add variants and images, then activate."
      />
      {categories.length === 0 ? (
        <EmptyState
          title="Create a category first."
          action={{ href: '/catalog/categories', label: 'Go to categories' }}
        >
          Every product belongs to a category.
        </EmptyState>
      ) : (
        <ProductForm categories={categories} storeCurrency={storeCurrency} />
      )}
    </section>
  );
}
