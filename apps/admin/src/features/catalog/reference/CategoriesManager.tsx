'use client';

import { Category, type CategoryStatus } from '@ite/contracts';
import Link from 'next/link';
import { Fragment, useState, type FormEvent } from 'react';

import { Button, Field, Input } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ConfirmAction } from '../shared/ConfirmAction';
import { EmptyState } from '../shared/EmptyState';
import { ErrorSummary, fieldError } from '../shared/ErrorSummary';
import { changedFields, textValue } from '../shared/form';
import { InlineInput } from '../shared/InlineInput';
import { PageHeader } from '../shared/PageHeader';
import { StatusBadge } from '../shared/StatusBadge';
import { latestSuccess } from '../shared/success';
import { SuccessMessage } from '../shared/SuccessMessage';
import { formatTimestamp } from '../shared/time';
import { useCatalogAction, type CatalogAction } from '../shared/useCatalogAction';

const API = '/api/v1/admin/categories';
const FIELD_LABELS = { name: 'Name', slug: 'Slug' };
const FILTERS: { label: string; status: CategoryStatus | undefined }[] = [
  { label: 'All', status: undefined },
  { label: 'Active', status: 'ACTIVE' },
  { label: 'Archived', status: 'ARCHIVED' },
];

type Props = {
  categories: Category[];
  status: CategoryStatus | undefined;
  canManage: boolean;
};

/** Categories page (admin-catalog-reference-data spec): list, filter, create, edit, archive, restore. */
export function CategoriesManager({ categories, status, canManage }: Props) {
  const rows = useCatalogAction();
  const create = useCatalogAction();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Categories"
        description="Group products. Categories are archived, never deleted."
      />

      <nav aria-label="Filter categories by status" className="flex gap-2 text-sm">
        {FILTERS.map((filter) => {
          const current = filter.status === status;
          return (
            <Link
              key={filter.label}
              href={
                filter.status
                  ? `/catalog/categories?status=${filter.status}`
                  : '/catalog/categories'
              }
              aria-current={current ? 'page' : undefined}
              className={`rounded border px-3 py-1 ${current ? 'border-ink bg-ink text-paper' : 'border-line bg-white hover:border-ink'}`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <SuccessMessage message={latestSuccess(rows, create)} />
      <ErrorSummary
        problem={rows.problem}
        summaryRef={rows.summaryRef}
        fieldLabels={FIELD_LABELS}
      />

      {categories.length === 0 ? (
        <EmptyState
          title={status ? 'No categories with this status.' : 'No categories yet.'}
          action={
            canManage && !status
              ? { href: '#new-category', label: 'Create the first category' }
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Categories</caption>
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Name
                </th>
                <th scope="col" className="pr-3">
                  Slug
                </th>
                <th scope="col" className="pr-3">
                  Status
                </th>
                <th scope="col" className="pr-3">
                  Updated
                </th>
                {canManage ? (
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  canManage={canManage}
                  editing={editing === category.id}
                  onEdit={(on) => {
                    // Clear old messages when starting an edit, not when it closes after a save.
                    if (on) rows.clear();
                    setEditing(on ? category.id : null);
                  }}
                  action={rows}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? <CreateCategoryForm action={create} /> : null}
    </section>
  );
}

function CategoryRow({
  category,
  canManage,
  editing,
  onEdit,
  action,
}: {
  category: Category;
  canManage: boolean;
  editing: boolean;
  onEdit: (on: boolean) => void;
  action: CatalogAction;
}) {
  const { run, busy, problem } = action;

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const changes = changedFields(
      { name: category.name, slug: category.slug },
      { name: textValue(form, 'name'), slug: textValue(form, 'slug') },
    );
    if (Object.keys(changes).length === 0) return onEdit(false);
    const saved = await run(
      () => apiSend('PATCH', `${API}/${category.id}`, { body: changes, schema: Category }),
      { success: (c) => `Category “${c.name}” saved.` },
    );
    if (saved) onEdit(false);
  }

  const formId = `edit-category-${category.id}`;
  return (
    <tr className="border-b border-line align-top" data-testid={`category-row-${category.slug}`}>
      {editing ? (
        <>
          <td className="py-2 pr-3">
            <form id={formId} onSubmit={onSave} noValidate />
            <InlineInput
              form={formId}
              name="name"
              label={`Name for ${category.name}`}
              defaultValue={category.name}
              error={fieldError(problem, 'name')}
              autoFocus
            />
          </td>
          <td className="py-2 pr-3">
            <InlineInput
              form={formId}
              name="slug"
              label={`Slug for ${category.name}`}
              defaultValue={category.slug}
              error={fieldError(problem, 'slug')}
            />
          </td>
        </>
      ) : (
        <>
          <td className="py-2 pr-3 font-medium">{category.name}</td>
          <td className="pr-3 font-mono text-xs">{category.slug}</td>
        </>
      )}
      <td className="py-2 pr-3">
        <StatusBadge status={category.status} />
      </td>
      <td className="py-2 pr-3 text-muted">{formatTimestamp(category.updatedAt)}</td>
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
                  aria-label={`Edit ${category.name}`}
                  onClick={() => onEdit(true)}
                >
                  Edit
                </Button>
                {category.status === 'ACTIVE' ? (
                  <ConfirmAction
                    label={`Archive ${category.name}`}
                    question={`Archive “${category.name}”?`}
                    confirmLabel="Confirm archive"
                    busy={busy}
                    onConfirm={async () => {
                      await run(
                        () =>
                          apiSend('POST', `${API}/${category.id}/archive`, { schema: Category }),
                        { success: (c) => `Category “${c.name}” archived.` },
                      );
                    }}
                  >
                    Archive
                  </ConfirmAction>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    aria-busy={busy || undefined}
                    aria-label={`Restore ${category.name}`}
                    onClick={() =>
                      run(
                        () =>
                          apiSend('POST', `${API}/${category.id}/restore`, { schema: Category }),
                        {
                          success: (c) => `Category “${c.name}” restored.`,
                        },
                      )
                    }
                  >
                    Restore
                  </Button>
                )}
              </Fragment>
            )}
          </span>
        </td>
      ) : null}
    </tr>
  );
}

function CreateCategoryForm({ action }: { action: CatalogAction }) {
  const { run, busy, problem, summaryRef } = action;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const slug = textValue(form, 'slug');
    const created = await run(
      () =>
        apiSend('POST', API, {
          body: { name: textValue(form, 'name'), ...(slug ? { slug } : {}) },
          schema: Category,
        }),
      { success: (c) => `Category “${c.name}” created with slug ${c.slug}.` },
    );
    if (created) formElement.reset();
  }

  return (
    <form
      id="new-category"
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="new-category-heading"
      className="max-w-md space-y-4 border-t border-line pt-6"
    >
      <h2 id="new-category-heading" className="font-semibold">
        New category
      </h2>
      <ErrorSummary problem={problem} summaryRef={summaryRef} fieldLabels={FIELD_LABELS} />
      <Field label="Name" error={fieldError(problem, 'name')}>
        <Input name="name" required autoComplete="off" />
      </Field>
      <Field label="Slug (optional; generated from the name)" error={fieldError(problem, 'slug')}>
        <Input name="slug" autoComplete="off" placeholder="e.g. outerwear" />
      </Field>
      <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
        Create category
      </Button>
    </form>
  );
}
