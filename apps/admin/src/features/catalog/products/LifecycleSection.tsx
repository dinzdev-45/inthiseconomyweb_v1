'use client';

import type { ProductDetail } from '@ite/contracts';
import { useState, type Ref } from 'react';

import { ErrorSummary } from '../shared/ErrorSummary';
import type { CatalogProblem } from '../shared/problem';
import { StatusBadge } from '../shared/StatusBadge';
import { SuccessMessage } from '../shared/SuccessMessage';
import { formatTimestamp } from '../shared/time';
import { useCatalogAction } from '../shared/useCatalogAction';
import { LIFECYCLE_LABEL, type LifecycleAction } from './lifecycle';
import { LifecycleActions } from './LifecycleActions';
import { readinessReasons } from './readiness';

/**
 * The product's lifecycle (admin-products spec): status as text, first activation and last
 * update, and the actions its status allows. A PRODUCT_NOT_READY refusal is shown next to the
 * actions with the API's reasons and links to the sections that fix them.
 */
export function LifecycleSection({
  product,
  canManage,
}: {
  product: ProductDetail;
  canManage: boolean;
}) {
  const action = useCatalogAction();
  const [attempt, setAttempt] = useState<LifecycleAction | null>(null);
  const notReady = action.problem?.code === 'PRODUCT_NOT_READY' ? action.problem : null;

  return (
    <section
      aria-labelledby="lifecycle-heading"
      className="space-y-3 rounded border border-line bg-white p-4"
    >
      <h2 id="lifecycle-heading" className="font-semibold">
        Lifecycle
      </h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted">Status</dt>
        <dd data-testid="product-status">
          <StatusBadge status={product.status} />
        </dd>
        <dt className="text-muted">First activated</dt>
        <dd data-testid="product-activated-at">
          {product.activatedAt ? formatTimestamp(product.activatedAt) : 'Never'}
        </dd>
        <dt className="text-muted">Last updated</dt>
        <dd data-testid="product-updated-at">{formatTimestamp(product.updatedAt)}</dd>
      </dl>

      {canManage ? (
        <div className="space-y-3">
          <LifecycleActions product={product} action={action} onStart={setAttempt} />
          <SuccessMessage message={action.success} />
          {notReady ? (
            <NotReady problem={notReady} summaryRef={action.summaryRef} />
          ) : (
            <ErrorSummary
              problem={action.problem}
              summaryRef={action.summaryRef}
              title={
                attempt
                  ? `Could not ${LIFECYCLE_LABEL[attempt].toLowerCase()} the product.`
                  : undefined
              }
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

/** The API's readiness reasons, as a list when its text allows, with links to fix them. */
function NotReady({
  problem,
  summaryRef,
}: {
  problem: CatalogProblem;
  summaryRef: Ref<HTMLDivElement>;
}) {
  const parsed = readinessReasons(problem.message);
  return (
    <div
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
      data-problem-kind="not-ready"
      className="space-y-2 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger outline-none focus:ring-2 focus:ring-danger/40"
    >
      <p className="font-medium">Could not activate the product.</p>
      {parsed ? (
        <>
          <p>{parsed.lead}</p>
          <ul className="list-inside list-disc">
            {parsed.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>{problem.message}</p>
      )}
      <p className="text-ink">
        Review:{' '}
        <a href="#details" className="underline">
          category
        </a>{' '}
        ·{' '}
        <a href="#variants" className="underline">
          variants
        </a>{' '}
        ·{' '}
        <a href="#images" className="underline">
          images
        </a>
      </p>
    </div>
  );
}
