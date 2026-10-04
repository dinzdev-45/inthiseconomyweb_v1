import type { ProductDetail } from '@ite/contracts';

import { MoneyText } from '../shared/MoneyText';

/** Product details as read-only text (staff without catalog:manage, or an archived product). */
export function ProductSummary({ product }: { product: ProductDetail }) {
  return (
    <dl className="grid max-w-2xl grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted">Name</dt>
      <dd>{product.name}</dd>
      <dt className="text-muted">Slug</dt>
      <dd className="font-mono">
        {product.slug}
        {product.activatedAt ? (
          <span className="ml-2 font-sans text-xs text-muted">(locked)</span>
        ) : null}
      </dd>
      <dt className="text-muted">Description</dt>
      <dd className="whitespace-pre-line">
        {product.description ?? <span className="text-muted">None</span>}
      </dd>
      <dt className="text-muted">Category</dt>
      <dd>
        {product.category.name}
        {product.category.status === 'ARCHIVED' ? (
          <span className="ml-2 text-xs text-muted">(archived)</span>
        ) : null}
      </dd>
      <dt className="text-muted">Base price</dt>
      <dd>
        <MoneyText value={product.basePrice} />{' '}
        <span className="text-xs text-muted">{product.basePrice.currency}</span>
      </dd>
    </dl>
  );
}
