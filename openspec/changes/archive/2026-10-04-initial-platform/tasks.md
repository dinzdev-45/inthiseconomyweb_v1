# Tasks

## 1. Monorepo scaffolding

- [x] 1.1 Initialise pnpm workspace with `apps/*` and `packages/*`, root `package.json`, `.nvmrc` (Node LTS), `.gitignore`, `.editorconfig`; verify `pnpm install` succeeds on a clean clone
- [x] 1.2 Add Turborepo with `lint`, `typecheck`, `test`, `build`, `dev` pipelines; verify `pnpm turbo run typecheck` runs across all workspaces
- [x] 1.3 Create `packages/config` with strict tsconfig bases, ESLint flat config (apps may not import each other), Prettier, and Tailwind preset; verify `pnpm lint` passes and a deliberate cross-app import fails lint
- [x] 1.4 Add `docker-compose.yml` with PostgreSQL 16 and a named volume; verify `docker compose up -d` starts it and `psql` connects with the credentials in `.env.example`

## 2. Database package

- [x] 2.1 Create `packages/db` with Prisma, UUIDv7 id helper, snake_case mapping conventions, and the `withAttribution(actor, data)` helper; verify `prisma validate` passes and a unit test covers the helper for staff and `null` actors
- [x] 2.2 Model `AdminUser` (email citext unique, passwordHash, role enum OWNER/ADMIN, status ACTIVE/DEACTIVATED, mustChangePassword, created_at, updated_at, created_by, updated_by) and `AdminSession` (tokenHash, adminUserId, createdAt, lastSeenAt, expiresAt, revokedAt); verify the migration applies to a fresh database
- [x] 2.3 Add a dev seed (one OWNER, one ADMIN with known dev passwords) that refuses to run when `NODE_ENV=production`; verify `pnpm db:seed` works locally and exits with an error in production mode

## 3. Contracts package

- [x] 3.1 Create `packages/contracts` with primitives `ProblemDetails`, `ErrorCode`, `Money`, id, ISO timestamp, and attribution fields; verify unit tests for each schema's accept/reject cases
- [x] 3.2 Define `Role`, `Permission`, and `ROLE_PERMISSIONS` (OWNER: `admin:access`, `staff:read`, `staff:manage`; ADMIN: `admin:access`); verify a unit test asserts each role's exact permission set
- [x] 3.3 Define strict schemas for admin auth (login, me, logout, change-password) and staff (list, create, change role, deactivate, reactivate) endpoints; verify types compile from a consumer in `apps/admin`

## 4. API skeleton and cross-cutting plugins

- [x] 4.1 Create `apps/api` Fastify app with Zod-validated `env.ts`, pino logging with redaction of cookies, authorization headers, and password fields, and graceful shutdown; verify the "Missing required variable" and "Secret not echoed" scenario tests
- [x] 4.2 Implement `request-id` plugin; verify the "Generated request id" scenario test and a test reusing a client-supplied id
- [x] 4.3 Implement the central `error-handler` and `DomainError`; verify "Unhandled server error", "Domain error", and "Unknown route" scenario tests
- [x] 4.4 Wire the Zod type provider so routes validate params/query/body and serialize responses; verify "Invalid body" and "Unknown property" scenario tests
- [x] 4.5 Register `/api/v1/store`, `/api/v1/admin`, `/api/v1/webhooks` as encapsulated contexts; verify the "Store zone is public" scenario with a test-only store route and "Admin zone without session" with a test-only admin route
- [x] 4.6 Implement security headers and CORS (admin origin only, credentialed); verify header presence tests and the "Foreign origin calls admin zone" scenario
- [x] 4.7 Implement `/health` and `/ready`; verify the "Database unavailable" scenario by stopping the test container
- [x] 4.8 Verify money and id conventions with the "Money in a response" (contracts schema test) and "Non-sequential identifiers" (two created staff ids) scenario tests

## 5. Admin authentication

- [x] 5.1 Implement password hashing (argon2id), 12-character minimum, and dummy-hash timing equalization; verify "Weak password rejected" and "Hash only" scenario tests
- [x] 5.2 Implement `POST /api/v1/admin/auth/login` creating a session and setting the cookie; verify "Successful login", "Wrong password", "Unknown email" (same body and status, comparable timing), "Deactivated account", and "Cookie attributes" scenario tests
- [x] 5.3 Configure login rate limits (IP + email, and IP) applied before credential checks; verify "Too many attempts" and "Limit window passes" scenario tests
- [x] 5.4 Implement the `admin-session` plugin with idle (30 min) and absolute (12 h) expiry and a deactivated-user check, using an injectable clock; verify "Idle timeout", "Absolute timeout", and "Deactivated during session" scenario tests
- [x] 5.5 Implement the `origin-check` plugin for admin mutations; verify the "Cross-site mutation" scenario test
- [x] 5.6 Implement `GET /admin/auth/me` (profile, role, permissions) and `POST /admin/auth/logout`; verify "Role permissions are resolvable" and "Logout" scenario tests
- [x] 5.7 Implement `POST /admin/auth/change-password` and the `PASSWORD_CHANGE_REQUIRED` gate; verify "Change password", "Wrong current password", and "Temporary password must be changed" scenario tests
- [x] 5.8 Implement the `admin:bootstrap-owner` CLI command; verify "Bootstrap on empty system", "Bootstrap after setup", and "Bootstrap attribution" scenario tests

