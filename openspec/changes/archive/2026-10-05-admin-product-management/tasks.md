# Tasks

## 1. API and contract additions

- [x] 1.1 Add `CatalogSettings` (`{ storeCurrency }`) to `@ite/contracts` and `GET /api/v1/admin/catalog/settings` (`catalog:read`, GET/HEAD only) returning the validated `STORE_CURRENCY`; add it to the route-coverage table; verify the "Read the store currency" and "Store currency cannot be changed through the API" scenario tests and the route-coverage test
- [x] 1.2 Add `stock: { totalQuantity, activeVariantCount, outOfStockVariantCount }` to `ProductListItem` and compute it in the product list (one aggregate query per page over `ACTIVE` variants); verify the "Stock summary in the product list" scenario test, and that the existing `product-management` list, detail, and pagination tests still pass
- [x] 1.3 Move `minorUnitDigits` and `formatMoney` into `packages/contracts/src/money.ts`, add `parseMajorAmount(input, currency)`, and make `apps/web/src/lib/format-money.ts` re-export them; verify new contract unit tests (formatting; parsing whole, decimal, too-precise, negative, and non-numeric input) and that all storefront unit and E2E tests pass unchanged

## 2. Admin catalog foundation

- [x] 2.1 Add `src/features/catalog/shared/access.ts` (`catalogAccess`) and the Products, Categories, Sizes, and Colors navigation entries (`catalog:read`); verify the "Catalog navigation entries", "Read-only catalog view", and "Catalog page without catalog read permission" scenario tests (unit tests on the navigation, the access helper, and the page-guard decision), and update the existing `visibleNav` test
- [x] 2.2 Add `problem.ts` (ApiError → summary, field errors, "not permitted", or a generic message with a reference) and the `useCatalogAction` hook (busy state, auth redirects, refresh on success, focus to the error summary, polite success message); verify unit tests for every status and code mapping in design D3
- [x] 2.3 Add the shared components (`ErrorSummary`, `ConfirmAction`, `StatusBadge`, `PriceInput`, `EmptyState`, `SuccessMessage`) and the small `ui.tsx` additions (`Textarea`, `Badge`); verify `pnpm --filter @ite/admin typecheck` and `lint` pass
- [x] 2.4 Add `data.ts` (server-only loaders for products, categories, sizes, colors, and catalog settings), the `/catalog/*` route skeletons with `loading.tsx`, the `/catalog` `error.tsx` boundary, and a product not-found page; verify each route renders for a signed-in owner in a Playwright smoke check, and that an unknown product id shows "Product not found"
- [x] 2.5 Add `@axe-core/playwright` (the version the storefront uses) to the admin's dev dependencies, and E2E helpers to sign in and create catalog data through the API with the owner session; verify the existing admin E2E suite still passes

## 3. Reference-data pages

- [x] 3.1 Build the categories page (status filter, create with optional slug, inline edit, archive with confirmation, restore); verify the "List categories with a status filter", "Create a category from the admin", "Edit a category from the admin", "Archive and restore a category from the admin", and "Archiving a category in use shows the reason" scenario tests
- [x] 3.2 Build the sizes page (display order, create, inline edit, delete with confirmation); verify the "Sizes listed in display order in the admin", "Create and edit a size from the admin", and "Delete a size from the admin" scenario tests
- [x] 3.3 Build the colors page (swatch plus hex text, create, inline edit including clearing hex, delete with confirmation); verify the "Colors shown with swatches", "Create and edit a color from the admin", and "Delete a color from the admin" scenario tests

## 4. Product list

- [x] 4.1 Build `/catalog/products` with the URL-driven filters form (search, status, category), the table (thumbnail or placeholder, name link, category, status, price, variant count, stock summary), and the empty state; verify the "Product list columns", "Search and filter products in the admin", "Archived products only through the status filter", and "Empty catalog list" scenario tests
- [x] 4.2 Add cursor pagination ("Next page" and "First page" links that keep the filters) and the invalid-cursor message; verify the "Paginate the product list in the admin" and "Invalid list cursor in the URL" scenario tests, and unit tests for `list-query.ts`
- [x] 4.3 Add row lifecycle actions using `lifecycle.ts` and `ConfirmAction`; verify the "Lifecycle actions in the product list" scenario test and unit tests for the status → actions map

## 5. Product create, details, and lifecycle

- [x] 5.1 Build `/catalog/products/new` (name, slug, description, category, `PriceInput` with the store currency from catalog settings) that opens the new product's page on success; verify the "Create a draft product from the admin", "Create a product with a taken slug in the admin", "Prices shown in the store currency", and "Price entry in major units" scenario tests
- [x] 5.2 Build the product page Details section (status text, first activation and last update times, edit form sending only changed fields, read-only slug after activation, read-only archived product); verify the "Edit product details from the admin", "Slug read-only after activation in the admin", and "Archived product is read-only in the admin" scenario tests
- [x] 5.3 Build the Lifecycle section (actions per status, confirmation for deactivate and archive, API explanation for refusals, including `PRODUCT_NOT_READY` reasons in the API's own words); verify the "Activate a ready product from the admin", "Activation blocked shows every reason", "Deactivate, archive, and restore a product from the admin", and "Confirm before a disruptive action" scenario tests

## 6. Variants and stock

- [x] 6.1 Build the Variants section (table with size, color, SKU, override, effective price, stock, and status; add form with optional initial stock; edit form without stock; SKU read-only after activation; activate and deactivate); verify the "Add a variant from the admin", "Set and clear a variant price override in the admin", "Variant conflicts shown in the admin", "SKU read-only after activation in the admin", and "Deactivating the last active variant shows the reason" scenario tests
- [x] 6.2 Build `StockAdjuster` (current stock, a whole non-zero delta, the API's returned quantity shown after the change); verify the "Adjust stock by a delta in the admin", "Insufficient stock shown in the admin", and "No absolute stock editing" scenario tests, and unit tests for the delta input parsing

## 7. Images

- [x] 7.1 Build the Images section (previews, a "Primary" label, add and edit with an optional variant from this product, make primary, delete with confirmation); verify the "Add image metadata from the admin", "Make another image primary from the admin", "Delete an image from the admin", "Deleting the last image of an active product shows the reason", "Invalid image metadata shown in the admin", and "Cancel a disruptive action" scenario tests
- [x] 7.2 Add keyboard reordering (move up and down, saving the full order, keeping focus on the moved item); verify the "Reorder images from the admin" and "Catalog keyboard operation" scenario tests

## 8. Shared states, errors, accessibility, and the end-to-end workflow

- [x] 8.1 Verify the shared error and progress behaviour end to end, using `page.route` to delay or fail browser mutations: the "Field errors from the API", "Business rule error keeps input", "Unexpected server error", "Session expired during a catalog action", "API refusal is authoritative", "Action in progress", and "Success message after a change" scenario tests
- [x] 8.2 Add axe scans of the product list, a product page, and each reference-data page; fix any serious or critical violations; verify the "Catalog pages pass an automated accessibility scan" scenario test
- [x] 8.3 Write the UI-only workflow test; verify the "Catalog workflow from setup to an active product" scenario test

## 9. Verification and wrap-up

- [x] 9.1 Add `admin-product-management` to the CI spec-coverage targets; verify `pnpm spec:coverage` reports 0 missing for it and all main specs, and that `actionlint` passes
- [x] 9.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:check`, both E2E suites, `pnpm format:check`, and `openspec validate admin-product-management --strict`; verify everything passes, the storefront is unchanged, and no public endpoint was added
