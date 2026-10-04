# Design

## Context

The platform from `initial-platform` provides:
- a Fastify modular monolith (`apps/api/src/modules/<name>/{routes,service,repository}.ts`)
- admin zones with origin-check, then session, then `authorize` (every admin route declares `config.permission`; a route-coverage test lists all admin routes)
- problem+json errors through `DomainError(code, status, detail)`
- the injectable `Clock`, and `withAttribution(actor, data, op)`
- Prisma 7 with the `pg` adapter, UUIDv7 ids, snake_case mapping, and Testcontainers integration tests with per-file template databases

Products currently exist only as storefront placeholders (`apps/web/src/features/home/content.ts`) with presentation view models (`ProductSummary`, `Money` prices in IDR minor units). Requirements are in `specs/`; motivation and scope are in `proposal.md`.

## Goals / Non-Goals

**Goals:**
- A product domain whose invariants hold in the database, not only in the API: uniqueness, non-negative money and stock, and one primary image.
- Admin endpoints that later admin UI, storefront mapping, and commerce changes can build on without reshaping data.
- Concurrency-safe stock and lifecycle operations from day one.

**Non-Goals:**
- Public or storefront endpoints, and admin UI.
- Media upload and storage, CDN, and image processing.
- An inventory ledger, reservations, multi-location stock, cart, checkout, and orders.
- Full-text search, faceting, and multi-currency pricing.

## Decisions

### D1. Data model (Prisma, one migration `add_product_domain`)

```
Category      id uuid PK · name · slug UNIQUE · status (ACTIVE|ARCHIVED) · attribution
Size          id uuid PK · code UNIQUE (normalized uppercase) · label · sort_order int · attribution
Color         id uuid PK · name · slug UNIQUE · hex char(7) NULL · attribution
Product       id uuid PK · name · slug UNIQUE · description text NULL · status (DRAFT|ACTIVE|INACTIVE|ARCHIVED)
              category_id FK → categories (RESTRICT) · base_price_amount int CHECK 0..2e9 · currency char(3)
              activated_at timestamptz NULL · attribution
ProductVariant id uuid PK · product_id FK (RESTRICT) · size_id FK (RESTRICT) · color_id FK (RESTRICT)
              sku UNIQUE · price_override_amount int NULL CHECK 0..2e9 · stock_quantity int NOT NULL DEFAULT 0 CHECK ≥ 0
              status (ACTIVE|INACTIVE) · attribution · UNIQUE(product_id, size_id, color_id)
ProductImage  id uuid PK · product_id FK (CASCADE) · variant_id FK NULL (SET NULL) · url · alt · sort_order int
              is_primary bool · attribution · UNIQUE (product_id) WHERE is_primary   ← partial unique index
```
- **Attribution:** `created_at`, `updated_at`, `created_by`, `updated_by` on every table, per the `withAttribution` convention, with timestamps from the injected clock.
- **Indexes:**
  - `products(status, created_at DESC, id DESC)` for the default list
  - `products(category_id)`, `product_variants(product_id)`, `product_images(product_id, sort_order)`
  - the uniques above
- **Money:** amounts are `Int` minor units. The maximum, 2,000,000,000 minor units (Rp 20,000,000 in IDR), is a **business limit** defined in the product-management spec: the highest price one catalog item may have in this version, chosen to catch entry errors such as extra zeros. It applies to base prices and overrides, and is enforced in the contracts (`Price`) and by a database `CHECK` (`<= 2000000000`) next to the non-negative check. That it also fits Postgres `integer` is convenient, not the reason. Raising the limit is a spec change; storage would move to `BigInt` only if a future limit exceeded `integer`. The currency lives on the product (`currency char(3)`), and a variant's override is in the product's currency (no column on the variant). That keeps one currency per product while allowing a future multi-currency change.
- **No citext:**
  - Slugs are validated as lowercase.
  - SKUs and size codes are normalized to uppercase before storage.
- **Sizes are master data, not an enum:** any sizing system (letters such as `S`–`XXL` and `OS`, numeric waists such as `28`–`34`, or combined codes such as `30/32` and `EU-42`) is rows in `sizes`, with a generic code pattern, a human label, and an explicit `sort_order`, because numeric and letter codes don't sort meaningfully by value. No measurement tables in this change; a future fit or size-guide change can attach measurements to `sizes` by id.
  - Case-insensitive uniqueness therefore holds with plain unique indexes, and the database stays readable and portable. citext stays limited to admin emails.
