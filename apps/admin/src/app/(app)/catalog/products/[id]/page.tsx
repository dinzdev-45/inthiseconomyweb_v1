import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NotPermitted } from '@/components/NotPermitted';
import {
  getCatalogSettings,
  getProduct,
  listCategories,
  listColors,
  listSizes,
  loadCatalogPage,
} from '@/features/catalog/data';
import { ImagesList } from '@/features/catalog/products/ImagesList';
import { ImagesSection } from '@/features/catalog/products/ImagesSection';
import { LifecycleSection } from '@/features/catalog/products/LifecycleSection';
import { ProductForm } from '@/features/catalog/products/ProductForm';
import { ProductSummary } from '@/features/catalog/products/ProductSummary';
import { VariantsSection } from '@/features/catalog/products/VariantsSection';
import { VariantsTable } from '@/features/catalog/products/VariantsTable';
import { MoneyText } from '@/features/catalog/shared/MoneyText';
import { PageHeader } from '@/features/catalog/shared/PageHeader';
import { StatusBadge } from '@/features/catalog/shared/StatusBadge';

export const metadata: Metadata = { title: 'Product' };

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const page = await loadCatalogPage(async () => {
    const [product, categories, sizes, colors, settings] = await Promise.all([
      getProduct(id),
      listCategories(),
      listSizes(),
      listColors(),
      getCatalogSettings(),
    ]);
    return {
      product,
      categories: categories.data,
      sizes: sizes.data,
      colors: colors.data,
      storeCurrency: settings.storeCurrency,
    };
  });
  if (!page.permitted) return <NotPermitted />;
  const { product, categories, sizes, colors, storeCurrency } = page.data;
  if (!product) notFound();

  // Archived products are read-only until restored (the API refuses edits too).
  const editable = page.access.canManage && product.status !== 'ARCHIVED';

  return (
    <section className="space-y-8">
      <p className="text-sm">
        <Link href="/catalog/products" className="underline">
          Products
        </Link>
      </p>
      <PageHeader
        title={product.name}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={product.status} />
            <span className="font-mono">{product.slug}</span>
            <MoneyText value={product.basePrice} />
          </span>
        }
      />
      {created ? (
        <p role="status" className="rounded border border-line bg-white px-3 py-2 text-sm">
          Product created as a draft. Add variants and images, then activate it.
        </p>
      ) : null}
      {product.status === 'ARCHIVED' ? (
        <p className="rounded border border-line bg-paper px-3 py-2 text-sm text-muted">
          This product is archived and read-only. Restore it to make changes.
        </p>
      ) : null}

      <LifecycleSection product={product} canManage={page.access.canManage} />

      <section id="details" aria-labelledby="details-heading" className="space-y-3">
        <h2 id="details-heading" className="font-semibold">
          Details
        </h2>
        {editable ? (
          <ProductForm categories={categories} storeCurrency={storeCurrency} product={product} />
        ) : (
          <ProductSummary product={product} />
        )}
      </section>

      <section id="variants" aria-labelledby="variants-heading" className="space-y-3">
        <h2 id="variants-heading" className="font-semibold">
          Variants and stock
        </h2>
        {editable ? (
          <VariantsSection
            product={product}
            sizes={sizes}
            colors={colors}
            storeCurrency={storeCurrency}
          />
        ) : (
          <VariantsTable variants={product.variants} />
        )}
      </section>

      <section id="images" aria-labelledby="images-heading" className="space-y-3">
        <h2 id="images-heading" className="font-semibold">
          Images
        </h2>
        {editable ? (
          <ImagesSection product={product} />
        ) : (
          <ImagesList images={product.images} variants={product.variants} />
        )}
      </section>
    </section>
  );
}
