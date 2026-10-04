import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { visibleNav } from '@/lib/nav';
import { getCurrentStaff } from '@/lib/session';

import { LogoutButton } from './LogoutButton';

export const dynamic = 'force-dynamic';

const PASSWORD_PAGE = '/account/password';

/** Authenticated admin shell. No session → /login (inside getCurrentStaff); temporary password → change-password. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const staff = await getCurrentStaff();
  const pathname = (await headers()).get('x-pathname') ?? '';
  if (staff.mustChangePassword && pathname !== PASSWORD_PAGE) redirect(PASSWORD_PAGE);

  const nav = staff.mustChangePassword ? [] : visibleNav(staff.permissions);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-3">
          <nav aria-label="Main" className="flex items-center gap-4 text-sm">
            <span className="font-semibold">InThisEconomy</span>
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:underline">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href={PASSWORD_PAGE} className="text-muted hover:underline">
              {staff.email} · {staff.role}
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
