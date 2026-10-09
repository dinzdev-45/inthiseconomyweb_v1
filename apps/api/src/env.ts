import { isIP } from 'node:net';

import { CATALOG_PRICE_MAX } from '@ite/contracts';
import { z } from 'zod';

const required = (issue: { input?: unknown }) =>
  issue.input === undefined || issue.input === '' ? 'is required' : undefined;

/** PostgreSQL connection string. Shared by the API and its CLI commands. */
export const DatabaseUrl = z.url({
  protocol: /^postgres(ql)?$/,
  error: (issue) => required(issue) ?? 'must be a postgres:// or postgresql:// URL',
});

const PROXY_KEYWORDS = new Set(['loopback', 'linklocal', 'uniquelocal']);

function isProxyAddress(entry: string): boolean {
  if (PROXY_KEYWORDS.has(entry) || isIP(entry) !== 0) return true;
  const [address, prefix, ...rest] = entry.split('/');
  if (rest.length > 0 || !address || prefix === undefined || !/^\d{1,3}$/.test(prefix))
    return false;
  const version = isIP(address);
  return version !== 0 && Number(prefix) <= (version === 4 ? 32 : 128);
}

/**
 * Which proxies may set X-Forwarded-For (design D8). Unset or empty: trust
 * nothing. A comma-separated list of IPs, CIDRs, or `loopback`/`linklocal`/
 * `uniquelocal`: trust only those peers. A whole number: trust exactly that
 * many hops (only safe when the API is unreachable except through them).
 * Blanket values such as `true` or `*` are rejected.
 */
export const TrustProxy = z
  .string()
  .optional()
  .transform((value, ctx): false | number | string[] => {
    const trimmed = value?.trim() ?? '';
    if (trimmed === '') return false;
    if (/^\d+$/.test(trimmed)) {
      const hops = Number(trimmed);
      if (hops >= 1 && hops <= 10) return hops;
      ctx.addIssue({ code: 'custom', message: 'must be a hop count between 1 and 10' });
      return z.NEVER;
    }
    const entries = trimmed.split(',').map((entry) => entry.trim());
    if (entries.some((entry) => !isProxyAddress(entry))) {
      ctx.addIssue({
        code: 'custom',
        message:
          'must be a hop count or a comma-separated list of IPs, CIDRs, loopback, linklocal, or uniquelocal',
      });
      return z.NEVER;
    }
    return entries;
  });

/**
 * The single store currency (product-domain design D2): every catalog price must use it.
 * An uppercase ISO 4217 code that the runtime recognises; defaults to IDR (the current
 * stand-in market). Server-side only: no endpoint exposes or changes it.
 */
const ISO_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));
export const StoreCurrency = z
  .string()
  .default('IDR')
  .refine((code) => /^[A-Z]{3}$/.test(code) && ISO_CURRENCIES.has(code), {
    error: 'must be an uppercase ISO 4217 currency code, e.g. IDR',
  });

/** Shipping amounts: whole minor units of the store currency, 0 to the catalog price maximum. */
const ShippingAmount = z.preprocess(
  // Empty means unset; a number (an already-parsed config) is read like its digits.
  (value) => (value === '' ? undefined : typeof value === 'number' ? String(value) : value),
  z
    .string()
    .regex(/^\d+$/, 'must be a whole number of minor units')
    .transform(Number)
    .refine((amount) => amount <= CATALOG_PRICE_MAX, {
      error: `must be at most ${CATALOG_PRICE_MAX}`,
    })
    .optional(),
);
/** Rp 20.000 in IDR minor units: the non-production default flat shipping fee. */
const DEFAULT_SHIPPING_FLAT_FEE = 2_000_000;

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: DatabaseUrl,
    TRUST_PROXY: TrustProxy,
    STORE_CURRENCY: StoreCurrency,
    ADMIN_ORIGIN: z
      .url({ protocol: /^https?$/, error: (issue) => required(issue) ?? 'must be an http(s) URL' })
      .refine((value) => !URL.canParse(value) || new URL(value).origin === value, {
        error: 'must be an origin (scheme://host[:port]) with no path or trailing slash',
      }),
    SESSION_SECRET: z
      .string({ error: required })
      .min(32, { error: (issue) => required(issue) ?? 'must be at least 32 characters' }),
    /** Flat shipping fee per order (guest-checkout design D4). Required in production. */
    SHIPPING_FLAT_FEE: ShippingAmount,
    /** Orders whose subtotal reaches this ship free. Optional. */
    FREE_SHIPPING_THRESHOLD: ShippingAmount,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.SHIPPING_FLAT_FEE === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['SHIPPING_FLAT_FEE'],
        message: 'is required in production',
      });
    }
  })
  .transform((env) => ({
    ...env,
    SHIPPING_FLAT_FEE: env.SHIPPING_FLAT_FEE ?? DEFAULT_SHIPPING_FLAT_FEE,
  }));

export type Env = Readonly<z.infer<typeof EnvSchema>>;

/** Thrown when the environment is invalid. The message names variables and rules, never values. */
export class EnvError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvError';
    this.problems = problems;
  }
}

/** Validates environment variables and returns a frozen, typed config. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseEnvWith(EnvSchema, source);
}

/** Validates `source` against any env schema, reporting names and rules but never values. */
export function parseEnvWith<T extends z.ZodType<object>>(
  schema: T,
  source: Record<string, string | undefined>,
): Readonly<z.infer<T>> {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Only the variable name and the rule are reported; issue inputs (values) are never read.
    throw new EnvError(
      result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  return Object.freeze(result.data);
}
