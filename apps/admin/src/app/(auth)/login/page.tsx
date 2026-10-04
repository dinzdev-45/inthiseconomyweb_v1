import { MeResponse } from '@ite/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { apiGet } from '@/lib/api/server';

import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  // Already signed in: go straight to the admin.
  const signedIn = await apiGet('/api/v1/admin/auth/me', MeResponse).then(
    () => true,
    () => false,
  );
  if (signedIn) redirect('/');

  return (
    <main className="mx-auto mt-24 max-w-sm space-y-6 px-4">
      <h1 className="text-2xl font-semibold">InThisEconomy Admin</h1>
      <LoginForm />
    </main>
  );
}
