# Tasks

## 1. Contracts, permissions, and configuration

- [x] 1.1 Add `catalog:read` and `catalog:manage` to `Permission` and grant both to OWNER and ADMIN; verify the updated `ROLE_PERMISSIONS` unit test and the contract-alignment test pass
- [x] 1.2 Add the new `ErrorCode` values (`SLUG_EXISTS`, `SLUG_LOCKED`, `SKU_EXISTS`, `SKU_LOCKED`, `CODE_EXISTS`, `VARIANT_EXISTS`, `VARIANT_MISMATCH`, `UNKNOWN_REFERENCE`, `IN_USE`, `INVALID_STATE_TRANSITION`, `PRODUCT_NOT_READY`, `LAST_ACTIVE_VARIANT`, `INSUFFICIENT_STOCK`, `CURRENCY_MISMATCH`, `IMAGE_LIMIT`, `LAST_IMAGE`); verify the contract tests accept them
- [x] 1.3 Create `packages/contracts/src/catalog.ts` with primitives (`Slug`, `Sku`, `SizeCode` with trim, uppercase and the generic pattern, `HexColor`, `Price` with the 0–2,000,000,000 business limit, statuses), response schemas (`Category`, `Size`, `Color`, `ProductImage`, `ProductVariant`, `ProductListItem`, `ProductDetail`, paginated list, `StockAdjustmentResult`), and strict request schemas; verify unit tests for accept and reject cases (negative, fractional, or above-maximum amounts; bad slugs, SKUs, size codes, hex values; unknown properties)
- [x] 1.4 Add `STORE_CURRENCY` (ISO 4217, default `IDR`) to the API env schema and `.env.example`; verify the env tests (valid, default, invalid value named without echoing it)

## 2. Database schema and migration

- [x] 2.1 Model `Category`, `Size`, `Color`, `Product`, `ProductVariant`, and `ProductImage` with enums, snake_case mapping, attribution columns, foreign keys (RESTRICT / CASCADE / SET NULL per design D1), uniques, and indexes; verify `prisma validate` and `prisma generate`
- [x] 2.2 Create migration `add_product_domain`, adding raw SQL for the `CHECK` constraints (prices 0–2,000,000,000, stock ≥ 0) and the partial unique index on primary images; verify `pnpm db:check` passes on a fresh database
- [x] 2.3 Add a migration-level test that direct SQL writes of a negative price, a price above 2,000,000,000, negative stock, or a second primary image are rejected by the database; verify the "Database rejects negative stock" scenario test
- [x] 2.4 Extend the dev seed (idempotent): example sizes (`XS`–`XXL`, `OS`, waists `28`–`34`, with explicit sort orders), the brand-neutral colors, category "Apparel", and products mirroring the homepage placeholders, with variants, stock, and one primary placeholder image record for each active product; verify that running `pnpm db:seed` twice leaves identical data

## 3. Shared catalog building blocks

- [x] 3.1 Implement `slugify` and generated-slug suffixing (`-2`, `-3`, … with a retry on concurrent conflict); verify unit tests for accents, punctuation, length, empty fallback, and suffix choice
- [x] 3.2 Implement the money helpers (store-currency check returning `CURRENCY_MISMATCH`, effective price) and Prisma-error mapping (unique violation to `SLUG_EXISTS`, `SKU_EXISTS`, `CODE_EXISTS`, `VARIANT_EXISTS`; foreign-key violation to `IN_USE` or `UNKNOWN_REFERENCE`); verify unit tests
- [x] 3.3 Implement the signed cursor pagination helper (`(createdAt, id)`, HMAC, `limit` default 20 and max 100); verify unit tests for next page, last page, limit over 100, and a tampered cursor

## 4. Reference data API (categories, sizes, colors)

