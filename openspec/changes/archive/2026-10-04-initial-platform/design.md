# Design

## Context

The repository is empty apart from the OpenSpec setup. The stack is fixed by the project: Next.js 16 + TypeScript + Tailwind CSS (frontend), Node.js + TypeScript REST API (backend), PostgreSQL + Prisma (database). There are no customer accounts — customers check out as guests — so the only authenticated humans are staff. Requirements are in `specs/`; motivation and the deferred list are in `proposal.md`.

Undecided at this point (and not needed here): hosting provider, payment provider, shipping, market/currency, email provider.

## Goals / Non-Goals

**Goals:**
- A layout where each future feature change adds a module to the API, a feature folder to each frontend, and models to one Prisma schema — without touching cross-cutting plumbing.
- One source of truth for request/response shapes, shared by API validation and frontend clients.
- Admin security that is basic but sound now, with explicit seams where the `admin-security-hardening` change will plug in (2FA, more roles, audit log, session management, lockout, background jobs).
- A test harness that runs real-database tests, which inventory and checkout will rely on.

**Non-Goals:**
- Any storefront feature UI, design system, or branding beyond a minimal shell.
- Production infrastructure-as-code; apps only need to build to standard artifacts (container image for the API, Next build output for web/admin).
- Anything listed as deferred in the proposal.

## Decisions

### D1. Monorepo with pnpm workspaces + Turborepo
```
apps/
  web/        Next.js 16 storefront (App Router)
  admin/      Next.js 16 admin (App Router)
  api/        Fastify REST API
packages/
  db/         Prisma schema, migrations, seed, client export
  contracts/  Zod schemas + inferred types + role/permission map
  config/     tsconfig bases, ESLint flat config, Tailwind preset
docker-compose.yml   PostgreSQL 16 for local dev
```
- **Why**: Contracts and the Prisma client are shared across apps; changes spanning API + UI are common; Turborepo caches lint/typecheck/test/build.
- **Alternatives**: Separate repos (contract drift, cross-repo PRs); Nx (heavier than needed).

### D2. Fastify API as a modular monolith
- Module layout: `apps/api/src/modules/<name>/{routes,service,repository}.ts` + tests. Routes parse/serialize and call services; services own business rules and transactions; repositories are the only Prisma callers. Modules call each other only through exported service functions.
- Cross-cutting plugins in `src/plugins/`: `request-id`, `error-handler`, `security-headers`, `db` (Prisma client as `app.db`), `origin-check`, `admin-session`, and `authorize` (Section 6). Cookie parsing uses `@fastify/cookie`; CORS uses `@fastify/cors` inside the admin zone (D8). Login rate limiting is a small module utility, not a plugin (D11).
- Time-dependent logic (session expiry, rate-limit windows) reads an injectable `Clock` passed to `buildApp({ clock })`, so tests move time forward instead of waiting.
- Modules in this change: `health`, `admin-auth`, `staff`.
- **Why Fastify**: schema-driven validation/serialization, encapsulated plugins per route zone, `inject()` for in-process HTTP tests.
- **Alternatives**: Express (no built-in schema pipeline); NestJS (heavy for a small team); Next.js route handlers as the backend (couples API to the storefront deploy and blurs the REST boundary).

### D3. Zod contracts as the single source of truth
- `packages/contracts` exports Zod schemas per endpoint (params, query, body, response) plus primitives: `ProblemDetails`, `Money`, ids, timestamps, attribution fields. Bodies use `.strict()`.
- The API uses `fastify-type-provider-zod`; frontends import inferred types and a thin typed fetch helper.
- **Extension point**: OpenAPI can later be generated from these schemas without changing them; deferred until an external consumer needs it.
- **Alternatives**: OpenAPI-first with codegen (extra step for a TS-only team); tRPC (not REST).

### D4. Centralized errors
- A single Fastify error handler maps: Zod validation errors → `400` with `errors[]`; `DomainError(code, status, detail)` thrown by services → that status + `code`; not-found routes → `404`; everything else → generic `500`. All bodies are `application/problem+json` with `requestId`.
- Error codes live in `packages/contracts` (`ErrorCode` enum) so frontends can switch on them.

