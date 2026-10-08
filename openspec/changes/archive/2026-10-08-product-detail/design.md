# Design

## Context

See `proposal.md` for motivation; requirements are in `specs/`.

**What exists today:**
- **API (`apps/api/src/modules/store-catalog`):**
  - The by-slug read reuses the list's page query with a slug filter (one statement), plus the batched "extras" statement for colors and two images. It returns the summary.
  - Visibility rules (only `ACTIVE` products and `ACTIVE` variants) live in that repository's SQL. Responses are cached for 60 s.
- **Data:** `product_images.variant_id` already links an image to a variant, and a variant has one color. Sizes have a `sort_order`. Product `description` exists but is not exposed to the store.
- **Storefront (`apps/web`):**
  - `/products/[slug]` renders `ProductPlaceholder` through `getStoreProduct` in `features/catalog/server`.
  - Two catalog pieces are generic but live inside the catalog feature: `CardImage` (image with a placeholder fallback, including the pre-hydration failure case) and the mapper's `isAllowedImage` (allowed hosts from `STOREFRONT_IMAGE_HOSTS`).
  - Feature rule (`src/features/README.md`): features do not import each other's internals; shared code goes to `src/lib/` or `src/components/`.
- **Catalog E2E:**
  - The fixtures create exactly 30 active products, and several catalog tests depend on that count, the newest product, and the cheapest product.
  - Fixture images are not linked to variants.

## Goals / Non-Goals

**Goals:**
- The API computes everything the page needs (which images belong to which color, per-variant price and availability), so the storefront holds only presentation and selection logic.
- Selection works as plain links and server rendering, like the catalog's filters: shareable, crawlable, and usable without JavaScript.
- Reuse the catalog's image fallback and allowed-host logic without cross-feature imports.

**Non-Goals:**
- Client-side variant switching without navigation, and image zoom or lightbox.
- Inventory reservation or live stock: availability may be 60 s old, as for the catalog.
- Size guide data in the database or the admin.

## Decisions

### D1. Detail on the existing by-slug endpoint

`GET /api/v1/store/products/{slug}` returns `StoreProductDetail` = `StoreProductSummary` fields + `description` + `images` + `variants`. The schema is strict and lives in `@ite/contracts` (`store-catalog.ts`).

- **Why not a new `/products/{slug}/detail` endpoint:** the only consumer of the by-slug read was the placeholder, which this change replaces. Two shapes for one resource would add surface with no user.
- **Compatibility:** the change is additive. A client that reads only summary fields keeps working; a strict client must move to the new schema. The storefront ships with the API change (see Migration Plan).
- **Images:**
  - Each image's `color` is the color slug of its linked variant, or null when it has no variant.
  - Images whose color no `ACTIVE` variant uses are dropped, so customers never see photos of a color they cannot pick. That includes an image linked to an inactive variant of a color that is otherwise gone.
  - An image linked to an inactive variant whose color still has an active variant keeps that color.
- **Variants:** ordered by size `sort_order`, then size code, then color name.

### D2. Queries: still two statements per request

- **Statement 1:** the existing page query with the slug filter. It gives visibility, price range, and availability, and is unchanged.
- **Statement 2:** a new detail statement for one product id. It returns, as JSON aggregates in one row:
  - the description
  - the images, with color resolved through the variant join and filtered against the colors of active variants
  - the active variants, with size, color, effective price (`COALESCE(override, base)`), and `stock_quantity > 0`
- It replaces the summary's "extras" statement for this endpoint. `image`, `secondaryImage`, and `colors` in the detail are derived from the same rows: primary image first, then the first non-primary image. That keeps them consistent with the list.
- **Alternative:** Prisma `findUnique` with includes. Rejected: it would read inactive variants and SKUs into memory and filter them in TypeScript. Keeping visibility in SQL, as the rest of the module does, is safer.

### D3. Storefront feature `features/product-detail`

```
features/product-detail/
  server/product.ts     getProductDetail(slug): one storeGet (revalidate 60), mapped; null on 404 or malformed slug
  server/mapper.ts      API detail → view model (allowed-host images, Money kept as is)
  selection.ts          pure: parse color/size, defaults, option states, displayed price, links
  size-guide.ts         static tables + sizing-system detection
  seo.ts                productMetadata(detail)
  components/           ProductDetailView, Gallery, ColorOptions, SizeOptions, PriceBlock, SizeGuide
```

**Shared code moves:**
- `CardImage` → `src/components/FallbackImage.tsx` (same behavior; used by catalog cards and the gallery).
- `isAllowedImage` → `src/lib/images.ts` (used by both mappers).

The catalog's `ProductPlaceholder`, `getStoreProduct`, and `productMetadata` are deleted. The moves keep the homepage card's server HTML identical, and the existing baseline test proves it.

**One request per render:** `generateMetadata` and the page both call `getProductDetail` with the same URL and options. Next memoizes identical `fetch` calls within one render (documented for `generateMetadata` and pages), so the API is called once.

**Testing it:** Vitest cannot run Next's per-request memoization. The "One product request per page" test therefore runs the route's `generateMetadata` and page against a mocked `fetch` and asserts two things:
- every call is the same GET (identical URL and options), so there is exactly one distinct request
- that request is the product endpoint, with no per-variant or per-image follow-up requests

The deduplication itself is Next's documented behavior and is not re-tested.

