'use client';

import { Color } from '@ite/contracts';
import { Fragment, useState, type FormEvent } from 'react';

import { Button, Field, Input } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ConfirmAction } from '../shared/ConfirmAction';
import { EmptyState } from '../shared/EmptyState';
import { ErrorSummary, fieldError } from '../shared/ErrorSummary';
import { changedFields, textValue } from '../shared/form';
import { InlineInput } from '../shared/InlineInput';
import { PageHeader } from '../shared/PageHeader';
import { latestSuccess } from '../shared/success';
import { SuccessMessage } from '../shared/SuccessMessage';
import { useCatalogAction, type CatalogAction } from '../shared/useCatalogAction';

const API = '/api/v1/admin/colors';
const FIELD_LABELS = { name: 'Name', slug: 'Slug', hex: 'Hex' };

/** Colors page (admin-catalog-reference-data spec): name, slug, and an optional hex swatch. */
export function ColorsManager({ colors, canManage }: { colors: Color[]; canManage: boolean }) {
  const rows = useCatalogAction();
  const create = useCatalogAction();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="space-y-6">
      <PageHeader title="Colors" description="Hex values are optional and shown as swatches." />
      <SuccessMessage message={latestSuccess(rows, create)} />
      <ErrorSummary
        problem={rows.problem}
        summaryRef={rows.summaryRef}
        fieldLabels={FIELD_LABELS}
      />

      {colors.length === 0 ? (
        <EmptyState
          title="No colors yet."
          action={canManage ? { href: '#new-color', label: 'Create the first color' } : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Colors</caption>
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Name
                </th>
                <th scope="col" className="pr-3">
                  Slug
                </th>
                <th scope="col" className="pr-3">
                  Hex
                </th>
                {canManage ? (
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <ColorRow
                  key={color.id}
                  color={color}
                  canManage={canManage}
                  editing={editing === color.id}
                  onEdit={(on) => {
                    // Clear old messages when starting an edit, not when it closes after a save.
                    if (on) rows.clear();
                    setEditing(on ? color.id : null);
                  }}
                  action={rows}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? <CreateColorForm action={create} /> : null}
    </section>
  );
}

/** A swatch (decorative; the hex is always also shown as text). */
function Swatch({ hex }: { hex: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid="swatch"
      className="inline-block h-4 w-4 shrink-0 rounded border border-line align-middle"
      style={{ backgroundColor: hex }}
    />
  );
}

function ColorRow({
  color,
  canManage,
  editing,
  onEdit,
  action,
}: {
  color: Color;
  canManage: boolean;
  editing: boolean;
  onEdit: (on: boolean) => void;
  action: CatalogAction;
}) {
  const { run, busy, problem } = action;
  const formId = `edit-color-${color.id}`;

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const hex = textValue(form, 'hex');
    const changes = changedFields<Record<string, unknown>>(
      { name: color.name, slug: color.slug, hex: color.hex },
      {
        name: textValue(form, 'name'),
        slug: textValue(form, 'slug'),
        // An emptied field clears the hex; the API uppercases, so compare uppercased.
        hex: hex === '' ? null : hex.toUpperCase(),
      },
    );
    if (Object.keys(changes).length === 0) return onEdit(false);
    const saved = await run(
      () => apiSend('PATCH', `${API}/${color.id}`, { body: changes, schema: Color }),
      { success: (c) => `Color “${c.name}” saved.` },
    );
    if (saved) onEdit(false);
  }

  return (
    <tr className="border-b border-line align-top" data-testid={`color-row-${color.slug}`}>
      {editing ? (
        <>
          <td className="py-2 pr-3">
            <form id={formId} onSubmit={onSave} noValidate />
            <InlineInput
              form={formId}
              name="name"
              label={`Name for ${color.name}`}
              defaultValue={color.name}
              error={fieldError(problem, 'name')}
              autoFocus
            />
          </td>
          <td className="py-2 pr-3">
            <InlineInput
              form={formId}
              name="slug"
              label={`Slug for ${color.name}`}
              defaultValue={color.slug}
              error={fieldError(problem, 'slug')}
            />
          </td>
          <td className="py-2 pr-3">
            <InlineInput
              form={formId}
              name="hex"
              label={`Hex for ${color.name} (leave empty for none)`}
              defaultValue={color.hex ?? ''}
              placeholder="#RRGGBB"
              error={fieldError(problem, 'hex')}
            />
          </td>
        </>
      ) : (
        <>
          <td className="py-2 pr-3 font-medium">{color.name}</td>
          <td className="pr-3 font-mono text-xs">{color.slug}</td>
          <td className="pr-3">
            {color.hex ? (
              <span className="inline-flex items-center gap-2">
                <Swatch hex={color.hex} />
                <span className="font-mono text-xs">{color.hex}</span>
              </span>
            ) : (
              <span className="text-muted">None</span>
            )}
          </td>
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
                  aria-label={`Edit ${color.name}`}
                  onClick={() => onEdit(true)}
                >
                  Edit
                </Button>
                <ConfirmAction
                  label={`Delete ${color.name}`}
                  question={`Delete “${color.name}”?`}
                  confirmLabel="Confirm delete"
                  busy={busy}
                  onConfirm={async () => {
                    await run(() => apiSend('DELETE', `${API}/${color.id}`), {
                      success: `Color “${color.name}” deleted.`,
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

function CreateColorForm({ action }: { action: CatalogAction }) {
  const { run, busy, problem, summaryRef } = action;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const slug = textValue(form, 'slug');
    const hex = textValue(form, 'hex');
    const created = await run(
      () =>
        apiSend('POST', API, {
          body: {
            name: textValue(form, 'name'),
            ...(slug ? { slug } : {}),
            ...(hex ? { hex } : {}),
          },
          schema: Color,
        }),
      { success: (c) => `Color “${c.name}” created with slug ${c.slug}.` },
    );
    if (created) formElement.reset();
  }

  return (
    <form
      id="new-color"
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="new-color-heading"
      className="max-w-md space-y-4 border-t border-line pt-6"
    >
      <h2 id="new-color-heading" className="font-semibold">
        New color
      </h2>
      <ErrorSummary problem={problem} summaryRef={summaryRef} fieldLabels={FIELD_LABELS} />
      <Field label="Name" error={fieldError(problem, 'name')}>
        <Input name="name" required autoComplete="off" />
      </Field>
      <Field label="Slug (optional; generated from the name)" error={fieldError(problem, 'slug')}>
        <Input name="slug" autoComplete="off" />
      </Field>
      <Field label="Hex (optional)" error={fieldError(problem, 'hex')}>
        <Input name="hex" autoComplete="off" placeholder="#RRGGBB" />
      </Field>
      <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
        Create color
      </Button>
    </form>
  );
}
