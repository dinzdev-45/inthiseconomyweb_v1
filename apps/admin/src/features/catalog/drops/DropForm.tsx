'use client';

import { AdminDrop } from '@ite/contracts';
import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';

import { Button, Field, Input, Textarea } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

import { ErrorSummary, fieldError } from '../shared/ErrorSummary';
import { textValue } from '../shared/form';
import { SuccessMessage } from '../shared/SuccessMessage';
import { useCatalogAction } from '../shared/useCatalogAction';
import { fromWibInput, toWibInput } from './release-time';

const API = '/api/v1/admin/drops';
const FIELD_LABELS = {
  collection: 'Collection',
  title: 'Title',
  slug: 'Slug',
  description: 'Description',
  releaseAt: 'Release',
  'image.url': 'Image URL',
  'image.alt': 'Image alt text',
  image: 'Image',
};

type DropFields = {
  collection: string;
  title: string;
  description: string | null;
  releaseAt: string;
  image: { url: string; alt: string } | null;
};

/**
 * Drop create and edit form (admin-drops spec: Drop form). The release is entered in WIB and
 * sent as UTC; the API decides every other rule. Editing sends only the changed fields, and
 * entered values stay in the form when the API refuses them.
 */
export function DropForm({ drop }: { drop?: AdminDrop }) {
  const router = useRouter();
  const action = useCatalogAction();
  const { run, reject, busy, problem, success, summaryRef } = action;
  const editing = drop !== undefined;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const releaseAt = fromWibInput(textValue(form, 'releaseAt'));
    if (!releaseAt) return reject({ releaseAt: 'Enter the release date and time.' });

    const description = textValue(form, 'description');
    const url = textValue(form, 'imageUrl');
    const alt = textValue(form, 'imageAlt');
    const slug = textValue(form, 'slug');
    const fields: DropFields = {
      collection: textValue(form, 'collection'),
      title: textValue(form, 'title'),
      description: description === '' ? null : description,
      releaseAt,
      image: url === '' && alt === '' ? null : { url, alt },
    };

    if (!editing) {
      const created = await run(
        () =>
          apiSend('POST', API, {
            body: { ...fields, ...(slug ? { slug } : {}) },
            schema: AdminDrop,
          }),
        { refresh: false },
      );
      if (created) router.push(`/catalog/drops/${created.id}?created=1`);
      return;
    }

    const changes: Record<string, unknown> = {};
    for (const key of ['collection', 'title', 'description', 'releaseAt'] as const) {
      if (fields[key] !== drop[key]) changes[key] = fields[key];
    }
    if (JSON.stringify(fields.image) !== JSON.stringify(drop.image)) changes.image = fields.image;
    if (slug !== drop.slug) changes.slug = slug;
    if (Object.keys(changes).length === 0) {
      action.clear();
      return;
    }
    await run(() => apiSend('PATCH', `${API}/${drop.id}`, { body: changes, schema: AdminDrop }), {
      success: 'Drop details saved.',
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={editing ? 'Drop details' : 'New drop'}
      className="max-w-2xl space-y-4"
    >
      <ErrorSummary problem={problem} summaryRef={summaryRef} fieldLabels={FIELD_LABELS} />
      <Field label="Collection" error={fieldError(problem, 'collection')}>
        <Input
          name="collection"
          required
          autoComplete="off"
          defaultValue={drop?.collection ?? ''}
        />
      </Field>
      <Field label="Title" error={fieldError(problem, 'title')}>
        <Input name="title" required autoComplete="off" defaultValue={drop?.title ?? ''} />
      </Field>
      <Field
        label={editing ? 'Slug' : 'Slug (optional; generated from the title)'}
        error={fieldError(problem, 'slug')}
      >
        <Input name="slug" autoComplete="off" defaultValue={drop?.slug ?? ''} />
      </Field>
      <Field label="Description (optional)" error={fieldError(problem, 'description')}>
        <Textarea name="description" defaultValue={drop?.description ?? ''} />
      </Field>
      <Field label="Release (date and time, WIB)" error={fieldError(problem, 'releaseAt')}>
        <Input
          name="releaseAt"
          type="datetime-local"
          step={60}
          required
          defaultValue={drop ? toWibInput(drop.releaseAt) : ''}
        />
      </Field>
      <Field
        label="Image URL (needed to publish)"
        error={fieldError(problem, 'image.url') ?? fieldError(problem, 'image')}
      >
        <Input name="imageUrl" autoComplete="off" defaultValue={drop?.image?.url ?? ''} />
      </Field>
      <Field label="Image alt text" error={fieldError(problem, 'image.alt')}>
        <Input name="imageAlt" autoComplete="off" defaultValue={drop?.image?.alt ?? ''} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy} aria-busy={busy || undefined}>
          {editing ? 'Save details' : 'Create drop'}
        </Button>
        <SuccessMessage message={success} />
      </div>
    </form>
  );
}
