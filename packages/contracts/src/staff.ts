import { z } from 'zod';

import { Role } from './access.ts';
import { NewPassword, StaffEmail } from './admin-auth.ts';
import { AttributionFields, Id } from './primitives.ts';

export const StaffStatus = z.enum(['ACTIVE', 'DEACTIVATED']);
export type StaffStatus = z.infer<typeof StaffStatus>;

/**
 * Public representation of a staff account in admin responses. Deliberately
 * separate from the database row: no password hash or session data.
 */
export const StaffMember = z.strictObject({
  id: Id,
  email: z.email(),
  role: Role,
  status: StaffStatus,
  mustChangePassword: z.boolean(),
  ...AttributionFields.shape,
});
export type StaffMember = z.infer<typeof StaffMember>;

/** Path params for /api/v1/admin/staff/:id/* endpoints. */
export const StaffIdParams = z.strictObject({ id: Id });
export type StaffIdParams = z.infer<typeof StaffIdParams>;

/**
 * GET /api/v1/admin/staff — 200 response. Uses the `{ data }` list envelope
 * so cursor pagination (`nextCursor`) can be added later without a breaking change.
 */
export const StaffListResponse = z.strictObject({ data: z.array(StaffMember) });
export type StaffListResponse = z.infer<typeof StaffListResponse>;

/** POST /api/v1/admin/staff — body; 201 response is a StaffMember. */
export const CreateStaffRequest = z.strictObject({
  email: StaffEmail,
  role: Role,
  /** Must be changed by the staff member at first sign-in. */
  temporaryPassword: NewPassword,
});
export type CreateStaffRequest = z.infer<typeof CreateStaffRequest>;

/** PATCH /api/v1/admin/staff/:id/role — body; 200 response is a StaffMember. */
export const ChangeStaffRoleRequest = z.strictObject({ role: Role });
export type ChangeStaffRoleRequest = z.infer<typeof ChangeStaffRoleRequest>;

// POST /api/v1/admin/staff/:id/deactivate and /reactivate — params StaffIdParams,
// no body; 200 response is the updated StaffMember.

/** Response for create, change role, deactivate, and reactivate. */
export const StaffMemberResponse = StaffMember;
export type StaffMemberResponse = StaffMember;
