# InThisEconomy

Fashion e-commerce platform: a guest-checkout storefront, a staff admin, and a REST API.
Customers never have accounts (no login, registration, or wishlist); only staff sign in, to the admin.

| Path                 | What it is                                                                 | Dev URL               |
| -------------------- | -------------------------------------------------------------------------- | --------------------- |
| `apps/api`           | Fastify REST API (`/api/v1/store`, `/api/v1/admin`, `/api/v1/webhooks`)    | http://127.0.0.1:4000 |
| `apps/admin`         | Next.js 16 staff admin; proxies `/api/*` to the API                        | http://localhost:3001 |
| `apps/web`           | Next.js 16 storefront shell; calls the API server-side                     | http://localhost:3000 |
| `packages/db`        | Prisma schema, migrations, dev seed, client                                |                       |
| `packages/contracts` | Zod request/response schemas, roles and permissions (shared, browser-safe) |                       |
| `packages/config`    | Shared TypeScript, ESLint, Prettier, and Tailwind presets                  |                       |
| `openspec/`          | Specs, design, and tasks (spec-driven development)                         |                       |

## Prerequisites

- **Node.js 22** (see `.nvmrc`; 22.13 or newer).
- **pnpm 12** via Corepack, pinned in `package.json`. Run once: `corepack enable`.
- **Docker**: [OrbStack](https://orbstack.dev) or Docker Desktop. It's used for the local PostgreSQL and by the API's integration tests (Testcontainers), so it must be running for `pnpm test`.
- **Google Chrome** for local E2E runs (CI installs Playwright's Chromium instead).

## First-time setup

```sh
corepack enable
pnpm install --frozen-lockfile

cp .env.example .env              # local-only values; see "Environment" below
docker compose up -d              # PostgreSQL 16 on localhost:5433

pnpm --filter @ite/db db:deploy   # apply migrations
pnpm db:seed                      # generates the Prisma client, then creates dev staff accounts
```

The dev seed creates one OWNER and one ADMIN with **local-only** passwords. They're listed in `packages/db/src/seed/dev-admins.ts`, and the seed refuses to run when `NODE_ENV=production`. To start from an empty database instead, skip the seed and bootstrap an Owner (below).

## Run

```sh
pnpm dev                          # API, admin, and storefront together (Turborepo)
```

Or one at a time:

```sh
pnpm --filter @ite/api dev        # http://127.0.0.1:4000  (/health, /ready)
pnpm --filter @ite/admin dev      # http://localhost:3001
pnpm --filter @ite/web dev        # http://localhost:3000
```

Sign in to the admin at http://localhost:3001/login with a seeded account, or with the Owner you bootstrap.

### Bootstrap the first Owner

Only works while there are no staff accounts. The password is prompted for (hidden), never passed as an argument:

```sh
pnpm admin:bootstrap-owner --email owner@example.com
```

## Environment

All apps read the repo-root `.env` in development. Deployments set variables directly. Every app validates its variables at startup and exits with a message naming the bad variable, never its value.

| Variable                                | Used by        | Notes                                                                                                                                                                                          |
| --------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | api, db        | `postgresql://…`; must match `docker-compose.yml` locally                                                                                                                                      |
| `SESSION_SECRET`                        | api            | ≥ 32 chars; keys session-token hashes. Generate with `openssl rand -base64 48`. Rotating it signs every staff member out.                                                                      |
| `ADMIN_ORIGIN`                          | api            | Admin origin (`scheme://host[:port]`, no slash). The only origin allowed on `/api/v1/admin`.                                                                                                   |
| `TRUST_PROXY`                           | api            | Proxies allowed to set `X-Forwarded-For` (IPs, CIDRs, `loopback`, or a hop count). Unset trusts nothing.                                                                                       |
| `API_URL`                               | admin, web     | Server-side API base URL, e.g. `http://127.0.0.1:4000`. It's baked into the admin's `/api` rewrite at build time, so rebuild after changing it.                                                |
| `TRUST_UPSTREAM_PROXY`                  | admin          | Default `false`: the admin strips forwarded-IP headers before proxying to the API. Set `true` only when every request reaches the admin through a reverse proxy that writes `X-Forwarded-For`. |
| `PORT`, `HOST`, `LOG_LEVEL`, `NODE_ENV` | api            | Optional; defaults 4000, 0.0.0.0, info, development.                                                                                                                                           |
| `POSTGRES_*`                            | docker compose | Local container credentials and host port (default 5433).                                                                                                                                      |

## Tests and checks

```sh
pnpm lint                         # ESLint (incl. the no-cross-app-imports rule)
pnpm typecheck
pnpm test                         # unit + integration (API tests start PostgreSQL via Testcontainers)
pnpm db:check                     # apply migrations to DATABASE_URL and fail on schema drift
pnpm spec:coverage                # every OpenSpec scenario (active changes + main specs) has a test with the same name
pnpm e2e                          # Playwright smoke: recreates the ite_e2e database, starts API :4100 + admin :3101
pnpm format:check
```

`pnpm spec:coverage` with no arguments checks every active change under `openspec/changes/` and every main spec under `openspec/specs/`. Pass targets to narrow it: a change name, `specs` (all main specs), or `specs/<capability>`. Once a change is archived its scenarios are checked through the main specs it was synced into.

`pnpm db:check` runs `prisma migrate deploy` against `DATABASE_URL`. Point it at a fresh database to verify the migration history from scratch, as CI does.

CI (`.github/workflows/ci.yml`) runs install → lint → typecheck → test → migration check → build → spec coverage → E2E on every pull request.

## Build

```sh
pnpm build                        # Next.js production builds for admin and web (needs API_URL)
pnpm --filter @ite/api start      # the API runs its TypeScript directly on Node 22
```

## Database

```sh
pnpm db:migrate                   # create/apply a migration in development (prisma migrate dev)
pnpm --filter @ite/db db:deploy   # apply committed migrations
pnpm --filter @ite/db generate    # regenerate the Prisma client (also runs before typecheck/test/build)
```

Conventions: snake_case tables and columns, UUIDv7 ids, `timestamptz` in UTC, and `created_at`/`updated_at`/`created_by`/`updated_by` on admin-managed records. See `packages/db/prisma/schema.prisma`.

## Troubleshooting

- **`pnpm: command not found`** → run `corepack enable` (pnpm comes from Corepack).
- **`Cannot connect to the Docker daemon`**, or the API tests fail in `globalSetup` → start OrbStack/Docker.
- **Port 5432 already in use** → that's a locally installed PostgreSQL; this project's container uses host port **5433** (`POSTGRES_PORT`).
- **`Invalid environment configuration: SESSION_SECRET: is required`** (or similar) → copy any missing lines from `.env.example` into `.env`.
- **`Cannot find module './generated/prisma/client.ts'`** → `pnpm --filter @ite/db generate` (or any `pnpm typecheck`/`test`/`build`).
- **`PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`** → `.env` is missing or lacks `DATABASE_URL`.
- **`Staff accounts already exist; refusing to bootstrap`** → expected once anyone exists; use an existing Owner.
- **Admin `/api` calls go to the wrong API** → `API_URL` is fixed at build time; rebuild the admin.
- **pnpm "Ignored build scripts"** → only approved packages may run install scripts (`allowBuilds` in `pnpm-workspace.yaml`).

## Project notes

- Planning lives in `openspec/`. Implement from a change's `tasks.md`, and keep `design.md` in step with what's built.
- Deferred to a later `admin-security-hardening` change: TOTP 2FA, recovery codes, staff invitations, more roles, an immutable audit log, session listing and revocation, and lockout policies.
