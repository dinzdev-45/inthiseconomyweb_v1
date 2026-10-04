import { z } from 'zod';

/**
 * Admin server configuration, validated when next.config.ts loads (build and
 * start). Server-only values: none of these are NEXT_PUBLIC_, so they never
 * reach browser bundles.
 */
const AdminEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Base URL of apps/api as seen from this server, e.g. http://127.0.0.1:4000. */
  API_URL: z
    .url({
      protocol: /^https?$/,
      error: (issue) =>
        issue.input === undefined || issue.input === '' ? 'is required' : 'must be an http(s) URL',
    })
    .refine((value) => !URL.canParse(value) || new URL(value).pathname === '/', {
      error: 'must not include a path',
    })
    .transform((value) => value.replace(/\/$/, '')),
  /**
   * Whether every request reaches this app through a reverse proxy that sets
   * X-Forwarded-For (load balancer, Vercel, nginx). Only then is the header
   * passed on to the API; otherwise it is stripped, because a browser could
   * write it (design D8). Default false.
   */
  TRUST_UPSTREAM_PROXY: z
    .enum(['true', 'false'], { error: 'must be true or false' })
    .default('false')
    .transform((value) => value === 'true'),
});

export type AdminEnv = Readonly<z.infer<typeof AdminEnv>>;

export function loadEnv(source: Record<string, string | undefined> = process.env): AdminEnv {
  const result = AdminEnv.safeParse(source);
  if (!result.success) {
    // Names and rules only; values are never printed.
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid admin environment configuration:\n${problems.join('\n')}`);
  }
  return Object.freeze(result.data);
}
