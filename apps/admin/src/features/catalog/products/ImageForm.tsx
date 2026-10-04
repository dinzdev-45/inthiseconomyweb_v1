'use client';

import { ProductImage, type ProductVariant } from '@ite/contracts';
import type { FormEvent } from 'react';

import { Button, Field, Input, Select } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ErrorSummary, fieldError } from '../shared/ErrorSummary';
import { textValue } from '../shared/form';
import type { CatalogAction } from '../shared/useCatalogAction';

const FIELD_LABELS = { url: 'Image URL or path', alt: 'Alt text', variantId: 'Variant' };

type Props = {
  productId: string;
  variants: ProductVariant[];
  action: CatalogAction;
  /** The image being edited; absent when adding. */
  image?: ProductImage;
  onDone?: () => void;
  onCancel?: () => void;
};

/**
 * Add or edit image metadata (admin-products spec: Image metadata management). Only a URL or
 * root-relative path is stored; nothing is uploaded. The variant list is this product's own
 * variants; the API checks ownership, the image limit, and the primary rules.
 */
export function ImageForm({ productId, variants, action, image, onDone, onCancel }: Props) {
  const { run, busy, problem, summaryRef } = action;
  const editing = image !== undefined;
  const id = editing ? `image-form-${image.id}` : 'new-image';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const url = textValue(form, 'url');
    const alt = textValue(form, 'alt');
    const variantId = textValue(form, 'variantId') || null;
    const base = `/api/v1/admin/products/${productId}/images` as const;

    if (!editing) {
      const added = await run(
        () =>
          apiSend('POST', base, {
            body: {
              url,
              alt,
              ...(variantId ? { variantId } : {}),
              ...(form.get('isPrimary') === 'on' ? { isPrimary: true } : {}),
            },
            schema: ProductImage,
          }),
        { success: (i) => (i.isPrimary ? 'Image added as the primary image.' : 'Image added.') },
      );
      if (added) {
        formElement.reset();
        onDone?.();
      }
      return;
    }

    const changes: Record<string, unknown> = {};
    if (url !== image.url) changes.url = url;
    if (alt !== image.alt) changes.alt = alt;
    if (variantId !== image.variantId) changes.variantId = variantId;
    if (Object.keys(changes).length === 0) return onDone?.();
    const saved = await run(
      () => apiSend('PATCH', `${base}/${image.id}`, { body: changes, schema: ProductImage }),
      { success: 'Image saved.' },
    );
    if (saved) onDone?.();
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={`${id}-heading`}
      className="max-w-2xl space-y-3 rounded border border-line bg-white p-4"
    >
      <h3 id={`${id}-heading`} className="font-semibold">
        {editing ? 'Edit image' : 'Add an image'}
      </h3>
      <ErrorSummary problem={problem} summaryRef={summaryRef} fieldLabels={FIELD_LABELS} />
      <Field label="Image URL or path" error={fieldError(problem, 'url')}>
        <Input
          name="url"
          required
          autoComplete="off"
          autoFocus={editing}
          defaultValue={image?.url ?? ''}
          placeholder="https://… or /images/…"
        />
      </Field>
      <Field label="Alt text" error={fieldError(problem, 'alt')}>
        <Input
          name="alt"
          required
          autoComplete="off"
          defaultValue={image?.alt ?? ''}
          placeholder="Describe the image, e.g. Front view, washed black"
        />
      </Field>
      <Field label="Variant (optional)" error={fieldError(problem, 'variantId')}>
        <Select name="variantId" defaultValue={image?.variantId ?? ''}>
          <option value="">All variants</option>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.sku} · {variant.size.code} · {variant.color.name}
            </option>
          ))}
        </Select>
      </Field>
      {editing ? null : (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isPrimary" className="h-4 w-4" />
          Make this the primary image (the first image always is)
        </label>
      )}
      <p className="text-xs text-muted">
        Images are not uploaded here: enter where the file already lives.
      </p>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
          {editing ? 'Save image' : 'Add image'}
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
