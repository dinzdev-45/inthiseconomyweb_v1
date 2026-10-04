import type { ProductImage, ProductVariant } from '@ite/contracts';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui';

import { EmptyState } from '../shared/EmptyState';
import { ProductThumbnail } from './ProductThumbnail';

/**
 * The product's images in display order, with the position and the primary image labelled in
 * text. Read-only by default; the image manager passes `actions` (controls for one image) and
 * `panel` (e.g. its edit form) so both views share one list.
 */
export function ImagesList({
  images,
  variants,
  actions,
  panel,
}: {
  images: ProductImage[];
  variants: ProductVariant[];
  actions?: (image: ProductImage, index: number) => ReactNode;
  panel?: (image: ProductImage, index: number) => ReactNode;
}) {
  if (images.length === 0) return <EmptyState title="No images yet." />;
  const skuFor = (id: string | null) => variants.find((v) => v.id === id)?.sku;
  return (
    <ol className="space-y-2" aria-label="Images in display order">
      {images.map((image, index) => (
        <li
          key={image.id}
          className="space-y-2 rounded border border-line bg-white p-2 text-sm"
          data-testid={`image-${image.id}`}
        >
          <div className="flex flex-wrap items-start gap-3">
            <span
              className="w-6 pt-1 text-right font-medium text-muted tabular-nums"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <ProductThumbnail image={image} />
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="sr-only">Image {index + 1}: </span>
              <span className="block break-all font-mono text-xs">{image.url}</span>
              <span className="block" data-testid="image-alt">
                {image.alt}
              </span>
              <span className="block text-xs text-muted">
                {image.variantId ? `Variant ${skuFor(image.variantId)}` : 'All variants'}
              </span>
            </span>
            {image.isPrimary ? <Badge tone="strong">Primary</Badge> : null}
            {actions ? (
              <span className="flex basis-full flex-wrap justify-end gap-2 sm:basis-auto">
                {actions(image, index)}
              </span>
            ) : null}
          </div>
          {panel ? panel(image, index) : null}
        </li>
      ))}
    </ol>
  );
}
