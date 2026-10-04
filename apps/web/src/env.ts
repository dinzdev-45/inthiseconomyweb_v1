import { z } from 'zod';

/**
 * Storefront server configuration, validated when next.config.ts loads (build
 * and start). Nothing here is NEXT_PUBLIC_, so none of it reaches browser bundles.
 */
const WebEnv = z.object({
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
});

export type WebEnv = Readonly<z.infer<typeof WebEnv>>;

export function loadEnv(source: Record<string, string | undefined> = process.env): WebEnv {
  const result = WebEnv.safeParse(source);
  if (!result.success) {
    // Names and rules only; values are never printed.
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Invalid storefront environment configuration:\n${problems.join('\n')}`);
  }
  return Object.freeze(result.data);
}