### D5. Environment configuration
- Each app has `src/env.ts` that parses `process.env` with a Zod schema at startup and exports a typed, frozen config. Failures print the variable name and failed rule, never the value, then exit non-zero.
- Next apps validate server variables at build/start time and expose only explicitly whitelisted `NEXT_PUBLIC_*` variables.
- `.env.example` documents every variable.
- The API's env parsing is reusable (`parseEnvWith(schema, source)`), so CLI commands validate only what they need (the bootstrap CLI needs `DATABASE_URL` only) with the same never-echo-values error format.

### D6. Route zones as encapsulated Fastify contexts
- `/api/v1/store` — public; no session plugin registered, so customer-auth code cannot appear by accident.
- `/api/v1/admin` — hooks run in this order: CORS (answers preflights) → `origin-check` (mutations) → `admin-session` (resolve cookie, then require a session and enforce the temporary-password gate) → `authorize` (permission checks, Section 6). The origin check runs first because it is cheap and needs no database access, so a cross-site mutation is rejected with `403` even when it carries no session. Routes opt out of the session requirement by declaring `config.permission: 'anonymous'` (login only), so one declaration drives both the session guard and `authorize`. They opt out of the temporary-password gate with `config.allowDuringPasswordChange` (me, logout, change-password).
- `/api/v1/webhooks` — registered empty, with raw-body parsing reserved for signature checks later.

### D7. Admin authentication: email + password, server-side sessions
- **Passwords**: argon2id (`@node-rs/argon2`) with 64 MiB memory, 3 passes, 1 lane, an RFC 9106 recommended profile that lands near 100 ms on typical servers. Each hash records its own parameters, so hashes made with other settings (e.g. the dev seed) still verify. A malformed stored hash never authenticates.
- **Uniform login failures**: unknown email, deactivated account, and wrong password each perform exactly one Argon2 verification (unknown and deactivated verify against a dummy hash created at startup with the same parameters) and return the same `401 INVALID_CREDENTIALS` body.
- **Sessions**: the cookie carries a 256-bit random token (base64url). `AdminSession.tokenHash` stores the hex HMAC-SHA-256 of the token keyed with `SESSION_SECRET`, not a plain SHA-256: a copy of the database alone cannot be matched against tokens, and `SESSION_SECRET` has a concrete purpose. Rotating `SESSION_SECRET` signs everyone out. The row also holds `adminUserId`, `createdAt`, `lastSeenAt`, `expiresAt` (`createdAt` + 12 h), and `revokedAt`, with times taken from the injected clock. Each admin request loads the session joined to the user. A revoked session, 30 min since `lastSeenAt`, reaching `expiresAt`, or a non-active user gives `401`, and an invalid cookie is cleared. `lastSeenAt` is written at most once per minute, so idle expiry can occur up to a minute early but never late. Logout sets `revokedAt` and clears the cookie. A login that presents an existing session revokes it, so sessions are replaced rather than accumulated.
- **Cookie**: `ite_admin_session`, `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age` 12 h, no `Domain` (host-only on the admin origin, see D8), and `Secure` unless `NODE_ENV=development`.
- **Temporary passwords**: `mustChangePassword` flag on `AdminUser`. The `admin-session` plugin (not `authorize`) returns `403 PASSWORD_CHANGE_REQUIRED` for every admin route except those marked `allowDuringPasswordChange` (me, logout, change-password). A successful change clears the flag and records the user as `updated_by`. A wrong current password gives `401 INVALID_CREDENTIALS`.
- **Bootstrap**: `pnpm --filter @ite/api admin:bootstrap-owner --email …` prompts for the password (hidden, with confirmation) on a terminal, or reads the first line of stdin when piped. The password is never accepted as an argument. It validates email and password with the shared contracts schemas. Inside a transaction holding a PostgreSQL advisory lock, so concurrent runs cannot both succeed, it refuses when any `AdminUser` exists and otherwise creates an active `OWNER` with null attribution.
- **Module layout**: `src/modules/admin-auth/` holds `password`, `session-token`, `rate-limit`, `repository` (the only Prisma caller), `service` (login, authenticate, logout, change password), `routes`, and `bootstrap`. The CLI entry point is `src/cli/bootstrap-owner.ts`.
- **Why server sessions over JWT**: deactivation must take effect immediately, and the hardening change will add per-session revocation. A session table supports both directly.
- **Extension points for `admin-security-hardening`**:
  - Login becomes two-step by issuing a pending-login state between password check and session creation. The session-creation function is the only place that changes.
  - `AdminSession` already has `revokedAt`, so session listing and revocation become new endpoints, not a schema change.
  - Lockout fields can be added to `AdminUser` in a new migration. Login rate limiting stays as the first layer.

