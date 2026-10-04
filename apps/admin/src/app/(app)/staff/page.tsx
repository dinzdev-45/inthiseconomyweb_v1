import { StaffListResponse } from '@ite/contracts';
import type { Metadata } from 'next';

import { NotPermitted } from '@/components/NotPermitted';
import { apiGetForPage } from '@/lib/api/server';
import { getCurrentStaff } from '@/lib/session';

import { StaffManager } from './StaffManager';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const staff = await getCurrentStaff();
  // Checked before any staff data is requested; the API would also refuse (403).
  if (!staff.permissions.includes('staff:read')) return <NotPermitted />;

  const { data } = await apiGetForPage('/api/v1/admin/staff', StaffListResponse);
  return (
    <StaffManager
      members={data}
      currentStaffId={staff.id}
      canManage={staff.permissions.includes('staff:manage')}
    />
  );
}
