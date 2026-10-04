'use client';

import { LoginResponse } from '@ite/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert, Button, Field, Input } from '@/components/ui';
import { apiSend } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

const MESSAGES: Partial<Record<string, string>> = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  RATE_LIMITED: 'Too many sign-in attempts. Try again later.',
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const staff = await apiSend('POST', '/api/v1/admin/auth/login', {
        body: { email: form.get('email'), password: form.get('password') },
        schema: LoginResponse,
      });
      router.replace(staff.mustChangePassword ? '/account/password' : '/');
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? (MESSAGES[caught.code ?? ''] ?? caught.detail)
          : 'Something went wrong. Please try again.',
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert>{error}</Alert> : null}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