- **Raw SQL in the migration:**
  - `CHECK` constraints (`base_price_amount BETWEEN 0 AND 2000000000`, `price_override_amount BETWEEN 0 AND 2000000000`, `stock_quantity >= 0`) and the partial unique index, since Prisma cannot express them.
  - `prisma migrate diff` ignores them, so `db:check` still passes. A test asserts that they exist and reject bad writes.
- **No hard delete:**
  - Products, variants, and categories have no delete endpoint; foreign keys use `RESTRICT`.
  - Images can be deleted (metadata only, no history value).
  - Sizes and colors can be deleted only when unreferenced (enforced by the FK plus a friendly `409 IN_USE`).

### D2. Store currency
- `STORE_CURRENCY` is added to the API env schema: an ISO 4217 code (`^[A-Z]{3}$`), default `IDR`.
- Every incoming `Money` must use it, otherwise `422 CURRENCY_MISMATCH`. Responses echo the stored currency.
- Changing markets later means changing the setting before any products exist, or a dedicated migration change.
- **Alternative:** per-request currency with multi-currency prices. Rejected: there is no market decision yet, and it would complicate every price rule.

### D3. Lifecycle and readiness
- Status transitions are explicit action endpoints (not `PATCH status`), consistent with `initial-platform`'s convention for state changes.
- **Activation readiness** (all required): category `ACTIVE`; at least one `ACTIVE` variant; at least one `ACTIVE` variant with `effectivePrice > 0`; at least one image; exactly one primary image. A failure returns `409 PRODUCT_NOT_READY`, whose `detail` lists every unmet condition in plain text.
  - The primary-image check is explicit even though the partial unique index and the image service already guarantee "at most one" and "one when any exist". It catches data written outside the API, such as manual SQL or imports.
- **Readiness kept while `ACTIVE`:** deactivating the last qualifying variant (`409 LAST_ACTIVE_VARIANT`) and deleting the last image (`409 LAST_IMAGE`) are rejected. Primary promotion on delete keeps "exactly one primary".
- **Serialization:** activation, product deactivation, variant deactivation, variant price changes, image deletion and primary changes, and category archiving lock the affected rows with `SELECT … FOR UPDATE`, in a fixed order (category, then product, then variants). The readiness invariant ("an `ACTIVE` product always has a qualifying variant") is therefore checked and changed atomically, without deadlocks. This is the same pattern as the last-OWNER rule.
- **`activated_at`:** set on the first activation and never cleared. It drives the slug and SKU locks. It's exposed as `activatedAt` (useful later for "new arrivals").
- **Archived products:** read-only; edits return `409 INVALID_STATE_TRANSITION` until restored. Restoring goes to `INACTIVE`, never straight to `ACTIVE`, so a person re-checks the product before it goes live.

### D4. Slugs and SKUs
- **`slugify(name)`** is local in `apps/api/src/modules/catalog/slug.ts`:
  - NFKD-normalize, then strip diacritics, then lowercase.
  - Replace runs of non-`[a-z0-9]` with `-`, then trim dashes and cut to 80 characters (avoiding a trailing dash).
  - An empty result falls back to `product`, `category`, or `color`.
- **Generated slugs** pick the smallest free `-N` suffix, using one query over `slug LIKE 'base%'`. On a unique violation from a concurrent insert, it retries once with the next suffix.
- **Explicit slugs** never get a suffix: a collision returns `409 SLUG_EXISTS`, mapped from the unique violation (P2002), so concurrent creation is safe by construction.
- **Locks:** slug and SKU changes after `activated_at` return `409 SLUG_LOCKED` / `SKU_LOCKED`. A future redirect table can relax the slug lock without breaking links.

### D5. Stock adjustments (single choke point)
- `POST …/variants/:variantId/stock-adjustments { delta }` runs a single statement:
  `UPDATE product_variants SET stock_quantity = stock_quantity + $delta, updated_by = $actor, updated_at = $now WHERE id = $id AND stock_quantity + $delta >= 0 RETURNING stock_quantity`
  - No row returned means either `NOT_FOUND` (distinguished by a follow-up existence check) or `409 INSUFFICIENT_STOCK`.
  - The row-level write lock makes concurrent adjustments serialize, without lost updates or read-modify-write races.
