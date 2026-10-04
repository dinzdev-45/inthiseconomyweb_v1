# Proposal

## Why

Every product on the storefront today is placeholder data in `apps/web` (`features/home/content.ts`). Admin product management, the catalog, product detail, collections and drops, inventory, and later cart and checkout all need a real product domain: products with variants, prices, stock, images, and categories, stored in PostgreSQL with enforced invariants. This change builds that domain and its admin API first, so the later storefront and commerce changes only consume it.

## What Changes

- **Data model (Prisma, new migration):**
  - `Category`, `Size`, `Color`, `Product`, `ProductVariant`, `ProductImage`.
  - Unique indexes for product and category slugs, SKUs, and variant combinations.
  - `CHECK` constraints for prices (0 up to the catalog maximum) and non-negative stock.
  - A partial unique index allowing only one primary image per product.
  - `created_by` / `updated_by` attribution on every table.
- **Sizes as master data:** sizes are database rows (code, label, sort order), not a fixed list, so letter sizes (`S`–`XXL`, `OS`) and numeric sizes (`28`, `30`, `32`, `30/32`) work the same way. No measurement tables.
- **Product lifecycle:**
  - Statuses `DRAFT` → `ACTIVE` ⇄ `INACTIVE` → `ARCHIVED` (restorable to `INACTIVE`).
  - Activation requires an active category, at least one active variant, at least one active variant with a positive price, at least one image, and exactly one primary image.
  - No hard delete of products, variants, or categories. Archived and inactive records stay addressable by id.
- **Slugs:** generated from the name when not given; de-duplicated only when generated. Editable until the product is first activated, then locked so future storefront URLs stay stable.
- **Variants:** one per size × color per product, with a globally unique uppercase SKU, an optional price override, and a non-negative stock quantity.
- **Stock:** changed only through atomic adjustments (`delta`) that can never drive stock below zero, including under concurrency. This is a single choke point, ready for a future stock-movement ledger and reservations.
- **Images:** metadata only (URL or path, alt text, order, primary flag, optional variant). Draft and inactive products may have none. When a product has images, exactly one is primary: the first image becomes primary, primary changes are atomic, deleting the primary promotes the next, and an active product can't lose its last image. File upload and storage are out of scope.
- **Admin REST API** under `/api/v1/admin`:
  - categories, sizes, colors
  - products (list with filters and cursor pagination, create, get, update, activate, deactivate, archive, restore)
  - variants (create, update, activate, deactivate, stock adjustments)
  - images (add, update, delete, reorder)
- **Shared contracts:** strict Zod schemas in `@ite/contracts`, reusing `Money`, `Id`, `Timestamp`, `AttributionFields`, and the problem+json error codes.
- **Permissions:** two new ones, `catalog:read` and `catalog:manage`, granted to both `OWNER` and `ADMIN`. No new roles.
- **Price limit:** prices range from 0 to 2,000,000,000 minor units (Rp 20,000,000), a deliberate business limit to catch entry errors.
- **Store currency:** a single store currency from a new validated API setting `STORE_CURRENCY` (default `IDR`, the current stand-in). All prices must use it.
- **Dev seed:** reference sizes and colors, one category, and draft and active products mirroring the homepage placeholders, for local development.

**Out of scope:**
- storefront or public product endpoints, catalog pages, product detail UI, and collection or drop UI
- admin UI for products
- cart, checkout, payment, shipping, and order management
- customer accounts and wishlist (permanently excluded)
- media upload and storage
- a stock-movement ledger and reservations
- product search beyond a simple name filter
- reporting

The homepage keeps its placeholder content until a later change connects `getHomeContent()` to this domain.

## Capabilities

### New Capabilities

- `catalog-reference-data`: Categories (status, unique slug), sizes as master data (generic normalized code, label, explicit display order), and colors (name, slug, optional hex). Covers their admin management and in-use protection.
- `product-management`: Products, covering slugs, pricing (including the catalog price limit) and currency, category, lifecycle and activation readiness (including image requirements), the no-hard-delete strategy, listing with filters and pagination, images and primary/order rules, attribution, and authorization.
- `product-variants-inventory`: Variants, covering SKU rules, size × color uniqueness, price overrides and effective price, variant status, and non-negative stock with atomic, concurrency-safe stock adjustments.

### Modified Capabilities

_None._ No main specs exist yet: `initial-platform` and `storefront-homepage` are not archived. The new `catalog:*` permissions fit the existing admin-access-control requirement ("ADMIN: all permissions except staff account management") without changing it.

## Impact

- **Code:**
  - `packages/db`: Prisma models, a migration, and the dev seed.
  - `packages/contracts`: catalog schemas, error codes, and permissions.
  - `apps/api`: new `catalog` modules and the `STORE_CURRENCY` env setting.
  - API tests: integration and concurrency.
  - The route-coverage table.
- **Not changed:** `apps/web`, `apps/admin`, and the storefront.
- **APIs:** about 30 new admin endpoints (see design). No public endpoints.
- **Database:** one additive migration; existing tables are untouched.
- **Dependencies:** none expected (slugify is a small local function).
- **CI:** the existing gates cover the new code. Spec coverage gains this change.
