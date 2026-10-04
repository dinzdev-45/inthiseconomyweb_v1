'use client';

import { ProductDetail, type ProductStatus } from '@ite/contracts';

import { Button } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ConfirmAction } from '../shared/ConfirmAction';
import type { CatalogAction } from '../shared/useCatalogAction';
import {
  LIFECYCLE_DONE,
  LIFECYCLE_LABEL,
  lifecycleActions,
  needsConfirmation,
  type LifecycleAction,
} from './lifecycle';

/**
 * Lifecycle buttons for one product (admin-products spec). Deactivate and archive ask for
 * confirmation. The status shown changes only after the API confirms (the page refreshes);
 * refusals such as PRODUCT_NOT_READY are shown by the caller's error summary, as sent.
 */
export function LifecycleActions({
  product,
  action,
  onStart,
}: {
  product: { id: string; name: string; status: ProductStatus };
  action: CatalogAction;
  /** Called before a request, e.g. to label a failure with the product and action. */
  onStart?: (action: LifecycleAction) => void;
}) {
  const { run, busy } = action;

  const perform = async (name: LifecycleAction) => {
    onStart?.(name);
    await run(
      () =>
        apiSend('POST', `/api/v1/admin/products/${product.id}/${name}`, { schema: ProductDetail }),
      { success: `“${product.name}” ${LIFECYCLE_DONE[name]}.` },
    );
  };

  return (
    <span className="inline-flex flex-wrap justify-end gap-2">
      {lifecycleActions(product.status).map((name) =>
        needsConfirmation(name) ? (
          <ConfirmAction
            key={name}
            label={`${LIFECYCLE_LABEL[name]} ${product.name}`}
            question={`${LIFECYCLE_LABEL[name]} “${product.name}”?`}
            confirmLabel={`Confirm ${name}`}
            busy={busy}
            onConfirm={() => perform(name)}
          >
            {LIFECYCLE_LABEL[name]}
          </ConfirmAction>
        ) : (
          <Button
            key={name}
            type="button"
            variant="secondary"
            disabled={busy}
            aria-busy={busy || undefined}
            aria-label={`${LIFECYCLE_LABEL[name]} ${product.name}`}
            onClick={() => perform(name)}
          >
            {LIFECYCLE_LABEL[name]}
          </Button>
        ),
      )}
    </span>
  );
}
