'use client';

import { StockAdjustmentResult, type ProductVariant } from '@ite/contracts';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ErrorSummary, fieldError } from '../shared/ErrorSummary';
import { useCatalogAction } from '../shared/useCatalogAction';
import { describeDelta, parseStockDelta } from './stock-delta';

/**
 * Current stock and a delta adjustment for one variant (admin-products spec: Stock adjustments).
 * There is no way to set an absolute quantity: "+5" adds, "-3" removes. The shown stock changes
 * only after the API returns the new quantity; INSUFFICIENT_STOCK is explained here, in the row.
 */
export function StockAdjuster({
  productId,
  variant,
}: {
  productId: string;
  variant: ProductVariant;
}) {
  const action = useCatalogAction();
  const { run, reject, busy, problem, success, summaryRef } = action;
  const [text, setText] = useState('');
  const preview = parseStockDelta(text);
  const inputId = `delta-${variant.id}`;
  const intentId = `${inputId}-intent`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reading = parseStockDelta(text);
    if (!reading.ok) return reject({ delta: reading.message });
    const result = await run(
      () =>
        apiSend(
          'POST',
          `/api/v1/admin/products/${productId}/variants/${variant.id}/stock-adjustments`,
          { body: { delta: reading.delta }, schema: StockAdjustmentResult },
        ),
      { success: (r) => `Stock for ${variant.sku} is now ${r.stockQuantity}.` },
    );
    if (result) setText('');
  }

  const error = fieldError(problem, 'delta');
  return (
    <div className="min-w-48 space-y-1">
      <p>
        <span className="font-medium tabular-nums" data-testid="stock-quantity">
          {variant.stockQuantity}
        </span>{' '}
        in stock
      </p>
      <form
        onSubmit={onSubmit}
        noValidate
        aria-label={`Adjust stock for ${variant.sku}`}
        className="flex items-center gap-1"
      >
        <input
          id={inputId}
          name="delta"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="+5 or -3"
          aria-label={`Stock change for ${variant.sku}`}
          aria-describedby={intentId}
          aria-invalid={error ? true : undefined}
          className="w-24 rounded border border-line bg-white px-2 py-1 outline-none focus:border-ink"
        />
        <Button type="submit" variant="secondary" disabled={busy} aria-busy={busy || undefined}>
          Apply
        </Button>
      </form>
      <p id={intentId} className="text-xs text-muted">
        {preview.ok ? describeDelta(preview.delta) : 'Positive adds stock, negative removes it.'}
      </p>
      <p role="status" aria-live="polite" className="text-xs">
        {success ?? ''}
      </p>
      {problem && problem.kind !== 'validation' ? (
        <ErrorSummary problem={problem} summaryRef={summaryRef} />
      ) : error ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="text-xs text-danger outline-none"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
