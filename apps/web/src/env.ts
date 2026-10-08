import { z } from 'zod';

/** A DNS hostname: dot-separated labels of letters, digits, and inner hyphens. */
const HOSTNAME =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const DEFAULT_SITE_URL = 'http://localhost:3000';

/**
 * Storefront server configuration, validated when next.config.ts loads (build
 * and start). Nothing here is NEXT_PUBLIC_, so none of it reaches browser bundles.
 */
const WebEnv = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Base URL of apps/api as seen from this server, e.g. http://127.0.0.1:4000. */
    API_URL: z
      .url({
        protocol: /^https?$/,
        error: (issue) =>
          issue.input === undefined || issue.input === ''
            ? 'is required'
            : 'must be an http(s) URL',
      })
      .refine((value) => !URL.canParse(value) || new URL(value).pathname === '/', {
        error: 'must not include a path',
      })
      .transform((value) => value.replace(/\/$/, '')),
    /**
     * Public origin of the storefront, e.g. https://inthiseconomy.com, used for canonical URLs
     * (`metadataBase`). Required in production; defaults to http://localhost:3000 otherwise.
     */
    // An empty value (e.g. `SITE_URL=` copied from .env.example) counts as unset.
    SITE_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z
        .url({ protocol: /^https?$/, error: 'must be an http(s) URL' })
        .refine((value) => !URL.canParse(value) || new URL(value).pathname === '/', {
          error: 'must not include a path',
        })
        .transform((value) => value.replace(/\/$/, ''))
        .optional(),
    ),
    /**
     * Comma-separated https hostnames that product images may be served from, e.g.
     * `cdn.example.com,images.example.net`. Optional: without it only root-relative images load.
     */
    STOREFRONT_IMAGE_HOSTS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((host) => host.trim().toLowerCase())
          .filter(Boolean),
      )
      .refine((hosts) => hosts.every((host) => HOSTNAME.test(host)), {
        error: 'must be comma-separated hostnames (no scheme, port, or path)',
      }),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.SITE_URL === undefined) {
      ctx.addIssue({ code: 'custom', path: ['SITE_URL'], message: 'is required in production' });
    }
  })
  .transform((env) => ({ ...env, SITE_URL: env.SITE_URL ?? DEFAULT_SITE_URL }));

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
