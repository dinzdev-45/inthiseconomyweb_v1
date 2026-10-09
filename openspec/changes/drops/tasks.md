# Tasks

## 1. Data and contracts

- [x] 1.1 Add the `drop_status` enum and the `Drop` and `DropProduct` models with one migration (unique slug, `UNIQUE (product_id)`, cascades and RESTRICT, CHECKs for slug format, lengths, and image URL and alt together; design D1); verify `pnpm db:check` reports no difference and the migration applies to a fresh database
- [x] 1.2 Add contracts: admin drop schemas (create, update, products, candidates, drop detail and list), store drop schemas (`StoreDropSummary`, `StoreDropsOverview`, `StoreDropDetail`), the nullable `releaseAt` on store product summaries and details plus `drop` on the detail, and the error codes `PRODUCT_IN_OTHER_DROP`, `DROP_NOT_READY`, `NOT_RELEASED`; verify contract unit tests

## 2. Admin drops API

- [x] 2.1 Add the admin `drops` module (list, create, read, update, delete draft; slug generation, attribution, permissions; route-coverage entries; design D3); verify the "Create a drop", "Drop slug conflict", and "Drops need catalog permissions" scenario tests and the route-coverage test
- [x] 2.2 Add `PUT /drops/:id/products` and `GET /drops/:id/candidates`; verify the "Set a drop's products", "Product in another drop", and "Find products for a drop" scenario tests
- [x] 2.3 Add publish and unpublish with readiness; verify the "Publish a ready drop", "Drop not ready to publish", and "Unpublish and delete" scenario tests

## 3. Release rule

- [x] 3.1 Add the `unreleased(alias, now)` fragment and give the store-catalog and store-cart services the clock; apply it to the catalog page query, filter options, by-slug lookup (`releaseAt` and `drop`), the cart's add (`NOT_RELEASED`) and view status, and checkout's `takeStock` (design D2); verify the "Release at the release time", "Unreleased products stay out of the shop", "Release time in the detail", "Unreleased product cannot be added", and "Line that became unreleased" scenario tests, plus a checkout test that an unreleased line cannot be ordered, and that existing catalog, cart, and checkout tests still pass

## 4. Public drops API

- [x] 4.1 Add the `store-drops` module (overview split by the clock, drop detail through the catalog page query's `dropId` filter, `Cache-Control: public, max-age=60`; design D4); verify the "Drops overview", "No drops yet", "Upcoming drop detail", and "Draft drop is not found" scenario tests

## 5. Storefront drops

- [x] 5.1 Add the drops loaders and the `Countdown` client component (labelled timer, no per-tick announcements, reduced motion, refresh at zero; design D5); verify unit tests with fake timers and the "Countdown to a release", "Release time without JavaScript", and "Countdown reaches zero" scenario tests
- [x] 5.2 Build `/drops`, `/drops/[slug]`, `/drops/archive` (metadata, shared error boundary, no loading boundary on the drop page, release labels on cards); add the drop fixtures ("Collection 001", "Collection 002: Overtime" with two new products, "Archive 000"; design D7); verify the "Next drop on the drops page", "No drops yet on the drops page", "Drops unavailable" (no-API suite), "Upcoming drop page", "Live drop page", "Unknown drop page", "Drop archive", and "Drop page metadata" scenario tests, and that the catalog suite's counts are unchanged
- [x] 5.3 Show release state on the product page (`PriceBlock` with drop link, `AddToCartForm` "Releases …", the cart action's `notReleased` reason); verify the "Unreleased product page" and "Unreleased product cannot be added from its page" scenario tests and that existing product-detail and cart tests still pass
- [x] 5.4 Source the homepage's featured drop from the API with `revalidate = 300` and a failure fallback, put `Countdown` in `DropFeature`, and remove the placeholder drop; update the no-API suite (8 sections, 300 s revalidation); verify the "Live drop", "Upcoming drop", "No drop to feature", "Homepage does not depend on the API", and "Static homepage" scenario tests

## 6. Admin drops screens

- [x] 6.1 Add the Drops navigation entry and `/catalog/drops` list (design D6); verify the "Catalog navigation entries" and "Drops list" scenario tests
- [x] 6.2 Add the drop form (create and edit, WIB date-time entry converted with +07:00, field errors kept); verify the "Create a drop in the admin" and "Drop form errors" scenario tests and a unit test of the WIB conversion
- [x] 6.3 Add the product picker (candidate search, taken products shown, add, remove, reorder, save) and the publish, unpublish, and delete actions with confirmation and missing-item messages; verify the "Choose a drop's products", "Product already in another drop", "Publish from the admin", and "Publish refused in the admin" scenario tests, plus an admin E2E create → add products → publish flow

## 7. Quality, CI, and verification

- [x] 7.1 Add axe scans, keyboard checks, and the six-width overflow check for the drop pages; fix serious or critical violations; verify the "Drop pages accessibility scan" and "Drop pages without horizontal overflow" scenario tests
- [x] 7.2 Add `drops` to the CI spec-coverage targets; verify `pnpm spec:coverage` reports 0 missing for it and every main spec, and that `actionlint` passes
- [x] 7.3 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:check`, the admin, storefront, and catalog E2E suites, `pnpm format:check`, and `openspec validate --all --strict`; verify everything passes and the homepage serves visitors without API calls
