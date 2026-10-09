import type { CategoryStatus, DropStatus, ProductStatus, VariantStatus } from '@ite/contracts';

import { Badge } from '@/components/ui';

type Status = ProductStatus | VariantStatus | CategoryStatus | DropStatus;

const LABEL: Record<Status, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ARCHIVED: 'Archived',
  PUBLISHED: 'Published',
};

const TONE: Record<Status, 'neutral' | 'strong' | 'muted'> = {
  DRAFT: 'neutral',
  ACTIVE: 'strong',
  INACTIVE: 'muted',
  ARCHIVED: 'muted',
  PUBLISHED: 'strong',
};

/** A lifecycle status as text (colour is only an extra cue). */
export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
