'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert, Button, Field, Input } from '@/components/ui';
import { apiSend } from '@/lib/api/client';
import { ApiError, authRedirectFor } from '@/lib/api/errors';

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setFieldErrors({});
    if (form.get('newPassword') !== form.get('confirmPassword')) {
      setFieldErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }
    setPending(true);
    try {
      await apiSend('POST', '/api/v1/admin/auth/change-password', {
        body: {
          currentPassword: form.get('currentPassword'),
          newPassword: form.get('newPassword'),
        },
      });
      router.replace('/');
      router.refresh();
    } catch (caught) {
      const target = authRedirectFor(caught);
      if (target === '/login') return router.replace(target);
      if (caught instanceof ApiError && caught.code === 'INVALID_CREDENTIALS') {
        setFieldErrors({ currentPassword: 'The current password is incorrect.' });
      } else if (caught instanceof ApiError) {
        setError(caught.errors.length ? null : caught.detail);
        setFieldErrors(caught.fieldErrors());
      } else {
        setError('Something went wrong. Please try again.');
      }
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Current password" error={fieldErrors.currentPassword}>
        <Input name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password (min 12 characters)" error={fieldErrors.newPassword}>
        <Input name="newPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" error={fieldErrors.confirmPassword}>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
}
