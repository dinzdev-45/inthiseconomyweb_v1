import type { ProductStatus } from '@ite/contracts';

/*
 * Which lifecycle actions to offer for a product's status (design D5). This mirrors the
 * published transition table purely as a convenience; the API decides, and whatever it answers
 * (including INVALID_STATE_TRANSITION or PRODUCT_NOT_READY) is what the admin shows.
 */

export type LifecycleAction = 'activate' | 'deactivate' | 'archive' | 'restore';

const ACTIONS: Record<ProductStatus, readonly LifecycleAction[]> = {
  DRAFT: ['activate', 'archive'],
  ACTIVE: ['deactivate'],
  INACTIVE: ['activate', 'archive'],
  ARCHIVED: ['restore'],
};

export function lifecycleActions(status: ProductStatus): readonly LifecycleAction[] {
  return ACTIONS[status];
}

/** Actions that change what customers can see or lose access to: confirmed before sending. */
export function needsConfirmation(action: LifecycleAction): boolean {
  return action === 'deactivate' || action === 'archive';
}

export const LIFECYCLE_LABEL: Record<LifecycleAction, string> = {
  activate: 'Activate',
  deactivate: 'Deactivate',
  archive: 'Archive',
  restore: 'Restore',
};

/** Past tense for success messages, e.g. "activated". */
export const LIFECYCLE_DONE: Record<LifecycleAction, string> = {
  activate: 'activated',
  deactivate: 'deactivated',
  archive: 'archived',
  restore: 'restored',
};
