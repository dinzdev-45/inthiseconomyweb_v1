import Link from 'next/link';
import type { ReactNode } from 'react';

/** Shown instead of an empty list; offers a create link to staff who can manage. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { href: string; label: string } | undefined;
}) {
  return (
    <div className="space-y-2 rounded border border-dashed border-line bg-white px-4 py-8 text-center">
      <p className="font-medium">{title}</p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
      {action ? (
        <Link href={action.href} className="inline-block text-sm underline">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
