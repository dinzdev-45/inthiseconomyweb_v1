# Proposal

## Why

InThisEconomy is a greenfield fashion e-commerce platform. Every planned feature (catalog, drops, lookbook, cart, guest checkout, orders, promotions, reports) depends on the same base: a repository layout, a REST API with consistent conventions, a PostgreSQL schema managed by Prisma, shared request/response contracts, and a way for staff to sign in to the admin. This change builds the smallest foundation that lets feature work start, while leaving clear extension points for stronger admin security later.

## What Changes

- Establish a TypeScript monorepo (pnpm workspaces + Turborepo) containing:
  - `apps/web` — Next.js 16 storefront shell (layout, error/not-found pages), no shopping features yet
  - `apps/admin` — Next.js 16 admin shell (login, layout, staff list for Owners, change own password)
  - `apps/api` — Node.js + TypeScript REST API (Fastify) structured as a modular monolith
  - `packages/db` — Prisma schema, migrations, dev seed, generated client
  - `packages/contracts` — Zod schemas shared by the API and both frontends
  - `packages/config` — shared TypeScript, ESLint, and Tailwind presets
- Local development PostgreSQL via Docker Compose.
- Environment configuration validated at startup for every app.
- Platform-wide REST API conventions: `/api/v1` with `store`, `admin`, and `webhooks` zones, centralized RFC 7807 error responses, request validation, request IDs, basic security headers and CORS, health/readiness endpoints, money and identifier representation.
- Basic admin authentication: email + password, password hashing, secure server-side sessions in httpOnly cookies, logout, change own password, and basic login rate limiting.
- Basic authorization with two roles, `OWNER` and `ADMIN`, enforced server-side through permission checks; Owners can create, list, change the role of, and deactivate staff accounts.
- Change attribution: admin-managed records carry `created_at`, `updated_at`, `created_by`, and `updated_by`.
- Lint, typecheck, and test foundation (Vitest unit + integration against a real PostgreSQL, one Playwright smoke test) wired into CI.

**Deferred to a future `admin-security-hardening` change** (architecture keeps room for them, see design.md):
- Mandatory TOTP two-factor authentication and recovery codes
- Staff invitation workflow (email-based onboarding)
- Four-role permission matrix (Owner / Manager / Fulfillment / Content)
- Immutable audit log infrastructure
- Advanced session revocation (listing and revoking individual sessions)
- Complex lockout policies
- pg-boss background jobs and the transactional outbox

**Deferred to the feature changes that first need them:** cursor pagination, idempotency keys, OpenAPI publication, email sending, distributed rate limiting.

**Out of scope for this change:** catalog, inventory, drops, lookbook, site content, search, cart, checkout, payments, orders, promotions, restock notifications, reports. Customer accounts, login/register, and wishlist are permanently out of scope — customers only ever check out as guests, so the `store` API zone has no authentication.

## Capabilities

### New Capabilities

- `api-conventions`: Platform-wide REST contract — versioning and zones, centralized error format, validation, request IDs, environment configuration, health/readiness, security headers and CORS, money and identifier representation.
- `admin-authentication`: Staff sign-in with email + password, server-side session lifecycle, logout, change own password, login rate limiting, and first-Owner bootstrap.
- `admin-access-control`: `OWNER` and `ADMIN` roles, server-side permission enforcement on admin endpoints, basic staff account management, and created/updated attribution on admin-managed records.

### Modified Capabilities

_None — no existing specs._

## Impact

- **Code**: Creates the entire repository structure; no existing code is affected.
- **APIs**: Establishes `/api/v1/admin/auth/*`, `/api/v1/admin/staff/*`, `/health`, `/ready`. Every future endpoint follows `api-conventions`.
- **Database**: Initial Prisma migration with `AdminUser` and `AdminSession`.
- **Dependencies**: Next.js 16, React, Tailwind CSS, Fastify, Zod, Prisma, PostgreSQL 16+, an argon2 library, Vitest, Testcontainers, Playwright, pnpm, Turborepo, Docker (local only).
- **Operations**: Requires PostgreSQL per environment, a session secret, and running the bootstrap command once to create the first Owner.
- **Assumptions** (to revisit): hosting target not yet chosen — design stays platform-neutral. Payment provider, shipping, and market/currency are not decided here.