- [x] 4.1 Implement the category endpoints (list with status filter, create, get, update, archive, restore) with attribution; verify the "Create category", "Duplicate category slug", "Archive category in use", and "Archive and restore unused category" scenario tests
- [x] 4.2 Implement the size endpoints (list ordered, create, update, delete when unused); verify the "Sizes listed in display order", "Numeric and letter size codes", "Invalid size code", "Duplicate size code", and "Delete size in use" scenario tests
- [x] 4.3 Implement the color endpoints (list, create with generated slug and uppercase hex, update, delete when unused); verify the "Create color with hex", "Invalid hex", and "Delete unused color" scenario tests

## 5. Products API

- [x] 5.1 Implement product create, get, and update (slug generation and locking, category reference, base price with store currency, `ARCHIVED` read-only) with attribution; verify "Slug generated from name", "Generated slug avoids collision", "Duplicate product slug", "Slug locked after activation", "Negative price rejected", "Price above the catalog maximum rejected", "Fractional amount rejected", "Foreign currency rejected", "New product is draft", "Update product attribution", "Edit archived product rejected", "Product detail shape", and "Unknown product"
- [x] 5.2 Implement the product list (filters `status` with `ARCHIVED` excluded by default, `categoryId`, `q`; primary image; variant count; cursor pagination); verify "Paginate products" and "Archived products hidden by default"
- [x] 5.3 Add the concurrency test for same-slug creation; verify "Concurrent creation with the same slug" (repeated rounds: exactly one `201`, the rest `409`)
- [x] 5.4 Register catalog permissions on all routes and add them to the route-coverage `EXPECTED` table; verify "Admin manages catalog", "Catalog requires a session", and the route-coverage test

## 6. Variants, lifecycle, and stock

- [x] 6.1 Implement variant create and update (size and color references, SKU normalization and lock, price override and effective price, uniqueness per product); verify "Add variant", "Duplicate size and color", "Same size and color on different products", "Price override", "Unknown size or color", "Duplicate SKU", "Invalid SKU", and "SKU locked after activation"
- [x] 6.2 Implement product activate, deactivate, archive, and restore with readiness checks (category, active variant, positive effective price, at least one image, exactly one primary) and row locks (category, then product, then variants); verify "Activate ready product", "Activate product without variants", "Activate product without an image", "Activate product without a primary image" (primary unset via direct SQL), "Activation reports every unmet condition", "Activate product in archived category", "Deactivate and reactivate product", "Archive active product rejected", and "Archived product stays addressable"
- [x] 6.3 Implement variant activate and deactivate with the last-qualifying-variant rule (including price changes to zero) under the same locks; verify "Deactivate last active variant rejected", "Deactivate variant of inactive product", and "Concurrent activation and last-variant deactivation" (repeated rounds)
- [x] 6.4 Implement atomic stock adjustments (single conditional `UPDATE … RETURNING`, attribution); verify "Adjust stock", "Stock cannot go negative", "Negative initial stock rejected", and "Concurrent stock adjustments" (15 parallel `-1` on stock 10)

## 7. Product images

- [x] 7.1 Implement image add, update, and delete (URL and alt validation, variant ownership, 20-image limit, first-is-primary, atomic primary switch, promotion on delete, last-image protection for `ACTIVE` products) in transactions holding the product row lock; verify "Draft product without images", "First image becomes primary", "Switch primary image" (including a concurrent pair of switches leaving exactly one primary), "Delete primary image promotes next", "Delete last image of active product rejected", "Image for another product's variant", and "Image limit"
- [x] 7.2 Implement image reorder (exact permutation, consecutive sort orders); verify "Reorder images", including the omitted, repeated, and foreign-id rejections

## 8. Verification and wrap-up

- [x] 8.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:check`, and both E2E suites; verify everything passes and no storefront or admin UI behaviour changed
- [x] 8.2 Add `product-domain` to the CI spec-coverage step and verify `pnpm spec:coverage` reports 0 missing for all three changes; verify `actionlint` and `openspec validate product-domain --strict` pass