- **Stock is not editable via `PATCH`.** It is set only at variant creation and through adjustments, so a later change can add an `inventory_movements` ledger (reason, actor, delta, resulting quantity) and reservations in this one function without touching callers.
- **Alternative:** optimistic concurrency with an `expectedQuantity` on an absolute set. Rejected for now: deltas are what restocks and corrections naturally are, and they compose safely.

### D6. Images (metadata only)
- `url`: an `https://` URL or a root-relative path (`/…`), at most 2048 characters. `alt` is required (1–300 characters); decorative product images are not a valid case.
- **Zero images are allowed** for `DRAFT`, `INACTIVE`, and `ARCHIVED` products. `ACTIVE` products always have at least one, enforced by activation readiness and `409 LAST_IMAGE`.
- **Primary invariant** ("when there are images, exactly one is primary"):
  - The database's partial unique index guarantees at most one.
  - The service guarantees one whenever images exist, inside one transaction holding the product row lock: the first image is primary; setting a new primary unsets the old one, then sets the new one; deleting the primary promotes the next by `sortOrder`.
  - Readers never see zero or two primaries for a product that has images.
- New images get the next `sortOrder`. `PUT /products/:id/images/order { imageIds }` must be an exact permutation of the product's image ids, and rewrites sort orders 0..n-1 in one transaction.
- Upload, storage, and `next/image` remote patterns are deferred. URLs are stored as given.

### D7. API surface (`/api/v1/admin`, all JSON camelCase, strict bodies)

| Method & path | Permission | Notes |
|---|---|---|
| `GET /categories` · `POST /categories` | read · manage | `?status=` filter |
| `GET /categories/:id` · `PATCH /categories/:id` | read · manage | name, slug |
| `POST /categories/:id/archive` · `/restore` | manage | `409 IN_USE` if it has active products |
| `GET /sizes` · `POST /sizes` · `PATCH /sizes/:id` · `DELETE /sizes/:id` | read · manage | |
| `GET /colors` · `POST /colors` · `PATCH /colors/:id` · `DELETE /colors/:id` | read · manage | |
| `GET /products` | read | `?status=&categoryId=&q=&limit=&cursor=` → `{ data: ProductListItem[], nextCursor }` |
| `POST /products` · `GET /products/:id` · `PATCH /products/:id` | manage · read · manage | `ProductDetail` responses |
| `POST /products/:id/activate` · `/deactivate` · `/archive` · `/restore` | manage | lifecycle (D3) |
| `POST /products/:id/variants` · `PATCH /products/:id/variants/:variantId` | manage | size, color, sku, priceOverride (or `null`) |
| `POST /products/:id/variants/:variantId/activate` · `/deactivate` | manage | `409 LAST_ACTIVE_VARIANT` |
| `POST /products/:id/variants/:variantId/stock-adjustments` | manage | `{ delta }` → `{ stockQuantity }` |
| `POST /products/:id/images` · `PATCH /products/:id/images/:imageId` · `DELETE /products/:id/images/:imageId` | manage | |
| `PUT /products/:id/images/order` | manage | `{ imageIds }` |

- Nested routes check that the child belongs to the parent product (otherwise `404`).
- `GET` routes also get Fastify's automatic `HEAD` routes, which are listed in the route-coverage table.
- **Cursor pagination:** a shared helper encodes `(createdAt, id)` as base64url JSON, with an HMAC (keyed by `SESSION_SECRET`) so tampered cursors are rejected with `400`. The helper is reusable by later list endpoints. `initial-platform` deferred pagination "to the first change that needs it", which is this one.
- **New error codes** in `ErrorCode`: `SLUG_EXISTS`, `SLUG_LOCKED`, `SKU_EXISTS`, `SKU_LOCKED`, `CODE_EXISTS`, `VARIANT_EXISTS`, `VARIANT_MISMATCH`, `UNKNOWN_REFERENCE`, `IN_USE`, `INVALID_STATE_TRANSITION`, `PRODUCT_NOT_READY`, `LAST_ACTIVE_VARIANT`, `INSUFFICIENT_STOCK`, `CURRENCY_MISMATCH`, `IMAGE_LIMIT`, `LAST_IMAGE`. Statuses: `409` for conflicts with existing state, `422` for semantically invalid references or currency, `400` for schema violations.

