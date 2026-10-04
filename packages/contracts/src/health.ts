import { z } from 'zod';

/** GET /health: the API process is alive. Reveals no versions, configuration, or hostnames. */
export const HealthResponse = z.strictObject({ status: z.literal('ok') });
export type HealthResponse = z.infer<typeof HealthResponse>;

/** GET /ready: the database is reachable. */
export const ReadyResponse = z.strictObject({ status: z.literal('ready') });
export type ReadyResponse = z.infer<typeof ReadyResponse>;