### D8. Admin ↔ API topology and cross-site protection
- The admin app proxies `/api/*` to the API with a Next.js rewrite. The browser only ever talks to the admin origin, so the session cookie is host-only on that origin, admin mutations are same-origin `fetch` calls from client components, and no credentialed CORS is needed.
- Admin Server Components read data by calling the API server-to-server with the incoming cookie forwarded (GET only).
- `origin-check` rejects admin `POST/PUT/PATCH/DELETE` whose `Origin` is missing or not `ADMIN_ORIGIN` with `403 FORBIDDEN`. This includes login, which blocks login CSRF. Combined with SameSite=Strict, this replaces a synchronizer CSRF token for now. A token can be added later without changing the endpoints.
- CORS is decided per request: only a request whose `Origin` equals `ADMIN_ORIGIN` gets credentialed CORS headers, and any other origin gets none at all, not even `Access-Control-Allow-Credentials`, which static `@fastify/cors` options would still send.
- CORS exists only on the admin zone, in case a deployment calls the API directly. The store and webhooks zones send no CORS headers.
- When the admin app proxies to the API, every request reaches the API from the admin server. The API's `TRUST_PROXY` setting (Fastify `trustProxy`) lists the proxies allowed to set `X-Forwarded-For`: IPs, CIDRs, `loopback`/`linklocal`/`uniquelocal`, or an exact hop count. Unset trusts nothing, and blanket values such as `true` or `*` are rejected. `request.ip` (used by login rate limits) comes from the header only when the immediate peer is trusted.
- Next.js rewrites do not append to `X-Forwarded-For`; a client-supplied header passes through unchanged (verified against Next 16.3). So the admin's `proxy.ts` strips `X-Forwarded-For`, `X-Real-IP`, and `Forwarded` from `/api/*` requests unless the admin setting `TRUST_UPSTREAM_PROXY=true` says every request arrives through a reverse proxy that writes the header (load balancer, Vercel, nginx).
  - **With a trusted upstream proxy** (production): the header that reaches the API ends with the real client address, the API trusts the admin server's address, and each user is limited separately.
  - **Without one** (admin exposed directly, or local dev): the header is stripped, the API sees the admin server's address, and login limits are shared by everyone using the admin. They are coarser, but cannot be spoofed.
- **Alternative**: Admin talks to the API cross-origin on a shared parent-domain cookie. Rejected because it depends on the hosting topology and local dev is harder.

