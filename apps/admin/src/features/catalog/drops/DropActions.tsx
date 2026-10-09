'use client';

import { AdminDrop } from '@ite/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiSend } from '@/lib/api/client';

import { ConfirmAction } from '../shared/ConfirmAction';
import { ErrorSummary } from '../shared/ErrorSummary';
import { StatusBadge } from '../shared/StatusBadge';
import { SuccessMessage } from '../shared/SuccessMessage';
import { useCatalogAction } from '../shared/useCatalogAction';
import { formatWib } from './release-time';

type Action = 'publish' | 'unpublish' | 'delete';
const LABEL: Record<Action, string> = {
  publish: 'Publish',
  unpublish: 'Unpublish',
  delete: 'Delete',
};

/** "an image" → "An image". */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A drop's status and its actions (admin-drops spec: Drop actions): Publish for a draft,
 * Unpublish for a published drop, and Delete for a draft, each confirmed first. A refused
 * publish lists what the drop still needs, as the API names it.
 */
export function DropActions({ drop, canManage }: { drop: AdminDrop; canManage: boolean }) {
  const router = useRouter();
  const action = useCatalogAction();
  const [attempt, setAttempt] = useState<Action | null>(null);
  const notReady = action.problem?.code === 'DROP_NOT_READY' ? action.problem : null;
  const actions: Action[] = drop.status === 'DRAFT' ? ['publish', 'delete'] : ['unpublish'];

  async function perform(name: Action) {
    setAttempt(name);
    if (name === 'delete') {
      const deleted = await action.run(
        async () => {
          await apiSend('DELETE', `/api/v1/admin/drops/${drop.id}`);
          return true;
        },
        { refresh: false },
      );
      if (deleted) router.push('/catalog/drops');
      return;
    }
    await action.run(
      () => apiSend('POST', `/api/v1/admin/drops/${drop.id}/${name}`, { schema: AdminDrop }),
      { success: `“${drop.title}” ${name === 'publish' ? 'published' : 'unpublished'}.` },
    );
  }

  return (
    <section
      aria-labelledby="release-heading"
      className="space-y-3 rounded border border-line bg-white p-4"
    >
      <h2 id="release-heading" className="font-semibold">
        Release
      </h2>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-muted">Status</dt>
        <dd data-testid="drop-status">
          <StatusBadge status={drop.status} />
        </dd>
        <dt className="text-muted">Release</dt>
        <dd data-testid="drop-release">{formatWib(drop.releaseAt)}</dd>
      </dl>
      {canManage ? (
        <div className="space-y-3">
          <span className="inline-flex flex-wrap gap-2">
            {actions.map((name) => (
              <ConfirmAction
                key={name}
                label={`${LABEL[name]} ${drop.title}`}
                question={`${LABEL[name]} “${drop.title}”?`}
                confirmLabel={`Confirm ${name}`}
                busy={action.busy}
                onConfirm={() => perform(name)}
              >
                {LABEL[name]}
              </ConfirmAction>
            ))}
          </span>
          <SuccessMessage message={action.success} />
          {notReady ? (
            <div
              ref={action.summaryRef}
              role="alert"
              tabIndex={-1}
              data-problem-kind="not-ready"
              className="space-y-1 rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger outline-none focus:ring-2 focus:ring-danger/40"
            >
              <p className="font-medium">Could not publish the drop. Publishing needs:</p>
              <ul className="list-inside list-disc">
                {(notReady.items ?? [notReady.message]).map((item) => (
                  <li key={item}>{sentence(item)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <ErrorSummary
              problem={action.problem}
              summaryRef={action.summaryRef}
              title={attempt ? `Could not ${LABEL[attempt].toLowerCase()} the drop.` : undefined}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
