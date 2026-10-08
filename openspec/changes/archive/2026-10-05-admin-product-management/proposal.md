# Proposal

## Why

The product domain (categories, sizes, colors, products, variants, stock, and image metadata) exists only as an admin REST API: staff have no way to manage the catalog except by calling endpoints by hand. The admin app needs catalog screens before the storefront catalog can be filled with real products, and they should use the existing API, permissions, and error format rather than add new business logic.

## What Changes

- **Admin catalog area** in `apps/admin` under `/catalog`:
  - **Products:** a searchable, filterable, cursor-paginated list; a create page; and a product page for editing details, lifecycle actions, variants, stock adjustments, and image metadata.
  - **Reference data:** pages for categories (with archive and restore), sizes, and colors (with delete when unused).
- **Product page sections:**
  - details (name, slug, description, category, base price) with the slug lock shown once the product has been activated
  - lifecycle state and actions (activate, deactivate, archive, restore), including the `PRODUCT_NOT_READY` reasons
  - variants (create, edit, activate, deactivate) with stock shown read-only
  - stock adjustments by a signed delta only, never an absolute value
  - images (add, edit, mark primary, reorder, delete) as URLs or paths with alt text; no upload
- **Shared admin behaviour for catalog screens:**
  - permission-aware navigation and controls: `catalog:read` to view, `catalog:manage` to change
  - problem+json errors rendered as a summary plus field errors
  - loading, empty, success, and error states
  - confirmation before destructive or visibility-changing actions
  - no optimistic updates for lifecycle or stock
- **Two small, additive API changes** the UI needs:
  - `GET /api/v1/admin/catalog/settings` returns the store currency (read-only, `catalog:read`), so the admin can show the currency and build valid prices without its own copy of `STORE_CURRENCY`. The currency still cannot be changed through the API.
  - Product list items gain a `stock` summary (total stock, the number of active variants, and how many are out of stock), so the list can show stock without one request per row.
- **Shared money helpers:** formatting and minor-unit conversion move from the storefront into `@ite/contracts`, so the admin and the storefront format prices the same way. Storefront behaviour is unchanged.
- **E2E:** the admin Playwright suite gains a catalog workflow, from reference data through an activated product.

**Out of scope:**
- storefront catalog and product detail pages
- collections and drops
- cart, checkout, payments, shipping, and orders
- customer accounts and wishlist (permanently excluded)
- media upload and storage
- reporting
- bulk editing and CSV import
- any change to product-domain rules: the API stays the source of truth

## Capabilities

### New Capabilities

- `admin-catalog-ui`: Shared rules for the admin catalog screens: navigation entries, permission-aware controls, problem+json rendering, loading, empty, success, and error states, confirmations, money display and entry in the store currency, and accessibility.
- `admin-catalog-reference-data`: Admin pages for categories (list with status filter, create, edit, archive, restore), sizes (list in display order, create, edit, delete), and colors (list with swatches, create, edit, delete).
- `admin-products`: Admin product list (search, filters, cursor pagination, stock summary, row actions), product create and edit, lifecycle actions and readiness reasons, variant management, stock adjustments, and image metadata management.

### Modified Capabilities

- `product-management`:
  - **Product listing and detail:** list items also include a stock summary.
  - **New requirement:** staff with `catalog:read` can read the store currency setting.

## Impact

- **Code:**
  - `apps/admin`:
    - new `src/features/catalog/` and `/catalog/*` routes
    - navigation entries
    - small additions to `src/components/ui.tsx`
  - `apps/api`:
    - the catalog settings route
    - the list stock summary
    - the route-coverage table
  - `packages/contracts`:
    - `CatalogSettings`
    - `ProductListItem.stock`
    - shared money helpers
  - `apps/web`: imports the money helpers from `@ite/contracts`; no behaviour change.
- **APIs:** one new read-only admin endpoint, and one additive response field. No breaking changes, and no public endpoints.
- **Database:** none.
- **Dependencies:** none expected.
- **Tests:**
  - admin unit tests for pure helpers
  - API integration tests for the two additions
  - admin Playwright scenarios, named after the spec scenarios
  - CI spec coverage gains this change while it is active
