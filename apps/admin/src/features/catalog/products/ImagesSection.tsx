'use client';

import {
  PRODUCT_IMAGE_MAX,
  ProductImage,
  ProductImageListResponse,
  type ProductDetail,
} from '@ite/contracts';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ConfirmAction } from '../shared/ConfirmAction';
import { ErrorSummary } from '../shared/ErrorSummary';
import { latestSuccess } from '../shared/success';
import { SuccessMessage } from '../shared/SuccessMessage';
import { useCatalogAction } from '../shared/useCatalogAction';
import { ImageForm } from './ImageForm';
import { ImagesList } from './ImagesList';

type Direction = 'up' | 'down';

/**
 * Image management for staff with catalog:manage on a product that is not archived: make
 * primary, move up or down (the full order is saved; no drag and drop), edit, delete with
 * confirmation, and add. Every change waits for the API and then shows its result.
 */
export function ImagesSection({ product }: { product: ProductDetail }) {
  const rows = useCatalogAction();
  const edit = useCatalogAction();
  const add = useCatalogAction();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<string | null>(null);
  const [refocus, setRefocus] = useState<{
    id: string;
    direction: Direction;
    index: number;
  } | null>(null);
  const moveButtons = useRef(new Map<string, HTMLButtonElement | null>());
  const images = product.images;
  const base = `/api/v1/admin/products/${product.id}/images` as const;

  // After a move, once the refreshed order arrives, put focus back on the moved image's control
  // (the same direction if it can still move that way, otherwise the other one).
  useEffect(() => {
    if (!refocus || images[refocus.index]?.id !== refocus.id) return;
    const atEdge =
      refocus.direction === 'up' ? refocus.index === 0 : refocus.index === images.length - 1;
    const direction = atEdge ? (refocus.direction === 'up' ? 'down' : 'up') : refocus.direction;
    moveButtons.current.get(`${refocus.id}:${direction}`)?.focus();
    setRefocus(null);
  }, [images, refocus]);

  const move = async (index: number, direction: Direction) => {
    const target = direction === 'up' ? index - 1 : index + 1;
    const order = images.map((image) => image.id);
    [order[index], order[target]] = [order[target]!, order[index]!];
    setAttempt(`Could not move image ${index + 1}.`);
    const saved = await rows.run(
      () =>
        apiSend('PUT', `${base}/order`, {
          body: { imageIds: order },
          schema: ProductImageListResponse,
        }),
      { success: `Image moved to position ${target + 1}.` },
    );
    if (saved) setRefocus({ id: images[index]!.id, direction, index: target });
  };

  const moveButton = (image: ProductImage, index: number, direction: Direction) => {
    const disabled = direction === 'up' ? index === 0 : index === images.length - 1;
    return (
      <Button
        type="button"
        variant="secondary"
        ref={(element) => {
          moveButtons.current.set(`${image.id}:${direction}`, element);
        }}
        disabled={disabled || rows.busy}
        aria-busy={rows.busy || undefined}
        aria-label={`Move image ${index + 1} ${direction}`}
        onClick={() => move(index, direction)}
      >
        {direction === 'up' ? 'Move up' : 'Move down'}
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {images.length} of {PRODUCT_IMAGE_MAX} images. The primary image is shown first in listings.
      </p>
      <SuccessMessage message={latestSuccess(rows, edit, add)} />
      <ErrorSummary
        problem={rows.problem}
        summaryRef={rows.summaryRef}
        title={attempt ?? undefined}
      />

      <ImagesList
        images={images}
        variants={product.variants}
        actions={(image, index) => (
          <>
            {image.isPrimary ? null : (
              <Button
                type="button"
                variant="secondary"
                disabled={rows.busy}
                aria-busy={rows.busy || undefined}
                aria-label={`Make image ${index + 1} primary`}
                onClick={() => {
                  setAttempt(`Could not make image ${index + 1} primary.`);
                  void rows.run(
                    () =>
                      apiSend('PATCH', `${base}/${image.id}`, {
                        body: { isPrimary: true },
                        schema: ProductImage,
                      }),
                    { success: `Image ${index + 1} is now the primary image.` },
                  );
                }}
              >
                Make primary
              </Button>
            )}
            {moveButton(image, index, 'up')}
            {moveButton(image, index, 'down')}
            <Button
              type="button"
              variant="secondary"
              aria-label={`Edit image ${index + 1}`}
              aria-expanded={editingId === image.id}
              onClick={() => {
                edit.clear();
                setEditingId(editingId === image.id ? null : image.id);
              }}
            >
              Edit
            </Button>
            <ConfirmAction
              label={`Delete image ${index + 1}`}
              question={`Delete image ${index + 1}${image.isPrimary ? ' (the primary image)' : ''}?`}
              confirmLabel="Confirm delete"
              busy={rows.busy}
              onConfirm={async () => {
                setAttempt(`Could not delete image ${index + 1}.`);
                await rows.run(() => apiSend('DELETE', `${base}/${image.id}`), {
                  success: image.isPrimary
                    ? 'Image deleted. The next image is now the primary image.'
                    : 'Image deleted.',
                });
              }}
            >
              Delete
            </ConfirmAction>
          </>
        )}
        panel={(image) =>
          editingId === image.id ? (
            <ImageForm
              productId={product.id}
              variants={product.variants}
              action={edit}
              image={image}
              onDone={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          ) : null
        }
      />

      <ImageForm productId={product.id} variants={product.variants} action={add} />
    </div>
  );
}
