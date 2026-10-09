import type { AdminDropListItem } from '@ite/contracts';
import Link from 'next/link';

import { EmptyState } from '../shared/EmptyState';
import { StatusBadge } from '../shared/StatusBadge';
import { formatWib } from './release-time';

/** The drops table (admin-drops spec: Drops list), newest release first as the API sends it. */
export function DropList({ items, canManage }: { items: AdminDropListItem[]; canManage: boolean }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No drops yet."
        action={
          canManage ? { href: '/catalog/drops/new', label: 'Create the first drop' } : undefined
        }
      />
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Drops</caption>
        <thead className="border-b border-line text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3">
              Drop
            </th>
            <th scope="col" className="pr-3">
              Status
            </th>
            <th scope="col" className="pr-3">
              Release (WIB)
            </th>
            <th scope="col" className="text-right">
              Products
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((drop) => (
            <tr
              key={drop.id}
              className="border-b border-line align-top"
              data-testid={`drop-row-${drop.slug}`}
            >
              <td className="py-2 pr-3">
                <span className="block text-xs text-muted uppercase">{drop.collection}</span>
                <Link
                  href={`/catalog/drops/${drop.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {drop.title}
                </Link>
              </td>
              <td className="py-2 pr-3">
                <StatusBadge status={drop.status} />
              </td>
              <td className="py-2 pr-3 tabular-nums">{formatWib(drop.releaseAt)}</td>
              <td className="py-2 text-right tabular-nums">{drop.productCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
