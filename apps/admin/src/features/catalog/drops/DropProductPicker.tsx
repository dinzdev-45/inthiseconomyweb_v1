'use client';

import { AdminDrop, DropCandidatesResponse, type DropCandidate } from '@ite/contracts';
import { useState, type FormEvent } from 'react';

import { Badge, Button, Input } from '@/components/ui';
import { apiGet, apiSend } from '@/lib/api/client';

import { ErrorSummary } from '../shared/ErrorSummary';
import { textValue } from '../shared/form';
import { StatusBadge } from '../shared/StatusBadge';
import { SuccessMessage } from '../shared/SuccessMessage';
import { useCatalogAction } from '../shared/useCatalogAction';
import {
  addProduct,
  candidateState,
  isChanged,
  moveProduct,
  removeProduct,
  toPicked,
  type PickedProduct,
} from './picker';

/**
 * A drop's products (admin-drops spec: Drop product picker). Staff search products by name, add
 * them, remove them, and move them up or down; "Save products" replaces the drop's products in
 * that order. Products in another drop are shown with that drop's name and cannot be added.
 */
export function DropProductPicker({ drop, canManage }: { drop: AdminDrop; canManage: boolean }) {
  const [selected, setSelected] = useState<PickedProduct[]>(drop.products);
  const [results, setResults] = useState<DropCandidate[] | null>(null);
  const search = useCatalogAction();
  const save = useCatalogAction();
  const changed = isChanged(drop.products, selected);

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = textValue(new FormData(event.currentTarget), 'q');
    if (!q) return search.reject({ q: 'Enter part of a product name.' });
    const found = await search.run(
      () =>
        apiGet(
          `/api/v1/admin/drops/${drop.id}/candidates?q=${encodeURIComponent(q)}`,
          DropCandidatesResponse,
        ),
      { refresh: false },
    );
    if (found) setResults(found.data);
  }

  async function onSave() {
    const saved = await save.run(
      () =>
        apiSend('PUT', `/api/v1/admin/drops/${drop.id}/products`, {
          body: { productIds: selected.map((product) => product.id) },
          schema: AdminDrop,
        }),
      { success: 'Products saved.' },
    );
    if (saved) setSelected(saved.products);
  }

  return (
    <div className="space-y-4">
      {selected.length === 0 ? (
        <p className="text-sm text-muted">No products in this drop yet.</p>
      ) : (
        <ol
          aria-label="Products in this drop"
          className="divide-y divide-line rounded border border-line bg-white"
        >
          {selected.map((product, index) => (
            <li
              key={product.id}
              data-testid={`drop-product-${product.slug}`}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span className="w-6 text-right text-muted tabular-nums">{index + 1}.</span>
                <span className="font-medium">{product.name}</span>
                <StatusBadge status={product.status} />
              </span>
              {canManage ? (
                <span className="inline-flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={index === 0}
                    aria-label={`Move ${product.name} up`}
                    onClick={() => setSelected((list) => moveProduct(list, product.id, -1))}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={index === selected.length - 1}
                    aria-label={`Move ${product.name} down`}
                    onClick={() => setSelected((list) => moveProduct(list, product.id, 1))}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label={`Remove ${product.name}`}
                    onClick={() => setSelected((list) => removeProduct(list, product.id))}
                  >
                    Remove
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {canManage ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={save.busy || !changed}
              aria-busy={save.busy || undefined}
              onClick={onSave}
            >
              Save products
            </Button>
            {changed ? <span className="text-sm text-muted">Unsaved changes</span> : null}
            <SuccessMessage message={save.success} />
          </div>
          <ErrorSummary
            problem={save.problem}
            summaryRef={save.summaryRef}
            title="Could not save the products."
          />

          <form
            role="search"
            aria-label="Find products"
            onSubmit={onSearch}
            noValidate
            className="flex max-w-xl gap-2"
          >
            <label className="sr-only" htmlFor="drop-product-search">
              Product name
            </label>
            <Input
              id="drop-product-search"
              name="q"
              type="search"
              placeholder="Product name"
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={search.busy}
              aria-busy={search.busy || undefined}
            >
              Search
            </Button>
          </form>
          <ErrorSummary problem={search.problem} summaryRef={search.summaryRef} />
          {results ? (
            results.length === 0 ? (
              <p role="status" className="text-sm text-muted">
                No products match.
              </p>
            ) : (
              <ul
                aria-label="Search results"
                className="divide-y divide-line rounded border border-line bg-white"
              >
                {results.map((candidate) => {
                  const state = candidateState(candidate, drop.id, selected);
                  return (
                    <li
                      key={candidate.id}
                      data-testid={`candidate-${candidate.slug}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{candidate.name}</span>
                        <StatusBadge status={candidate.status} />
                      </span>
                      {state.kind === 'available' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          aria-label={`Add ${candidate.name}`}
                          onClick={() =>
                            setSelected((list) => addProduct(list, toPicked(candidate)))
                          }
                        >
                          Add
                        </Button>
                      ) : state.kind === 'selected' ? (
                        <Badge tone="muted">Added</Badge>
                      ) : (
                        <Badge tone="muted">In {state.dropTitle}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </>
      ) : null}
    </div>
  );
}
