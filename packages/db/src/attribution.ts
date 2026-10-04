/** The staff account performing a change, or null for system processes and the bootstrap command. */
export type Actor = string | null;

export type AttributionOperation = 'create' | 'update';

type CreateAttribution = { createdById: Actor; updatedById: Actor };
type UpdateAttribution = { updatedById: Actor };

/**
 * Adds created_by/updated_by attribution to Prisma create or update data.
 * Timestamps are handled by the schema (`@default(now())` / `@updatedAt`).
 */
export function withAttribution<T extends object>(
  actor: Actor,
  data: T,
  operation: 'create',
): T & CreateAttribution;
export function withAttribution<T extends object>(
  actor: Actor,
  data: T,
  operation: 'update',
): T & UpdateAttribution;
export function withAttribution<T extends object>(
  actor: Actor,
  data: T,
  operation: AttributionOperation,
): T & (CreateAttribution | UpdateAttribution) {
  return operation === 'create'
    ? { ...data, createdById: actor, updatedById: actor }
    : { ...data, updatedById: actor };
}
