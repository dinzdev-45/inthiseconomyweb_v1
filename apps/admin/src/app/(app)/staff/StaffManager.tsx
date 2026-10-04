'use client';

import { Role, StaffMemberResponse, type StaffMember } from '@ite/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert, Button, Field, Input, Select } from '@/components/ui';
import { apiSend } from '@/lib/api/client';
import { ApiError, authRedirectFor } from '@/lib/api/errors';

type Props = { members: StaffMember[]; currentStaffId: string; canManage: boolean };

export function StaffManager({ members, currentStaffId, canManage }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  /** Runs a mutation, then reloads server data; auth errors redirect, others are shown. */
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await action();
      router.refresh();
      return true;
    } catch (caught) {
      const target = authRedirectFor(caught);
      if (target) {
        router.replace(target);
        return false;
      }
      if (caught instanceof ApiError) {
        setError(caught.detail);
        setFieldErrors(caught.fieldErrors());
      } else {
        setError('Something went wrong. Please try again.');
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const created = await run(() =>
      apiSend('POST', '/api/v1/admin/staff', {
        body: {
          email: form.get('email'),
          role: form.get('role'),
          temporaryPassword: form.get('temporaryPassword'),
        },
        schema: StaffMemberResponse,
      }),
    );
    if (created) formElement.reset();
  }

  return (
    <section className="space-y-8">
      <h1 className="text-xl font-semibold">Staff</h1>
      {error ? <Alert>{error}</Alert> : null}

      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-muted">
          <tr>
            <th className="py-2">Email</th>
            <th>Role</th>
            <th>Status</th>
            {canManage ? <th className="text-right">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr
              key={member.id}
              className="border-b border-line"
              data-testid={`staff-row-${member.email}`}
            >
              <td className="py-2">
                {member.email}
                {member.id === currentStaffId ? <span className="text-muted"> (you)</span> : null}
                {member.mustChangePassword ? (
                  <span className="ml-2 text-xs text-muted">must change password</span>
                ) : null}
              </td>
              <td>
                {canManage ? (
                  <Select
                    aria-label={`Role for ${member.email}`}
                    value={member.role}
                    disabled={busy}
                    onChange={(event) =>
                      run(() =>
                        apiSend('PATCH', `/api/v1/admin/staff/${member.id}/role`, {
                          body: { role: event.target.value },
                          schema: StaffMemberResponse,
                        }),
                      )
                    }
                  >
                    {Role.options.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                ) : (
                  member.role
                )}
              </td>
              <td>{member.status === 'ACTIVE' ? 'Active' : 'Deactivated'}</td>
              {canManage ? (
                <td className="text-right">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        apiSend(
                          'POST',
                          `/api/v1/admin/staff/${member.id}/${member.status === 'ACTIVE' ? 'deactivate' : 'reactivate'}`,
                          { schema: StaffMemberResponse },
                        ),
                      )
                    }
                  >
                    {member.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {canManage ? (
        <form
          onSubmit={onCreate}
          className="max-w-md space-y-4"
          noValidate
          aria-label="Create staff account"
        >
          <h2 className="font-semibold">Create staff account</h2>
          <Field label="Email" error={fieldErrors.email}>
            <Input name="email" type="email" required />
          </Field>
          <Field label="Role" error={fieldErrors.role}>
            <Select name="role" defaultValue="ADMIN">
              {Role.options.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Temporary password (min 12 characters)"
            error={fieldErrors.temporaryPassword}
          >
            <Input name="temporaryPassword" type="password" autoComplete="new-password" required />
          </Field>
          <Button type="submit" disabled={busy}>
            Create account
          </Button>
        </form>
      ) : null}
    </section>
  );
}
