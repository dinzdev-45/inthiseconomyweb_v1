'use client';

import { ProductVariant, type Color, type ProductDetail, type Size } from '@ite/contracts';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ErrorSummary } from '../shared/ErrorSummary';
import { latestSuccess } from '../shared/success';
import { SuccessMessage } from '../shared/SuccessMessage';
import { useCatalogAction } from '../shared/useCatalogAction';
import { StockAdjuster } from './StockAdjuster';
import { VariantForm } from './VariantForm';
import { VariantsTable } from './VariantsTable';

/**
 * Variant management for staff with catalog:manage on a product that is not archived: the
 * shared variants table with a stock adjuster and row actions, an edit form for one variant,
 * and the add form. Every change waits for the API, then the page refreshes.
 */
export function VariantsSection({
  product,
  sizes,
  colors,
  storeCurrency,
}: {
  product: ProductDetail;
  sizes: Size[];
  colors: Color[];
  storeCurrency: string;
}) {
  const rows = useCatalogAction();
  const edit = useCatalogAction();
  const add = useCatalogAction();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<string | null>(null);
  const editing = product.variants.find((variant) => variant.id === editingId);
  const skuLocked = product.activatedAt !== null;

  const setStatus = (variant: ProductVariant, to: 'activate' | 'deactivate') => {
    setAttempt(`Could not ${to} variant ${variant.sku}.`);
    return rows.run(
      () =>
        apiSend('POST', `/api/v1/admin/products/${product.id}/variants/${variant.id}/${to}`, {
          schema: ProductVariant,
        }),
      { success: (v) => `Variant ${v.sku} ${to}d.` },
    );
  };

  return (
    <div className="space-y-4">
      <SuccessMessage message={latestSuccess(rows, edit, add)} />
      <ErrorSummary
        problem={rows.problem}
        summaryRef={rows.summaryRef}
        title={attempt ?? undefined}
      />

      <VariantsTable
        variants={product.variants}
        stock={(variant) => <StockAdjuster productId={product.id} variant={variant} />}
        actions={(variant) => (
          <span className="inline-flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              aria-label={`Edit variant ${variant.sku}`}
              onClick={() => {
                edit.clear();
                setEditingId(variant.id);
              }}
            >
              Edit
            </Button>
            {variant.status === 'ACTIVE' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={rows.busy}
                aria-busy={rows.busy || undefined}
                aria-label={`Deactivate variant ${variant.sku}`}
                onClick={() => setStatus(variant, 'deactivate')}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={rows.busy}
                aria-busy={rows.busy || undefined}
                aria-label={`Activate variant ${variant.sku}`}
                onClick={() => setStatus(variant, 'activate')}
              >
                Activate
              </Button>
            )}
          </span>
        )}
      />

      {editing ? (
        <VariantForm
          key={editing.id}
          productId={product.id}
          sizes={sizes}
          colors={colors}
          storeCurrency={storeCurrency}
          action={edit}
          variant={editing}
          skuLocked={skuLocked}
          onDone={() => setEditingId(null)}
          onCancel={() => setEditingId(null)}
        />
      ) : null}

      {sizes.length === 0 || colors.length === 0 ? (
        <p className="text-sm text-muted">
          Variants need a size and a color. Add them on the{' '}
          <Link href="/catalog/sizes" className="underline">
            sizes
          </Link>{' '}
          and{' '}
          <Link href="/catalog/colors" className="underline">
            colors
          </Link>{' '}
          pages first.
        </p>
      ) : (
        <VariantForm
          productId={product.id}
          sizes={sizes}
          colors={colors}
          storeCurrency={storeCurrency}
          action={add}
        />
      )}
    </div>
  );
}