### D9. Authorization: permission map with two roles
- `packages/contracts` defines `Role = 'OWNER' | 'ADMIN'`, a `Permission` union, and `ROLE_PERMISSIONS`. In this change the permissions are `staff:read`, `staff:manage` (OWNER only), and `admin:access` (both roles). Feature changes add their own permissions to the map.
- `authorize` runs after `admin-session` in the admin zone (D6), so it always sees a resolved session and never handles the temporary-password gate.
- Each admin route declares `config: { permission: Permission | 'authenticated' | 'anonymous' }`. The `authorize` plugin's `onRoute` hook throws for any admin route without one, so the API refuses to start, and its `onRequest` hook checks named permissions against `ROLE_PERMISSIONS` before validation or the handler run (`403 FORBIDDEN`). CORS preflight (`OPTIONS`) routes are exempt. The plugin can record every admin route and its declaration in a registry, which the route-coverage test compares against an explicit expected table, so adding, removing, or weakening a declaration fails the test.
- Staff routes: `GET /staff` requires `staff:read`; `POST /staff`, `PATCH /staff/:id/role`, `POST /staff/:id/deactivate`, and `POST /staff/:id/reactivate` require `staff:manage`. Creation sets `mustChangePassword` and records the acting Owner in `created_by`/`updated_by`, with both timestamps taken from the injected clock. A duplicate email (compared by the `citext` unique index, so any letter case) gives `409 STAFF_EMAIL_EXISTS`, and an unknown id gives `404`. Deactivation also revokes the account's sessions in the same transaction, so a later reactivation never revives them.
- `Role` is a Postgres enum. Adding `MANAGER`, `FULFILLMENT` and `CONTENT` later is an enum migration plus map entries; no endpoint code changes.
- The last-OWNER rule runs inside a transaction that locks all active OWNER rows in id order (`SELECT … ORDER BY id FOR UPDATE`, which avoids deadlocks), then refuses a demotion or deactivation of an active OWNER when it is the only one (`409 LAST_OWNER`). Under READ COMMITTED, a transaction blocked on the lock re-reads the rows after the other commits, so it sees the reduced owner set and two concurrent demotions cannot both succeed. Over HTTP, the losing request may instead be stopped earlier with `403` or `401` if the winner already removed its role or session. Either way exactly one active OWNER remains.
- **Alternative**: Role checks (`if role === 'OWNER'`) in handlers. Rejected because adding a role would mean editing every handler.

### D10. Change attribution columns
- Convention for every admin-managed table: `createdAt timestamptz default now()`, `updatedAt timestamptz @updatedAt`, `createdById uuid null → admin_user`, `updatedById uuid null → admin_user`, mapped to `created_at`, `updated_at`, `created_by`, `updated_by`.
- Services receive an `actor` (staff id or `null` for system/bootstrap) and set `createdById`/`updatedById` explicitly. A small `withAttribution(actor, data)` helper in `packages/db` keeps this uniform.
- **Extension point**: the future immutable audit log hooks into the same `actor`-carrying service calls. Attribution columns stay as the cheap "last touched by" view.
- **Alternative**: Prisma client extension that injects the actor from async context automatically. It hides behavior and is harder to test, so it's postponed until there are many tables.

### D11. Rate limiting
- A small fixed-window `RateLimiter` (`src/modules/admin-auth/rate-limit.ts`) instead of `@fastify/rate-limit`. That library marks each request as already rate-limited, so a second limiter on the same request is skipped, and login needs two independent limits checked together. The custom limiter counts one attempt against several keys at once and rejects if any is over its limit. It reads the injectable clock, so window expiry is testable.
- In this change only `POST /api/v1/admin/auth/login` is limited: 10 per 15 min keyed by IP + lowercased email, and 50 per 15 min keyed by IP. Every attempt counts, including successful ones. The check runs in the route's `preHandler`, after body validation and before any database lookup or Argon2 work. Over the limit gives `429 RATE_LIMITED` with `Retry-After` (seconds until the longest exceeded window ends).
- **Extension point**: counters live behind a `RateLimitStore` interface, in memory today and lazily swept. A shared store (e.g. Redis) implements the same interface before the API scales horizontally (required before high-traffic drops). Other endpoints that need limits (order lookup, promo codes, checkout) reuse the same limiter.

### D12. Database conventions (Prisma)
- IDs: UUIDv7 generated in app (time-ordered for index locality, non-sequential to clients). Tables and columns are snake_case via `@@map`/`@map`. Timestamps are `timestamptz` UTC. Money columns (from catalog onward) are `Int` minor units plus `currency` char(3).
- `AdminUser`: id, email (citext, unique), passwordHash, role, status (`ACTIVE|DEACTIVATED`), mustChangePassword, plus attribution columns. `AdminSession` as in D7.
- Migrations via `prisma migrate`. CI applies them to a fresh database and runs `prisma migrate diff` to confirm the schema and migrations agree.

