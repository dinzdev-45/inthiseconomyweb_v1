import type { AdminDrop } from '@ite/contracts';

import { formatWib } from './release-time';

/** A drop's details as text, for staff who cannot change it. */
export function DropDetails({ drop }: { drop: AdminDrop }) {
  return (
    <dl className="grid max-w-2xl grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
      <dt className="text-muted">Collection</dt>
      <dd>{drop.collection}</dd>
      <dt className="text-muted">Title</dt>
      <dd>{drop.title}</dd>
      <dt className="text-muted">Description</dt>
      <dd className="whitespace-pre-line">{drop.description ?? 'None'}</dd>
      <dt className="text-muted">Release</dt>
      <dd>{formatWib(drop.releaseAt)}</dd>
      <dt className="text-muted">Image</dt>
      <dd className="break-all">{drop.image ? `${drop.image.url} (${drop.image.alt})` : 'None'}</dd>
    </dl>
  );
}
