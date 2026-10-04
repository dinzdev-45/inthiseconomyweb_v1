import { ROLE_PERMISSIONS, type CurrentStaff } from '@ite/contracts';
import { withAttribution } from '@ite/db';

import type { Clock } from '../../clock.ts';
import { DomainError } from '../../errors.ts';
import { hashPassword, verifyPassword } from './password.ts';
import type { AdminAuthRepository } from './repository.ts';
import {
  generateSessionToken,
  hashSessionToken,
  isSessionLive,
  SESSION_ABSOLUTE_TIMEOUT_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from './session-token.ts';

/** The authenticated staff session attached to admin requests. */
export type AdminSessionContext = {
  sessionId: string;
  staffId: string;
  email: string;
  role: CurrentStaff['role'];
  mustChangePassword: boolean;
};

const INVALID_CREDENTIALS = () =>
  new DomainError('INVALID_CREDENTIALS', 401, 'Invalid email or password.');

export function toCurrentStaff(staff: Omit<AdminSessionContext, 'sessionId'>): CurrentStaff {
  return {
    id: staff.staffId,
    email: staff.email,
    role: staff.role,
    permissions: [...ROLE_PERMISSIONS[staff.role]],
    mustChangePassword: staff.mustChangePassword,
  };
}

type Deps = {
  repo: AdminAuthRepository;
  clock: Clock;
  sessionSecret: string;
  /** Resolves to a hash used to equalize timing when no account can sign in. */
  dummyHash: Promise<string>;
};

export function createAdminAuthService({ repo, clock, sessionSecret, dummyHash }: Deps) {
  return {
    /**
     * Verifies credentials and opens a session. Unknown, deactivated, and
     * wrong-password attempts all do one hash verification and fail identically.
     */
    async login(email: string, password: string) {
      const user = await repo.findUserByEmail(email);
      const usable = user?.status === 'ACTIVE' ? user : null;
      const valid = await verifyPassword(usable?.passwordHash ?? (await dummyHash), password);
      if (!usable || !valid) throw INVALID_CREDENTIALS();

      const token = generateSessionToken();
      const now = clock.now();
      const session = await repo.createSession({
        tokenHash: hashSessionToken(sessionSecret, token),
        adminUserId: usable.id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TIMEOUT_MS),
      });
      const context: AdminSessionContext = {
        sessionId: session.id,
        staffId: usable.id,
        email: usable.email,
        role: usable.role,
        mustChangePassword: usable.mustChangePassword,
      };
      return { token, context };
    },

    /** Resolves a cookie token to a live session of an active user, refreshing `lastSeenAt`. */
    async authenticate(token: string): Promise<AdminSessionContext | null> {
      const session = await repo.findSessionWithUser(hashSessionToken(sessionSecret, token));
      const now = clock.now();
      if (!session || !isSessionLive(session, now) || session.adminUser.status !== 'ACTIVE') {
        return null;
      }
      if (now.getTime() - session.lastSeenAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
        await repo.touchSession(session.id, now);
      }
      const { adminUser: user } = session;
      return {
        sessionId: session.id,
        staffId: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      };
    },

    async logout(sessionId: string): Promise<void> {
      await repo.revokeSession(sessionId, clock.now());
    },

    /** Changes the signed-in staff member's own password and clears the temporary-password flag. */
    async changePassword(staffId: string, currentPassword: string, newPassword: string) {
      const user = await repo.findUserById(staffId);
      if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
        throw new DomainError('INVALID_CREDENTIALS', 401, 'The current password is incorrect.');
      }
      await repo.updatePassword(
        staffId,
        withAttribution(
          staffId,
          { passwordHash: await hashPassword(newPassword), mustChangePassword: false as const },
          'update',
        ),
      );
    },
  };
}

export type AdminAuthService = ReturnType<typeof createAdminAuthService>;
