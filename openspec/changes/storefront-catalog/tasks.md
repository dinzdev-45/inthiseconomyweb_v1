# Tasks

## 1. Contracts and store catalog API

- [ ] 1.1 Add `packages/contracts/src/store-catalog.ts` (`StoreProductSummary`, `StoreProductListQuery`, `StoreProductListResponse`, `StoreCatalogFilters`) and export it; verify contract unit tests for accepted and rejected queries (unknown parameter, bad sort, page 0, malformed slug or size code, empty or over-long `q`) and for the strict summary shape
- [ ] 1.2 Add the `store-catalog` API module and `GET /api/v1/store/products` (active-only visibility, the summary mapping, price range and availability from active variants, two queries per request, `Cache-Control: public, max-age=60`), registered in the store zone; verify the "Only active products are listed", "Customer-safe summary fields", "Price range from active variants", "Sold-out product in the catalog", "Inactive variant stock is ignored", "Catalog needs no credentials", and "Catalog is read-only" scenario tests
- [ ] 1.3 Add filters (same-variant semantics), sorting, search, numbered pagination, and strict validation to the list; check query plans on seeded data and add an index only if needed (design D3); verify the "Filter the catalog by category", "Size and color match the same variant", "In-stock filter", "Unknown filter value", "Sort by newest", "Sort by price", "Search the catalog by name", "Search treats wildcards literally", "Catalog page envelope", "Page beyond the last page", and "Invalid catalog query" scenario tests
- [ ] 1.4 Add `GET /api/v1/store/products/{slug}` and `GET /api/v1/store/catalog/filters`; verify the "Active product by slug", "Non-active product is not found", and "Filter options reflect active products" scenario tests, and that no admin endpoint or route-coverage entry changed

## 2. Storefront foundation

- [ ] 2.1 Add `SITE_URL` and `STOREFRONT_IMAGE_HOSTS` to the storefront env (validated, values never printed), `metadataBase`, and `images.remotePatterns` from the allowed hosts; verify env unit tests (valid, missing in production, malformed host) and a build
- [ ] 2.2 Add `features/catalog/url-state.ts` (parse search params with contract primitives, drop invalid values with a flag, build filter, sort, and page links) and the server loaders and mapper (`getCatalogPage`, `getStoreProduct`; allowed-host images, color label, price range; `revalidate: 60`); verify unit tests, including the "One catalog request per page" scenario test (mocked fetch counts exactly one list and one filters request)
- [ ] 2.3 Add the catalog E2E harness: `playwright.catalog.config.ts` (API on 4200 with database `ite_e2e_store`, storefront on 3200), a global setup that migrates and seeds catalog fixtures (more than 24 active products, sold-out, multi-price, multi-color, draft, inactive, and archived products), and the `e2e:catalog` script; verify a smoke test lists a seeded active product, and that the existing no-API storefront suite still passes unchanged

## 3. Product card

- [ ] 3.1 Extend `ProductSummary` and `ProductCard` with optional availability ("Sold out" as text inside the link), a "From" price for ranges, and a color label, plus a `CardImage` client fallback to the placeholder on missing, disallowed, or failed images; verify the "Catalog card content", "Price range on a card", "Sold-out card", and "Missing or broken product image" scenario tests, and a regression test that homepage card output is unchanged (existing homepage card scenarios still pass)

## 4. Shop page

- [ ] 4.1 Build `/shop` with the product list grid (2, 3, then 4 columns), result count, `loading.tsx` skeleton, the catalog `error.tsx`, and empty and no-results states; verify the "Shop shows active products", "Shop result count", "Empty catalog", "No filter results", "Catalog loading skeleton", and "Catalog unavailable" scenario tests (the last in the no-API storefront suite)
- [ ] 4.2 Add the filters and sort form (GET, fieldsets, "In stock only", active-filter chips, "Clear all", invalid-value notice, "Filter and sort" disclosure below 1024 px); verify the "Filter the shop by category", "Combine shop filters", "Sort the shop", "Filters reset to the first page", "Shareable catalog URL", and "Invalid filter in the URL" scenario tests
- [ ] 4.3 Add numbered pagination (Previous, windowed page numbers with `aria-current`, Next, and a message past the last page); verify the "Paginate the shop" and "Shop page beyond the last" scenario tests

## 5. Search, product placeholder, and homepage links

- [ ] 5.1 Build `/search` (search landmark, labelled input, `q` in the URL, sort and pagination, empty-query invitation, no-results message); verify the "Search for a product", "Search with no results", and "Empty search" scenario tests
- [ ] 5.2 Build the `/products/[slug]` placeholder (name, price or range, "Sold out", "full details coming soon", back link, no purchase controls, 404 for non-active slugs); verify the "Product link from a card" and "Unavailable product page" scenario tests
- [ ] 5.3 Confirm the homepage links into the catalog without changing it (it stays static and API-free); verify the "Shop all from the homepage" and "Homepage card to a product page" scenario tests, and that the existing homepage scenarios, including "Homepage does not depend on the API", still pass

## 6. SEO

- [ ] 6.1 Add catalog metadata builders (titles, descriptions, absolute canonical URLs, `noindex, follow` for non-category filter or sort combinations, `noindex` for search and placeholder pages); verify the "Catalog metadata", "Category view is indexable", "Filter combinations are not indexed", and "Search and placeholder pages are not indexed" scenario tests

## 7. Accessibility, responsive layout, and performance

- [ ] 7.1 Add axe scans (shop with and without filters, search, placeholder) and keyboard tests; fix serious or critical violations; verify the "Catalog accessibility scan" and "Keyboard catalog navigation" scenario tests
- [ ] 7.2 Add the six-width overflow checks, the small-screen disclosure test, and the layout-shift measurement for the shop; verify the "Catalog without horizontal overflow", "Filters on small screens", and "Reserved catalog media space" scenario tests

## 8. CI and verification

- [ ] 8.1 Add the catalog E2E suite as its own CI step and `storefront-catalog` to the CI spec-coverage targets; verify `pnpm spec:coverage` reports 0 missing for it and every main spec, and that `actionlint` passes
- [ ] 8.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:check`, the admin, storefront, and catalog E2E suites, `pnpm format:check`, and `openspec validate --all --strict`; verify everything passes, the homepage is unchanged and still API-free, and no admin endpoint changed
