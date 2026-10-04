'use client';

import { ProductVariant, type Color, type Size } from '@ite/contracts';
import type { FormEvent } from 'react';

import { Button, Field, Input, Select } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ErrorSummary, fieldError } from '../shared/ErrorSummary';
import { numberValue, textValue } from '../shared/form';
import { readOptionalPrice } from '../shared/money-input';
import { PriceInput } from '../shared/PriceInput';
import type { CatalogAction } from '../shared/useCatalogAction';

const FIELD_LABELS = {
  sizeId: 'Size',
  colorId: 'Color',
  sku: 'SKU',
  'priceOverride.amount': 'Price override',
  priceOverride: 'Price override',
  stockQuantity: 'Initial stock',
};

type Props = {
  productId: string;
  sizes: Size[];
  colors: Color[];
  storeCurrency: string;
  action: CatalogAction;
  /** The variant being edited; absent when adding. */
  variant?: ProductVariant;
  /** The product has been activated before: the API locks existing SKUs. */
  skuLocked?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
};

/**
 * Add or edit a variant (admin-products spec: Variant management). Adding takes an optional
 * initial stock; editing never offers a stock field (stock changes only through adjustments).
 * Uniqueness and SKU rules are the API's; its answers are shown at the related field.
 */
export function VariantForm({
  productId,
  sizes,
  colors,
  storeCurrency,
  action,
  variant,
  skuLocked = false,
  onDone,
  onCancel,
}: Props) {
  const { run, reject, busy, problem, summaryRef } = action;
  const editing = variant !== undefined;
  const lockSku = editing && skuLocked;
  const id = editing ? `variant-${variant.id}` : 'new-variant';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const override = readOptionalPrice(textValue(form, 'priceOverride'), storeCurrency);
    if (!override.ok) return reject({ 'priceOverride.amount': override.message });

    const sizeId = textValue(form, 'sizeId');
    const colorId = textValue(form, 'colorId');
    const sku = textValue(form, 'sku');
    const base = `/api/v1/admin/products/${productId}/variants` as const;

    if (!editing) {
      const stockQuantity = numberValue(form, 'stockQuantity');
      const added = await run(
        () =>
          apiSend('POST', base, {
            body: {
              sizeId,
              colorId,
              sku,
              ...(override.price ? { priceOverride: override.price } : {}),
              ...(stockQuantity !== undefined ? { stockQuantity } : {}),
            },
            schema: ProductVariant,
          }),
        { success: (v) => `Variant ${v.sku} added.` },
      );
      if (added) {
        formElement.reset();
        onDone?.();
      }
      return;
    }

    const changes: Record<string, unknown> = {};
    if (sizeId !== variant.size.id) changes.sizeId = sizeId;
    if (colorId !== variant.color.id) changes.colorId = colorId;
    // The API uppercases SKUs; compare the same way to skip a no-op.
    if (!lockSku && sku.toUpperCase() !== variant.sku) changes.sku = sku;
    if ((override.price?.amount ?? null) !== (variant.priceOverride?.amount ?? null)) {
      changes.priceOverride = override.price;
    }
    if (Object.keys(changes).length === 0) return onDone?.();
    const saved = await run(
      () => apiSend('PATCH', `${base}/${variant.id}`, { body: changes, schema: ProductVariant }),
      { success: (v) => `Variant ${v.sku} saved.` },
    );
    if (saved) onDone?.();
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={`${id}-heading`}
      className="max-w-2xl space-y-4 rounded border border-line bg-white p-4"
    >
      <h3 id={`${id}-heading`} className="font-semibold">
        {editing ? `Edit variant ${variant.sku}` : 'Add a variant'}
      </h3>
      <ErrorSummary problem={problem} summaryRef={summaryRef} fieldLabels={FIELD_LABELS} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Size" error={fieldError(problem, 'sizeId')}>
          <Select name="sizeId" required defaultValue={variant?.size.id ?? ''} autoFocus={editing}>
            {editing ? null : (
              <option value="" disabled>
                Choose a size
              </option>
            )}
            {sizes.map((size) => (
              <option key={size.id} value={size.id}>
                {size.code} · {size.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Color" error={fieldError(problem, 'colorId')}>
          <Select name="colorId" required defaultValue={variant?.color.id ?? ''}>
            {editing ? null : (
              <option value="" disabled>
                Choose a color
              </option>
            )}
            {colors.map((color) => (
              <option key={color.id} value={color.id}>
                {color.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {lockSku ? (
        <div className="space-y-1 text-sm" data-testid="sku-locked">
          <span className="block font-medium">SKU</span>
          <span className="block font-mono">{variant.sku}</span>
          <span className="block text-muted">
            Locked: SKUs cannot change after the product has been activated.
          </span>
          {fieldError(problem, 'sku') ? (
            <span className="block text-danger">{fieldError(problem, 'sku')}</span>
          ) : null}
        </div>
      ) : (
        <Field label="SKU" error={fieldError(problem, 'sku')}>
          <Input
            name="sku"
            required
            autoComplete="off"
            defaultValue={variant?.sku ?? ''}
            placeholder="e.g. ITE-OH-WB-M"
          />
        </Field>
      )}

      <PriceInput
        name="priceOverride"
        label="Price override"
        storeCurrency={storeCurrency}
        defaultValue={variant?.priceOverride ?? null}
        error={fieldError(problem, 'priceOverride.amount') ?? fieldError(problem, 'priceOverride')}
        hint="Optional. Leave empty to use the product's base price. Digits only, for example 949000."
      />

      {editing ? null : (
        <Field label="Initial stock (optional)" error={fieldError(problem, 'stockQuantity')}>
          <Input name="stockQuantity" inputMode="numeric" autoComplete="off" placeholder="0" />
        </Field>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
          {editing ? 'Save variant' : 'Add variant'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