### D8. Contracts (`packages/contracts/src/catalog.ts`)
- **Primitives:** `Slug`, `Sku`, `SizeCode` (trim plus uppercase, then the generic pattern, at most 12 characters), `HexColor`, `ProductStatus`, `VariantStatus`, `CategoryStatus`, and `Price` (a `Money` with `amount` an integer from 0 to 2e9).
- **Responses:** `Category`, `Size`, `Color`, `ProductImage`, `ProductVariant` (`priceOverride: Money | null`, `effectivePrice: Money`, `stockQuantity`), `ProductListItem`, `ProductDetail`, `Paginated(ProductListItem)`, `StockAdjustmentResult`. Each spreads `AttributionFields`.
- **Requests:** strict create and update bodies for each resource; update bodies are partial with at least one field.
- **Kept out of responses:** raw `*_amount` columns, `currency` as a separate field (always inside `Money`), and any database-only fields.
- **Server-side checks:** the response schemas also validate on the server (`fastify-type-provider-zod` serializer), so a leaked internal field is a `500` in tests, not a silent exposure.
- **Storefront unchanged:** `apps/web`'s view models stay as they are. A later change maps `ProductDetail` and `ProductListItem` into them.

### D9. Permissions
- `Permission` gains `catalog:read` and `catalog:manage`, and both roles get both. The ADMIN definition ("everything except staff management") stays true. The existing `ROLE_PERMISSIONS` and contract-alignment tests are updated, and the route-coverage `EXPECTED` table gains every new route.
- **Alternative:** finer permissions (`inventory:adjust`, `pricing:manage`). Deferred until the four-role matrix in `admin-security-hardening`, which can split them without endpoint changes.

### D10. Modules and testing
- **Code layout:**
  - `apps/api/src/modules/catalog/` with sub-areas `reference` (categories, sizes, colors), `products`, `variants`, and `images`. Each has routes, service, and repository, sharing `slug.ts`, `money.ts` (currency check, effective price), and `errors.ts`.
  - Routes are registered in the admin zone from `buildApp`.
- **Tests:** integration tests on per-file template databases, named exactly after the spec scenarios. Concurrency tests cover:
  - 15 parallel `-1` adjustments on stock 10
  - parallel same-slug creates
  - activation racing last-variant deactivation, repeated over several rounds
- **Migration verification:** `pnpm db:check` on a fresh database, plus a test that inserts negative amounts and stock and a second primary image directly with SQL, and expects constraint violations.
- **Dev seed:** extends `packages/db` seed (idempotent, upserts by code, slug, or SKU) with example sizes (`XS`–`XXL`, `OS`, and waists `28`–`34`, each with an explicit sort order), eight colors from the brand palette's neutrals, the category "Apparel", and the homepage's placeholder products (four `ACTIVE`, the rest `DRAFT`) with variants and stock. Active seed products get one primary image record each (a root-relative placeholder path; files are not stored by this change), so they satisfy activation readiness. Production seeding remains admin-driven.

## Risks / Trade-offs

- [Slug and SKU locks frustrate typo fixes after launch] → Locks apply only after first activation. A redirect-table change can lift the slug lock later. SKUs should be right before selling.
- [The Rp 20,000,000 per-item maximum (a business limit) may someday be too low, e.g. for collaborations or archive pieces] → Raising it is a spec change. Storage would move to `BigInt` only if a new limit exceeded `integer`.
- [Raw-SQL constraints are invisible to Prisma] → They're documented in the schema comments and in the migration, and covered by a constraint test, so drift is caught.
- [No stock history until the ledger change] → All stock changes flow through one function, so adding the ledger is local. `updatedBy` and `updatedAt` record the last adjuster in the meantime.
- [Image URLs are unvalidated beyond their format] → Admin-only input. Allowed hosts are decided with the media/storage change before the storefront renders them through `next/image`.
- [`FOR UPDATE` on product rows serializes edits to the same product] → Contention is negligible for admin traffic. Stock adjustments lock only the variant row.

## Migration Plan

One additive migration (new tables, enums, constraints, indexes) with no changes to existing tables. Deploy with `prisma migrate deploy`, then the API. Rollback: redeploy the previous API (the new tables are unused by it), and optionally drop the new tables. No data backfill.

## Open Questions

- The final market and currency. `STORE_CURRENCY` defaults to `IDR` until decided, and changing it requires no products to exist yet.
- The media storage host, which decides the `https://` URL allowlist. It's deferred to the media change and doesn't affect this change's scope.
