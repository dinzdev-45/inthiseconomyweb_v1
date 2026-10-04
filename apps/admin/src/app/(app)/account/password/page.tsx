import type { Metadata } from 'next';

import { getCurrentStaff } from '@/lib/session';

import { ChangePasswordForm } from './ChangePasswordForm';

export const metadata: Metadata = { title: 'Change password' };

export default async function ChangePasswordPage() {
  const staff = await getCurrentStaff();
  return (
    <section className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">Change password</h1>
      {staff.mustChangePassword ? (
        <p className="text-sm text-muted">
          Choose a new password to replace your temporary one before continuing.
        </p>
      ) : null}
      <ChangePasswordForm />
    </section>
  );
}