## 6. Authorization and staff management

- [x] 6.1 Implement the `authorize` plugin, which requires a permission declaration on every admin route and enforces it per request; verify "Undeclared permission", "Insufficient role", and "Sufficient role" scenario tests
- [x] 6.2 Implement staff list and create (temporary password, `mustChangePassword`, case-insensitive email uniqueness, attribution); verify "Create staff account", "Duplicate email", and "Attribution on create" scenario tests
- [x] 6.3 Implement change role, deactivate, and reactivate with attribution; verify "Change role", "Deactivate staff", and "Attribution on update" scenario tests
- [x] 6.4 Enforce the last-OWNER rule with a row lock inside a transaction; verify the "Last owner protected" scenario, including two concurrent demotions of the last two Owners leaving exactly one active
- [x] 6.5 Add a route-enumeration test asserting every admin route declares a permission and that `ADMIN` is denied every `staff:manage` route; verify it fails when a declaration is removed

## 7. Admin app

- [x] 7.1 Scaffold `apps/admin` (Next.js 16, App Router, Tailwind preset, `noindex`, validated env, `/api/*` rewrite to the API, security headers with `frame-ancestors 'none'`), and configure the API's Fastify `trustProxy` for this proxy topology (design D8): add a validated API env setting naming the trusted proxy addresses/CIDRs (or exact hop count), defaulting to trusting nothing, so `request.ip` resolves to the real client IP from `X-Forwarded-For` only when the request arrives from a trusted proxy and per-IP login rate limits do not treat every admin user as the proxy's IP; never trust forwarded headers from arbitrary sources; verify `pnpm --filter admin build` succeeds, the "Admin page framed" scenario via a header check, and API tests showing that a request from a trusted proxy address resolves `X-Forwarded-For` to the client IP (and is rate-limited per client), while the same header from an untrusted address is ignored
- [x] 7.2 Build a server-only API helper that forwards the session cookie for GETs, and a client-side fetch helper for same-origin mutations that maps problem+json to typed errors; verify unit tests with mocked fetch
- [x] 7.3 Build the login page and authenticated layout (redirect to login on `401`, to change-password on `PASSWORD_CHANGE_REQUIRED`), plus logout; verify manually against local API and in the E2E smoke test
- [x] 7.4 Build permission-aware navigation, a "not permitted" page, the staff management page (list, create, change role, deactivate/reactivate), and the change-password page; verify the "Direct navigation without permission" scenario in the E2E smoke test

## 8. Storefront shell

- [x] 8.1 Scaffold `apps/web` (Next.js 16, App Router, Tailwind preset, validated env, security headers) with root layout, placeholder home, `not-found`, and `error` pages; verify `pnpm --filter web build` succeeds
- [x] 8.2 Add a server-only typed store API client and a `src/features/` folder with a README describing the feature-folder convention; verify the home page renders when the API is up and the error page when it is down

## 9. CI and verification

- [x] 9.1 Add the GitHub Actions workflow (install → lint → typecheck → unit → integration with a Postgres service → Prisma migrate check → build → Playwright smoke); verify a PR run is green
  - Recorded 2026-10-04: first GitHub Actions run green — run 37192231681 (`push` to `main`, commit `dbf119d`, identical to the working tree): install, lint, typecheck, unit and integration tests, Prisma migration check, build, OpenSpec scenario coverage, admin E2E, and storefront E2E all succeeded. The workflow also runs on pull requests; this first run was a push.
- [x] 9.2 Write the Playwright smoke test: bootstrap Owner → login → forced password change → create ADMIN → ADMIN signs in, changes password, and is denied the staff page; verify it passes in CI
  - Recorded 2026-10-04: the admin E2E smoke step passed in run 37192231681.
- [x] 9.3 Add a spec-coverage script that checks every `#### Scenario:` in this change's specs has a test with a matching name; verify it reports zero missing scenarios
- [x] 9.4 Write `README.md` (prerequisites, Docker Postgres, env setup, scripts, bootstrap) and fill `openspec/config.yaml` project context (stack, conventions, deferred `admin-security-hardening` items); verify a fresh clone can follow the README to a logged-in admin
