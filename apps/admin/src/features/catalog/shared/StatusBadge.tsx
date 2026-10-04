import type { CategoryStatus, ProductStatus, VariantStatus } from '@ite/contracts';

import { Badge } from '@/components/ui';

type Status = ProductStatus | VariantStatus | CategoryStatus;

const LABEL: Record<Status, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ARCHIVED: 'Archived',
};

const TONE: Record<Status, 'neutral' | 'strong' | 'muted'> = {
  DRAFT: 'neutral',
  ACTIVE: 'strong',
  INACTIVE: 'muted',
  ARCHIVED: 'muted',
};

/** A lifecycle status as text (colour is only an extra cue). */
export function StatusBadge({ status }: { status: Status }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