### D13. Frontends
- **web**: App Router, root layout, placeholder home, `not-found`, `error`; `src/features/` and server-only `src/lib/api/` client. No customer auth.
- **admin**: App Router with `(auth)/login`, `(app)/layout` (permission-aware nav; redirects to login on `401` and to change-password on `PASSWORD_CHANGE_REQUIRED`), `(app)/page` (empty dashboard placeholder), `(app)/staff` (OWNER), `(app)/account/password`, and a not-permitted page. Dynamic rendering only, `noindex`.
- Both apps use the Tailwind preset and set security headers in `next.config` `headers()`. The admin sets `frame-ancestors 'none'`. A full nonce-based CSP is deferred to hardening.

### D14. Testing & CI
- **Unit** (Vitest): env parsing, error mapping, permission map, attribution helper, password policy.
- **Integration** (Vitest + Testcontainers PostgreSQL + `fastify.inject`): each `#### Scenario:` in `specs/` maps to a test named after it. A Vitest global setup starts one PostgreSQL container per run and applies the Prisma migrations once. Each test that needs a database clones it with `CREATE DATABASE … TEMPLATE`, so tests are isolated without one container per file. Scenarios that must stop the database ("Database unavailable") start their own container. Timeouts and rate-limit windows use a fake clock. Process-level scenarios (startup env validation, the bootstrap CLI) spawn the real entry point.
- **Timing**: login timing equalization is checked by comparing median durations of unknown-email, wrong-password, and deactivated-account logins (within 2× of each other), a tolerance chosen to stay stable on shared CI machines.
- **Contract alignment**: because `@ite/contracts` cannot import `@ite/db`, an API test asserts that `Role` and `StaffStatus` match the Prisma `AdminRole` and `AdminStatus` enums.
- **Concurrency**: two parallel demotions of the last two Owners leave exactly one active Owner.
- **Authorization check**: a test enumerates registered admin routes and asserts each declares a permission and that `ADMIN` is denied every `staff:manage` route.
- **E2E** (Playwright, single smoke): bootstrap Owner → login → forced password change → create ADMIN → ADMIN denied staff page.
- **CI** (GitHub Actions): install → lint → typecheck → unit → integration → Prisma migrate check → build → Playwright smoke. The API test run needs a Docker daemon for Testcontainers.

## Risks / Trade-offs

- [Password-only admin login is weaker than 2FA] → Strong password minimum, login rate limiting, short idle timeout, secure cookies. TOTP is the first item in `admin-security-hardening`, which should ship before public launch.
- [No immutable audit trail; attribution only shows the latest editor] → Acceptable while staff is small and trusted. Services already carry `actor`, so the audit log can be added without changing call sites.
- [In-memory rate limiting does not hold across multiple API instances, and resets on restart] → Store is configurable. Redis is required before horizontal scaling.
- [Origin-check instead of CSRF tokens relies on browsers sending `Origin`] → All supported browsers send `Origin` on non-GET requests, and a missing `Origin` is rejected. SameSite=Strict adds a second layer.
- [Owners set temporary passwords and share them out-of-band] → Forced change at first login. The invitation flow replaces this in hardening.
- [Behind the admin proxy, all requests share the proxy's IP, so per-IP login limits would become one global limit] → Configure `trustProxy` for the admin proxy in task 7.1, and cover it with a test that the client IP is used.
- [Password hashes made with older Argon2 parameters are not upgraded] → They still verify. Re-hashing on successful login can be added in hardening without schema changes.
- [Rotating `SESSION_SECRET` invalidates every session, because token hashes are keyed with it] → Acceptable and occasionally useful (forced global sign-out). Rotation is documented as an operational action.
- [Next.js 16 is recent; libraries may lag] → Keep admin dependencies minimal and pin versions.

## Migration Plan

Greenfield, so there is no data migration. First deployment:
1. Provision PostgreSQL and set environment variables per `.env.example`.
2. Run `prisma migrate deploy`.
3. Deploy the API and verify `/ready`.
4. Run the bootstrap command to create the first Owner.
5. Deploy admin (with `/api` rewrite to the API) and web.

Rollback: redeploy previous artifacts. Before go-live, dropping the database is an acceptable rollback.

## Open Questions

- Hosting target (e.g. Vercel + container host, or all containers). This only affects deployment config and the rewrite target URL.
- Production timing of `admin-security-hardening` relative to public launch. It doesn't change this change's scope.
