import type { Role, StaffMember } from '@ite/contracts';
import { Prisma, withAttribution, type AdminUser } from '@ite/db';

import type { Clock } from '../../clock.ts';
import { DomainError } from '../../errors.ts';
import { hashPassword } from '../admin-auth/password.ts';
import type { StaffRepository } from './repository.ts';

/** Public staff representation: no password hash or session data. */
export function toStaffMember(user: AdminUser): StaffMember {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    createdBy: user.createdById,
    updatedBy: user.updatedById,
  };
}

const notFound = () => new DomainError('NOT_FOUND', 404, 'Staff account not found.');
const lastOwner = () =>
  new DomainError('LAST_OWNER', 409, 'At least one active owner is required.');

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

type Deps = { repo: StaffRepository; clock: Clock };

export function createStaffService({ repo, clock }: Deps) {
  /**
   * Applies a change to one account under the last-OWNER rule: if the change
   * removes an active OWNER, it is refused when that OWNER is the only one.
   */
  async function changeAccount(
    actorId: string,
    targetId: string,
    change: (target: AdminUser) => { role?: Role; status?: 'ACTIVE' | 'DEACTIVATED' },
  ): Promise<StaffMember> {
    return repo.transaction(async (tx) => {
      const activeOwnerIds = await repo.lockActiveOwnerIds(tx);
      const target = await repo.findById(tx, targetId);
      if (!target) throw notFound();

      const data = change(target);
      const removesActiveOwner =
        activeOwnerIds.includes(target.id) &&
        ((data.role !== undefined && data.role !== 'OWNER') || data.status === 'DEACTIVATED');
      if (removesActiveOwner && activeOwnerIds.length <= 1) throw lastOwner();

      const now = clock.now();
      const updated = await repo.update(
        tx,
        target.id,
        withAttribution(actorId, { ...data, updatedAt: now }, 'update'),
      );
      // Sessions end with deactivation, so a later reactivation never revives them.
      if (data.status === 'DEACTIVATED') await repo.revokeSessions(tx, target.id, now);
      return toStaffMember(updated);
    });
  }

  return {
    async list(): Promise<StaffMember[]> {
      return (await repo.list()).map(toStaffMember);
    },

    /** Creates an ACTIVE account that must change its temporary password at first sign-in. */
    async create(
      actorId: string,
      input: { email: string; role: Role; temporaryPassword: string },
    ): Promise<StaffMember> {
      const now = clock.now();
      try {
        const created = await repo.create(
          withAttribution(
            actorId,
            {
              email: input.email,
              passwordHash: await hashPassword(input.temporaryPassword),
              role: input.role,
              mustChangePassword: true as const,
              createdAt: now,
              updatedAt: now,
            },
            'create',
          ),
        );
        return toStaffMember(created);
      } catch (error) {
        // `email` is citext, so the unique index already compares without case.
        if (isUniqueViolation(error)) {
          throw new DomainError(
            'STAFF_EMAIL_EXISTS',
            409,
            'A staff account with this email already exists.',
          );
        }
        throw error;
      }
    },

    changeRole(actorId: string, targetId: string, role: Role) {
      return changeAccount(actorId, targetId, () => ({ role }));
    },

    deactivate(actorId: string, targetId: string) {
      return changeAccount(actorId, targetId, () => ({ status: 'DEACTIVATED' }));
    },

    reactivate(actorId: string, targetId: string) {
      return changeAccount(actorId, targetId, () => ({ status: 'ACTIVE' }));
    },
  };
}

export type StaffService = ReturnType<typeof createStaffService>;
