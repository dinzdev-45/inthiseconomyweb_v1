# Tasks

## 1. Contract and store API

- [x] 1.1 Add `StoreProductDetail` (summary fields plus `description`, `images` with `color`, and `variants` with size, color, price, and availability) to `packages/contracts/src/store-catalog.ts` and export it; verify contract unit tests for the strict shape (no id, SKU, stock quantity, or timestamp; image `color` nullable; variant availability values)
- [x] 1.2 Add the detail statement to the `store-catalog` repository (description, color-tagged images filtered to colors of active variants, active variants ordered by size order then color name) and return the detail from `GET /products/{slug}` with two statements per request (design D1, D2); verify the "Product detail fields", "Variants in the detail", "Gallery images tagged by color", "Active product by slug", and "Non-active product is not found" scenario tests, and that list endpoints and the route-coverage table are unchanged

## 2. Storefront foundations

- [x] 2.1 Move `CardImage` to `src/components/FallbackImage.tsx` and `isAllowedImage` to `src/lib/images.ts`, update the catalog to use them (design D3); verify the catalog card tests and the homepage-card baseline test still pass unchanged
- [x] 2.2 Add `features/product-detail/server` (`getProductDetail` with one `storeGet`, `revalidate: 60`, null on 404 or malformed slug; mapper with allowed-host images) delete the catalog's `getStoreProduct`, and point `/products/[slug]` at the new loader (the placeholder view and its metadata stay until 4.1 and 5.1 replace them); verify loader and mapper unit tests, including the "One product request per page" scenario test (metadata and page issue one distinct GET to the product endpoint, design D3)
- [x] 2.3 Add `features/product-detail/selection.ts` (URL parsing, default color and size, keep or drop size on color change, option states, displayed price, gallery order, option links); verify unit tests for each rule in design D4
- [x] 2.4 Add `features/product-detail/size-guide.ts` (letter, waist, and one-size tables in cm, marked as placeholder content; sizing-system detection; rows limited to the product's sizes in its order); verify unit tests for detection, including mixed size sets giving no guide

## 3. Catalog E2E fixtures

- [x] 3.1 Extend the fixture helper with an optional image `color` linked to that color's first variant; give "Two Tone Hoodie" black, off-white, and untagged images; replace one filler tee with "Allowance Cap" (one size, accessories) so there are still exactly 30 active products (design D8); verify the existing catalog E2E suite still passes unchanged

## 4. Product detail page

- [x] 4.1 Build `/products/[slug]` with `ProductDetailView` (name, category, price block, description, link back to the shop, no cart controls, 404 for non-active slugs; no loading boundary, which would turn the 404 into a streamed 200), delete the catalog's `ProductPlaceholder`, and move the placeholder E2E tests to a `product-detail` spec file; verify the "Product page from a catalog card" and "Unavailable product page" scenario tests
- [x] 4.2 Add the gallery (selected color's images then untagged ones, 4:5 `FallbackImage` frames, first image eager with high priority, horizontal scroll below 1024 px, grid from 1024 px); verify the "Gallery follows the selected color" and "Product without images" scenario tests
- [x] 4.3 Add color and size options as links in labelled groups (`aria-current` on the selection, "Sold out" text, unavailable sizes as non-interactive text, `scroll={false}`); verify the "Choose a color", "Choose a size", "Sold-out size", "Combination that does not exist", "Default selection", and "Invalid selection in the URL" scenario tests
- [x] 4.4 Add the price block (variant price and "In stock" or "Sold out" with a size selected; the color's price or "From" without; "Sold out" for a fully sold-out product); verify the "Price of the selected variant", "Price before choosing a size", and "Sold-out product" scenario tests
- [x] 4.5 Add the size guide disclosure (native `<details>`, captioned table with header cells and units); verify the "Open the size guide", "Size guide matches the product's sizes", and "One-size product" scenario tests

## 5. SEO

- [x] 5.1 Add the product metadata (name as title, description cut at a word boundary to at most 160 characters or a fallback, canonical `/products/<slug>`, indexable), delete the catalog's `productMetadata`, and drop the placeholder from the catalog SEO and accessibility tests; verify the "Product page metadata", "Selection does not change the canonical URL", "Search and placeholder pages are not indexed", and "Catalog accessibility scan" scenario tests

## 6. Accessibility, layout, and performance

- [x] 6.1 Add axe scans (no selection, color and size selected, size guide open) and a keyboard test; fix serious or critical violations; verify the "Product page accessibility scan" and "Keyboard product selection" scenario tests
- [x] 6.2 Add the six-width overflow and clipped-text check and the layout-shift measurement for the product page; verify the "Product page without horizontal overflow" and "Reserved product media space" scenario tests

## 7. CI and verification

- [x] 7.1 Add `product-detail` to the CI spec-coverage targets (and keep a "Product link from a card" test for the main `storefront-catalog` spec until archive removes that scenario); verify `pnpm spec:coverage` reports 0 missing for it and every main spec, and that `actionlint` passes
- [x] 7.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:check`, the admin, storefront, and catalog E2E suites, `pnpm format:check`, and `openspec validate --all --strict`; verify everything passes, the homepage is unchanged and still API-free, and no admin endpoint changed
