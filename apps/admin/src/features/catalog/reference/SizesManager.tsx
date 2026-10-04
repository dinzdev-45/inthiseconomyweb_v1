'use client';

import { Size } from '@ite/contracts';
import { Fragment, useState, type FormEvent } from 'react';

import { Button, Field, Input } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ConfirmAction } from '../shared/ConfirmAction';
import { EmptyState } from '../shared/EmptyState';
import { ErrorSummary, fieldError } from '../shared/ErrorSummary';
import { changedFields, numberValue, textValue } from '../shared/form';
import { InlineInput } from '../shared/InlineInput';
import { PageHeader } from '../shared/PageHeader';
import { latestSuccess } from '../shared/success';
import { SuccessMessage } from '../shared/SuccessMessage';
import { useCatalogAction, type CatalogAction } from '../shared/useCatalogAction';

const API = '/api/v1/admin/sizes';
const FIELD_LABELS = { code: 'Code', label: 'Label', sortOrder: 'Sort order' };

/** Sizes page (admin-catalog-reference-data spec): listed in the API's display order. */
export function SizesManager({ sizes, canManage }: { sizes: Size[]; canManage: boolean }) {
  const rows = useCatalogAction();
  const create = useCatalogAction();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Sizes"
        description="Any size code works (S, XL, OS, 28, 30/32, EU-42…). Sort order sets the display order."
      />
      <SuccessMessage message={latestSuccess(rows, create)} />
      <ErrorSummary
        problem={rows.problem}
        summaryRef={rows.summaryRef}
        fieldLabels={FIELD_LABELS}
      />

      {sizes.length === 0 ? (
        <EmptyState
          title="No sizes yet."
          action={canManage ? { href: '#new-size', label: 'Create the first size' } : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Sizes in display order</caption>
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Code
                </th>
                <th scope="col" className="pr-3">
                  Label
                </th>
                <th scope="col" className="pr-3">
                  Sort order
                </th>
                {canManage ? (
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sizes.map((size) => (
                <SizeRow
                  key={size.id}
                  size={size}
                  canManage={canManage}
                  editing={editing === size.id}
                  onEdit={(on) => {
                    // Clear old messages when starting an edit, not when it closes after a save.
                    if (on) rows.clear();
                    setEditing(on ? size.id : null);
                  }}
                  action={rows}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? <CreateSizeForm action={create} /> : null}
    </section>
  );
}

function SizeRow({
  size,
  canManage,
  editing,
  onEdit,
  action,
}: {
  size: Size;
  canManage: boolean;
  editing: boolean;
  onEdit: (on: boolean) => void;
  action: CatalogAction;
}) {
  const { run, busy, problem } = action;
  const formId = `edit-size-${size.id}`;

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const changes = changedFields<Record<string, unknown>>(
      { code: size.code, label: size.label, sortOrder: size.sortOrder },
      {
        // The API normalizes codes (trim, uppercase); compare the same way to skip no-ops.
        code: textValue(form, 'code').toUpperCase(),
        label: textValue(form, 'label'),
        sortOrder: numberValue(form, 'sortOrder'),
      },
    );
    if (Object.keys(changes).length === 0) return onEdit(false);
    const saved = await run(
      () => apiSend('PATCH', `${API}/${size.id}`, { body: changes, schema: Size }),
      { success: (s) => `Size ${s.code} saved.` },
    );
    if (saved) onEdit(false);
  }

  return (
    <tr className="border-b border-line align-top" data-testid={`size-row-${size.code}`}>
      {editing ? (
        <>
          <td className="py-2 pr-3">
            <form id={formId} onSubmit={onSave} noValidate />
            <InlineInput
              form={formId}
              name="code"
              label={`Code for size ${size.code}`}
              defaultValue={size.code}
              error={fieldError(problem, 'code')}
              autoFocus
            />
          </td>
          <td className="py-2 pr-3">
            <InlineInput
              form={formId}
              name="label"
              label={`Label for size ${size.code}`}
              defaultValue={size.label}
              error={fieldError(problem, 'label')}
            />
          </td>
          <td className="py-2 pr-3">
            <InlineInput
              form={formId}
              name="sortOrder"
              inputMode="numeric"
              label={`Sort order for size ${size.code}`}
              defaultValue={String(size.sortOrder)}
              error={fieldError(problem, 'sortOrder')}
            />
          </td>
        </>
      ) : (
        <>
          <td className="py-2 pr-3 font-mono font-medium">{size.code}</td>
          <td className="pr-3">{size.label}</td>
          <td className="pr-3 tabular-nums">{size.sortOrder}</td>
        </>
      )}
      {canManage ? (
        <td className="py-2 text-right">
          <span className="inline-flex flex-wrap justify-end gap-2">
            {/* Keyed so React never turns the clicked Edit button into this submit button
                mid-click (the browser would then submit the edit form straight away). */}
            {editing ? (
              <Fragment key="editing">
                <Button type="submit" form={formId} disabled={busy} aria-busy={busy || undefined}>
                  Save
                </Button>
                <Button type="button" variant="secondary" onClick={() => onEdit(false)}>
                  Cancel
                </Button>
              </Fragment>
            ) : (
              <Fragment key="viewing">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  aria-label={`Edit size ${size.code}`}
                  onClick={() => onEdit(true)}
                >
                  Edit
                </Button>
                <ConfirmAction
                  label={`Delete size ${size.code}`}
                  question={`Delete size ${size.code}?`}
                  confirmLabel="Confirm delete"
                  busy={busy}
                  onConfirm={async () => {
                    await run(() => apiSend('DELETE', `${API}/${size.id}`), {
                      success: `Size ${size.code} deleted.`,
                    });
                  }}
                >
                  Delete
                </ConfirmAction>
              </Fragment>
            )}
          </span>
        </td>
      ) : null}
    </tr>
  );
}

function CreateSizeForm({ action }: { action: CatalogAction }) {
  const { run, busy, problem, summaryRef } = action;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const created = await run(
      () =>
        apiSend('POST', API, {
          body: {
            code: textValue(form, 'code'),
            label: textValue(form, 'label'),
            sortOrder: numberValue(form, 'sortOrder'),
          },
          schema: Size,
        }),
      { success: (s) => `Size ${s.code} created.` },
    );
    if (created) formElement.reset();
  }

  return (
    <form
      id="new-size"
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="new-size-heading"
      className="max-w-md space-y-4 border-t border-line pt-6"
    >
      <h2 id="new-size-heading" className="font-semibold">
        New size
      </h2>
      <ErrorSummary problem={problem} summaryRef={summaryRef} fieldLabels={FIELD_LABELS} />
      <Field label="Code" error={fieldError(problem, 'code')}>
        <Input name="code" required autoComplete="off" placeholder="e.g. XL, 28, 30/32, EU-42" />
      </Field>
      <Field label="Label" error={fieldError(problem, 'label')}>
        <Input name="label" required autoComplete="off" placeholder="e.g. Extra Large, Waist 28" />
      </Field>
      <Field label="Sort order" error={fieldError(problem, 'sortOrder')}>
        <Input name="sortOrder" inputMode="numeric" required autoComplete="off" />
      </Field>
      <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
        Create size
      </Button>
    </form>
  );
}