### D4. Selection in the URL, as links

`selection.ts` takes the detail and the `color` and `size` search params. It returns:
- the selected color, either valid or the default (first color by name with an in-stock variant, else the first by name)
- the selected size: valid for that color, the single size when there is exactly one, or none
- one option per color and per size, each with a state: `selected`, `available`, `sold-out`, or `unavailable` (no variant in the selected color)
- the displayed price: the variant price, or the color's min with "From" when its prices differ
- the gallery images: the selected color's images, then the untagged ones

**Links:**
- Color and size options are links to `/products/<slug>?color=…&size=…`, with `aria-current="true"` on the selected one.
- Changing color keeps the size when it exists in the new color; otherwise it drops the size.
- Unavailable sizes render as non-interactive text ("L – Not available in White"), not links.
- Each group is a list inside a labelled region ("Color: White", "Size").
- Navigation uses `scroll={false}`, so choosing an option does not jump to the top. The page stays server-rendered.

**Alternative:** a GET form with radio buttons and an "Update" button. It is more "form-like", but it needs a submit step without JavaScript, or client JavaScript to auto-submit. Links give one-step selection everywhere. `aria-current` plus the visible text expose the state.

**Invalid values:** a malformed `color` or `size`, or one the product does not offer, is ignored silently. There is no notice: unlike catalog filters, nothing here is "lost" from the customer's point of view.

### D5. Size guide

`size-guide.ts` holds three static tables in centimetres: letter sizes (XS–XXL: chest, length, sleeve), waist sizes (28–34: waist, inseam, leg opening), and one size. The system is chosen from the product's active sizes:
- all of them are letter codes: the letters table
- all are waist numbers: the waist table
- all are `OS`: one size
- otherwise: no guide

**Rendering:**
- The table shows only the product's sizes, in its size order.
- It sits in a native `<details>` ("Size guide") with a captioned table, which needs no JavaScript.

**Content:** the values are placeholder content until the brand supplies real ones. They are kept in one typed module, like the homepage content.

### D6. Page layout and media

- **From 1024 px:** two columns. The gallery is on the left, as a two-column grid of 4:5 images with the first one spanning both. The details sit on the right in a sticky column.
- **Below 1024 px:** the gallery is a horizontally scrolling, snap-aligned list inside its own box (no page overflow), followed by the details.
- **Images:**
  - Every image uses `FallbackImage` at 4:5, so space is reserved.
  - The first image loads eagerly with high fetch priority; the rest are lazy.
  - With no images, one placeholder frame is shown.
- **Motion:** no motion besides the existing reduced-motion-aware focus styles.

### D7. SEO

- **Title:** the product name, with the layout template "· InThisEconomy".
- **Description:** the description collapsed to single spaces and cut at a word boundary to at most 160 characters with "…". With no description: "<Name> from InThisEconomy."
- **Canonical:** `/products/<slug>`, made absolute by `metadataBase`.
- **Indexing:** indexable.
- **404:** non-active products get Next's not-found page, whose metadata is not indexable.

### D8. Tests and fixtures

- **API:** integration tests for every changed or added `store-catalog-api` scenario.
- **Storefront unit tests:**
  - `selection.ts`: defaults, keep or drop the size on color change, states, price, gallery order
  - `size-guide.ts`
  - the mappers and SEO
  - the moved `FallbackImage`
  - the homepage-card baseline, unchanged
- **Catalog E2E fixtures:**
  - **Still exactly 30 active products.** One filler tee becomes "Allowance Cap" (one size, accessories, price above the cheapest product).
  - **Color-linked images:** the fixture helper gains an optional `color` per image, linked to the first variant of that color. "Two Tone Hoodie" gets a black image, an off-white image, and an untagged image.
  - Existing products cover waist sizes ("Minimum Wage Cargo"), a price range ("Zip Hoodie"), sold out ("Sold Out Tee"), and a missing combination ("Two Tone Hoodie": `L` only in off-white).
- **E2E specs:**
  - A new `product-detail` spec file holds the product-page scenarios.
  - The catalog's placeholder E2E file is removed; its "Unavailable product page" test moves.
  - The catalog SEO and accessibility tests drop the placeholder URLs.

## Risks / Trade-offs

- **[Changing the by-slug response shape]** → Additive fields only. The one consumer (the storefront) is updated in the same change, and both apps are released together (see Migration Plan).
- **[Placeholder size-guide values could be taken as real]** → They are marked as placeholder content in the module and the tasks, like the homepage content. Replacing them needs no code change beyond that module.
- **[Link-based options create many URL variants of one product]** → The canonical URL drops `color` and `size`, so search engines index one URL per product.
- **[Sizing-system detection misses mixed size sets]** → Such products show no guide rather than a wrong one, and the data stays the admin's to fix.
- **[Stale availability (60 s)]** → Same accepted trade-off as the catalog. No cart exists yet.

## Migration Plan

1. **Release the API and the storefront together.** The deployed storefront parses the by-slug response with the strict summary schema, so it would reject the new fields. The new storefront requires them. Neither order of separate deploys works, so both apps ship in one release.
2. **No database migration.**
3. **Rollback:** redeploy both apps' previous versions together.
4. **After archive:** CI coverage swaps `product-detail` for `specs/storefront-product-detail`. The catalog specs are already listed.
