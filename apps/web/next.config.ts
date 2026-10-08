import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

import { loadEnv } from './src/env.ts';

// Local development reads the repo-root .env (see .env.example); deployments set variables directly.
const rootEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const env = loadEnv();

// api-conventions: Security headers and CORS.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  ...(env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Workspace packages are consumed as TypeScript source.
  transpilePackages: ['@ite/contracts'],
  // storefront-catalog design D7: product images load only from the configured https hosts
  // (plus the storefront's own root-relative paths).
  images: {
    remotePatterns: env.STOREFRONT_IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https' as const,
      hostname,
      pathname: '/**',
    })),
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
