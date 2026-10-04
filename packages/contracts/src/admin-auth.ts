import { z } from 'zod';

import { Permission, Role } from './access.ts';
import { Id } from './primitives.ts';

/** Name of the httpOnly staff session cookie set by the API and forwarded by the admin app. */
export const ADMIN_SESSION_COOKIE = 'ite_admin_session';

/** Upper bound on any password input, to cap hashing cost. */
const PASSWORD_MAX = 256;

/** Staff email address. Uniqueness is case-insensitive; the server compares without case. */
export const StaffEmail = z.string().trim().max(254).pipe(z.email());

/**
 * A password submitted for verification (login, current password). Not
 * checked against the policy, so a failed login never reveals policy details.
 */
export const PasswordInput = z.string().min(1).max(PASSWORD_MAX);

/** A password being set: at least 12 characters (admin-authentication spec). */
export const NewPassword = z.string().min(12).max(PASSWORD_MAX);

/** POST /api/v1/admin/auth/login — body. */
export const LoginRequest = z.strictObject({
  email: StaffEmail,
  password: PasswordInput,
});
export type LoginRequest = z.infer<typeof LoginRequest>;

/**
 * The signed-in staff member, as returned by login and GET /admin/auth/me.
 * The session token travels only in the httpOnly cookie, never in a body.
 */
export const CurrentStaff = z.strictObject({
  id: Id,
  email: z.email(),
  role: Role,
  permissions: z.array(Permission),
  /** True until a temporary password has been changed. */
  mustChangePassword: z.boolean(),
});
export type CurrentStaff = z.infer<typeof CurrentStaff>;

/** POST /api/v1/admin/auth/login — 200 response. */
export const LoginResponse = CurrentStaff;
export type LoginResponse = CurrentStaff;

/** GET /api/v1/admin/auth/me — 200 response. */
export const MeResponse = CurrentStaff;
export type MeResponse = CurrentStaff;

// POST /api/v1/admin/auth/logout — no body; 204 No Content.

/** POST /api/v1/admin/auth/change-password — body; 204 No Content. */
export const ChangePasswordRequest = z.strictObject({
  currentPassword: PasswordInput,
  newPassword: NewPassword,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;
