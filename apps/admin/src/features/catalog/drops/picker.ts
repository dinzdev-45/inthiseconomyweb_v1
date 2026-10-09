import { DROP_PRODUCT_MAX, type AdminDropProduct, type DropCandidate } from '@ite/contracts';

/*
 * The drop product picker's list logic (admin-drops spec: Drop product picker). The selection
 * is kept in the browser until "Save products" replaces the drop's products in one request; the
 * API still refuses products that belong to another drop.
 */

export type PickedProduct = AdminDropProduct;

export type CandidateState =
  | { kind: 'available' }
  | { kind: 'selected' }
  /** In another drop: not offered for adding. */
  | { kind: 'taken'; dropTitle: string };

/** Whether a search result can be added to this drop's selection. */
export function candidateState(
  candidate: DropCandidate,
  dropId: string,
  selected: readonly PickedProduct[],
): CandidateState {
  if (selected.some((product) => product.id === candidate.id)) return { kind: 'selected' };
  if (candidate.drop && candidate.drop.id !== dropId) {
    return { kind: 'taken', dropTitle: candidate.drop.title };
  }
  return { kind: 'available' };
}

/** The selection with `product` added at the end (unchanged if present or full). */
export function addProduct(
  selected: readonly PickedProduct[],
  product: PickedProduct,
): PickedProduct[] {
  if (selected.some((p) => p.id === product.id) || selected.length >= DROP_PRODUCT_MAX) {
    return [...selected];
  }
  return [...selected, product];
}

export function removeProduct(selected: readonly PickedProduct[], id: string): PickedProduct[] {
  return selected.filter((product) => product.id !== id);
}

/** The selection with product `id` moved one place up (-1) or down (1), if it can move. */
export function moveProduct(
  selected: readonly PickedProduct[],
  id: string,
  by: -1 | 1,
): PickedProduct[] {
  const from = selected.findIndex((product) => product.id === id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= selected.length) return [...selected];
  const next = [...selected];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/** Whether the selection differs from the saved products (ids and order). */
export function isChanged(saved: readonly PickedProduct[], selected: readonly PickedProduct[]) {
  return saved.map((p) => p.id).join() !== selected.map((p) => p.id).join();
}

/** A candidate as a picked product (without the drop it belongs to). */
export function toPicked({ drop: _drop, ...product }: DropCandidate): PickedProduct {
  return product;
}
