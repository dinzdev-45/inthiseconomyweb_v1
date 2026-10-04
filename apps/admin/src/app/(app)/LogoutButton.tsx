'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { apiSend } from '@/lib/api/client';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    // Even if the session already expired (401), the user ends up signed out.
    await apiSend('POST', '/api/v1/admin/auth/logout').catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={logout} disabled={pending}>
      Sign out
    </Button>
  );
}
