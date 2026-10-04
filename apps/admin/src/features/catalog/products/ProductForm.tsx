'use client';

import { ProductDetail, type Category } from '@ite/contracts';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';

import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ErrorSummary, fieldError } from '../shared/ErrorSummary';
import { changedFields, textValue } from '../shared/form';
import { readPrice } from '../shared/money-input';
import { PriceInput } from '../shared/PriceInput';
import { SuccessMessage } from '../shared/SuccessMessage';
import { useCatalogAction } from '../shared/useCatalogAction';

const API = '/api/v1/admin/products';
const FIELD_LABELS = {
  name: 'Name',
  slug: 'Slug',
  description: 'Description',
  categoryId: 'Category',
  'basePrice.amount': 'Base price',
  basePrice: 'Base price',
};

type Props = {
  categories: Category[];
  /** From the API's catalog settings; prices are always sent in it. */
  storeCurrency: string;
  /** The product being edited; absent when creating. */
  product?: ProductDetail;
};

/**
 * Product create and edit form (admin-products spec). The API decides every rule: the form only
 * reads the price text into minor units and, when editing, sends just the changed fields.
 */
export function ProductForm({ categories, storeCurrency, product }: Props) {
  const router = useRouter();
  const action = useCatalogAction();
  const { run, reject, busy, problem, success, summaryRef } = action;
  const editing = product !== undefined;
  /** The API locks the slug once the product has been activated; mirror that in the form. */
  const slugLocked = product?.activatedAt != null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = readPrice(textValue(form, 'basePrice'), storeCurrency);
    if (!price.ok) return reject({ 'basePrice.amount': price.message });

    const description = textValue(form, 'description');
    const slug = textValue(form, 'slug');
    const fields = {
      name: textValue(form, 'name'),
      categoryId: textValue(form, 'categoryId'),
      description: description === '' ? null : description,
    };

    if (!editing) {
      const created = await run(
        () =>
          apiSend('POST', API, {
            body: { ...fields, ...(slug ? { slug } : {}), basePrice: price.price },
            schema: ProductDetail,
          }),
        { refresh: false },
      );
      if (created) router.push(`/catalog/products/${created.id}?created=1`);
      return;
    }

    const changes: Record<string, unknown> = changedFields<Record<string, unknown>>(
      { name: product.name, categoryId: product.category.id, description: product.description },
      fields,
    );
    if (!slugLocked && slug !== product.slug) changes.slug = slug;
    if (price.price.amount !== product.basePrice.amount) changes.basePrice = price.price;
    if (Object.keys(changes).length === 0) {
      action.clear();
      return;
    }
    await run(
      () => apiSend('PATCH', `${API}/${product.id}`, { body: changes, schema: ProductDetail }),
      { success: 'Product details saved.' },
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={editing ? 'Product details' : 'New product'}
      className="max-w-2xl space-y-4"
    >
      <ErrorSummary problem={problem} summaryRef={summaryRef} fieldLabels={FIELD_LABELS} />
      <Field label="Name" error={fieldError(problem, 'name')}>
        <Input name="name" required autoComplete="off" defaultValue={product?.name ?? ''} />
      </Field>

      {slugLocked ? (
        <div className="space-y-1 text-sm" data-testid="slug-locked">
          <span className="block font-medium">Slug</span>
          <span className="block font-mono">{product.slug}</span>
          <span className="block text-muted">
            Locked: the slug cannot change after the product has been activated, so storefront links
            stay stable.
          </span>
          {fieldError(problem, 'slug') ? (
            <span className="block text-danger">{fieldError(problem, 'slug')}</span>
          ) : null}
        </div>
      ) : (
        <Field
          label={editing ? 'Slug' : 'Slug (optional; generated from the name)'}
          error={fieldError(problem, 'slug')}
        >
          <Input name="slug" autoComplete="off" defaultValue={product?.slug ?? ''} />
        </Field>
      )}

      <Field label="Description (optional)" error={fieldError(problem, 'description')}>
        <Textarea name="description" defaultValue={product?.description ?? ''} />
      </Field>

      <Field label="Category" error={fieldError(problem, 'categoryId')}>
        <Select name="categoryId" required defaultValue={product?.category.id ?? ''}>
          {editing ? null : (
            <option value="" disabled>
              Choose a category
            </option>
          )}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.status === 'ARCHIVED' ? `${category.name} (archived)` : category.name}
            </option>
          ))}
        </Select>
      </Field>

      <PriceInput
        name="basePrice"
        label="Base price"
        storeCurrency={storeCurrency}
        defaultValue={product?.basePrice}
        error={fieldError(problem, 'basePrice.amount') ?? fieldError(problem, 'basePrice')}
        required
      />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
          {editing ? 'Save details' : 'Create product'}
        </Button>
        <SuccessMessage message={success} />
      </div>
    </form>
  );
}
