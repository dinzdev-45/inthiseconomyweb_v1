# Design

## Context

See `proposal.md` for motivation; requirements are in `specs/`.

**What exists today:**
- **API:**
  - The Fastify API has a public store zone (`/api/v1/store`, no session handling by construction) with no routes yet.
  - The product domain (main specs `product-management`, `product-variants-inventory`, `catalog-reference-data`) owns products, variants, stock, images, categories, sizes, and colors. Its rules: only `ACTIVE` products are sellable, effective price = override or base, and an active product always has an active, priced variant, an image, a primary image, and an active category.
  - Prices are stored in the store currency (`STORE_CURRENCY`).
- **Storefront (`apps/web`, Next.js 16):**
  - It reads the API only server-side through `storeGet` (`src/lib/api/store.ts`), with optional `revalidate`.
  - It has a `features/catalog` folder with `ProductCard`, `ProductGrid`, `ProductRail`, and a `ProductSummary` view model, used today by the static homepage.
  - `MediaFrame` renders `next/image` (`fill`) or a decorative placeholder.
  - Money formatting is shared from `@ite/contracts` (`formatMoney`).
  - Navigation already links to `/shop` and `/search`, which 404 today.
- **Constraints from main specs:**
  - **`storefront-homepage`:** the homepage makes no API call and stays static; homepage cards show image, name, color, and price, one link each.
  - **`api-conventions`:** strict queries, problem+json, request ids, and a public store zone without account features.
- **Tests:**
  - Storefront Playwright runs a production build on port 3100 **without** an API. That's how the homepage's no-API scenario is proven.
  - Admin E2E runs API and admin on a recreated `ite_e2e` database.

## Goals / Non-Goals

**Goals:**
- One small public API surface that computes everything the storefront needs (visibility, availability, price range, filter options) from product-domain data, so the frontend contains no product rules.
- A crawlable, shareable, server-rendered catalog that works without client JavaScript for filtering and paging.
- Reuse of the existing card, media, money, and navigation pieces without changing the homepage.

**Non-Goals:**
- Product detail beyond the placeholder, and per-size availability display.
- Collections and drops, popularity sorting, faceted counts per filter value (only per-category product counts).
- Sitemap and robots files, structured data (JSON-LD), and rate limiting the store zone (noted as a risk).
- Image hosting or upload.

## Decisions

### D1. Store catalog module in the API

A new `apps/api/src/modules/store-catalog/` (routes, service, repository), registered in the store zone from `app.ts`:
- **Read-only repository:** it uses Prisma for simple reads and parameterized raw SQL for the list query (D3).
- **Separate from admin:** it does not import admin services or the admin cursor codec. Shared pieces are only the Prisma client, `@ite/contracts` schemas, and the money helpers (`toPrice`).
- **Methods:** routes register `GET` only (Fastify adds `HEAD`); other methods hit the not-found handler.
- **Caching:** responses set `Cache-Control: public, max-age=60`. No cookies are read; the zone has no session plugin.
- **Alternative:** extend the admin product list with a "public" mode. Rejected: different visibility rules, different fields, and a different trust zone. Mixing them risks leaking admin data.

### D2. Contracts (`packages/contracts/src/store-catalog.ts`)

- **`StoreProductSummary`** (strict):
  - `slug`, `name`, `category { slug, name }`
  - `price { min: Money, max: Money }`
  - `availability: 'IN_STOCK' | 'SOLD_OUT'`
  - `colors: { slug, name, hex|null }[]`
  - `image` and `secondaryImage`, each `{ url, alt } | null`
- **`StoreProductListQuery`** (strict, coerced from the query string):
  - `category?` (`Slug`), `size?` (`SizeCode`, normalized), `color?` (`Slug`)
  - `availability?: 'in-stock'`
  - `sort?: 'newest' | 'price-asc' | 'price-desc'` (default `newest`)
  - `q?` (trimmed, 1–100)
  - `page?` (positive int, default 1)
- **`StoreProductListResponse`:** `{ data, page, pageSize, totalItems, totalPages }`.
- **`StoreCatalogFilters`:** `{ categories: { slug, name, productCount }[], sizes: { code, label }[], colors: { slug, name, hex }[] }`.
- **Reuse:** existing primitives (`Slug`, `SizeCode`, `Money`, `ImageUrl`) are reused; nothing from admin responses is.

### D3. Queries: one page query plus one aggregate, no N+1

- **One CTE over `ACTIVE` variants of `ACTIVE` products** computes, per product:
  - effective-price min and max
  - `bool_or(stock_quantity > 0)` for availability
- **Filters** are `EXISTS` subqueries on one variant row:
  - `variant.status = 'ACTIVE'`
  - `size.code = $size` (when given)
  - `color.slug = $color` (when given)
  - `stock_quantity > 0` (when in-stock)
  
  So "same variant" semantics hold.
- **Search:** `name ILIKE '%' || escaped(q) || '%'`, using the same escaping as the admin list.
- **Sorting:**
  - `newest`: `activated_at DESC, slug ASC`
  - `price-asc` / `price-desc`: by the computed min price, then `activated_at DESC, slug ASC`
- **Paging:** `LIMIT 24 OFFSET (page-1)*24`, plus `COUNT(*) OVER ()` for `totalItems`. That's a single statement for the page and its total.
- **Per-page follow-up:** one batched query fetches the page's colors (distinct colors of active variants) and its first two images in display order, for the page's product ids.
- **Total per list request:** two queries, regardless of page size.
- **Filter options:** three small grouped queries over active products and variants.
- **Indexes:**
  - Existing indexes (status/created, variant size/color, image product/sort) cover these.
  - An index on `products (status, activated_at DESC)` is added only if `EXPLAIN` on the seeded data shows a sequential scan problem. Catalog sizes are small: hundreds of products, not millions.
- **Alternative:** compute availability and price in the storefront from admin-style detail payloads. Rejected: N+1, and it moves product rules into the frontend.

### D4. Pagination: numbered pages, not cursors

- **Choice:** the store list uses `page` with a fixed size of 24, plus totals.
- **Reasons:**
  - Customers expect numbered pages and a count ("30 products").
  - Page URLs are crawlable and stable for SEO.
  - Sorting by computed price would need a different cursor key per sort.
  - The public catalog is small enough that `OFFSET` is cheap.
- **The admin list keeps its signed cursor;** the two are separate contracts.
- **Edge cases:**
  - A page past the end returns empty data with real totals, so the storefront can explain it.
  - A fixed page size avoids an unbounded parameter space for caching and SEO.

### D5. Storefront data layer

- **`features/catalog/server/`** (server-only):
  - `getCatalogPage(state)`: one `storeGet` for products and, on the shop, one for filters, in parallel.
  - `getStoreProduct(slug)`
  - A mapper turns `StoreProductSummary` into the card view model.
  - All use `storeGet(..., { revalidate: 60 })`, matching the API's `max-age`. A customer may see a stock change up to a minute late; there is no cart yet, so this only affects the "Sold out" label.
- **`features/catalog/url-state.ts`** (pure, tested):
  - It parses `searchParams` with the same contract primitives, dropping invalid values and recording that something was dropped (for the notice).
  - It builds links for filters, sort, and pages; filter and sort links always drop `page`.
- **Failures:** API failures throw `StoreApiError`. The shop and search routes have an `error.tsx` that shows "catalog unavailable" with a retry link, inside the root layout (so header and footer stay).

### D6. Product card

The existing `ProductCard` and `ProductSummary` stay the homepage contract. `ProductSummary` gains three optional fields:
- `availability?: 'IN_STOCK' | 'SOLD_OUT'`
- `priceMax?: Money` (shows "From" when it differs from `price`)
- `colorLabel?`: the shown color text, for when products have several colors

Homepage content sets none of them, so homepage output is byte-for-byte the same; a regression test checks this. On the card:
- **Sold out:** a "Sold out" text label below the price, also inside the link's accessible name (as visible text, not `aria-label`, so the name and visible text agree).
- **Image fallback:** a small client component `CardImage` wraps `next/image`. On `onError`, or when the mapper dropped a disallowed URL, it renders the existing `MediaFrame` placeholder. It also checks on mount whether the image already failed, the same pre-hydration case fixed in the admin.
- **Unchanged:** the hover swap stays CSS-only and respects reduced motion.

### D7. Images and allowed hosts

`next/image` needs remote hosts declared:
- **A new optional storefront setting,** `STOREFRONT_IMAGE_HOSTS` (comma-separated https hostnames, validated in `env.ts`), becomes `images.remotePatterns`.
- **The mapper keeps:** root-relative paths (served by the storefront's own `public/` or a future CDN in front of it), and `https://` URLs on those hosts.
- **Anything else becomes null** and shows the placeholder.
- **Today's seed paths** (`/images/products/...`) have no files, so they fall back to the placeholder through `onError`. Real photography and hosting are a later concern.

### D8. Routes and rendering

| Route | Rendering | Purpose |
|---|---|---|
| `/shop` | dynamic (search params), server-rendered | catalog with filters, sort, pages |
| `/search` | dynamic, server-rendered | name search, sort, pages; `noindex` |
| `/products/[slug]` | dynamic, server-rendered | placeholder: name, price, availability, back link; `noindex`; 404 when not active |

- **Loading and errors:** each has a `loading.tsx` (skeleton grid with `MediaFrame` placeholders at 4:5 and `aria-busy`) and shares a catalog `error.tsx`.
- **The homepage is not touched:** "Shop all" already points to `/shop`, and nav and cards already point to the new routes.
- **Filters UI:**
  - a GET form with selects (category, size, color), an "In stock only" checkbox, a sort select, and Apply
  - removable "chips" for active filters (links), and "Clear all"
  - below 1024 px, wrapped in `<details><summary>Filter and sort</summary>`
  - no client JavaScript is required
- **Pagination:** links to "Previous", page numbers (current with `aria-current="page"`, windowed ±2 with ellipses), and "Next".
- **Search:** `/search` has a `role="search"` form with a labelled input, plus sort and pages. There are no filters on search in this change, which keeps the view simple.

### D9. SEO

- **Site URL:** a new storefront setting `SITE_URL` (absolute origin; required in production, defaulting to `http://localhost:3000` otherwise) becomes `metadataBase`.
- **`/shop`:** title "Shop", description, canonical `/shop` (or `/shop?page=N`). Indexable.
- **`/shop?category=<slug>`** (optionally with `page`): title "<Category> · Shop", canonical including `category` (and `page`). Indexable.
- **Any `size`, `color`, `availability`, or `sort`:** `robots: noindex, follow`, canonical without those parameters.
- **`/search` and `/products/[slug]` (placeholder):** `noindex`.
- **Invalid parameters:** they're ignored, and the canonical reflects only valid indexable ones.
- **Alternative:** `noindex` everything except `/shop`. Rejected: category pages are the most useful landing pages.

### D10. Accessibility and responsive

- **Products** are a `ul` of cards. Count text ("30 products") sits in a polite live region so it's announced after filtering.
- **Filters:** `fieldset`/`legend` plus labels. Chips are links with names such as "Remove filter: Size M".
- **Focus:** visible focus is inherited from the storefront styles.
- **Grid:** 2 columns below 768 px, 3 at 768 px, 4 at 1024 px and wider. Long names wrap; there's no horizontal scrolling at the six standard widths.
- **Motion:** with a reduced-motion preference, cards don't animate (the existing card CSS already respects it).

### D11. Testing

- **API integration tests** (PostgreSQL, existing harness) for every `store-catalog-api` scenario, with products built through the existing services or direct Prisma.
- **Storefront unit tests** (Vitest, already with Testing Library):
  - URL state parsing and links
  - the mapper (allowed hosts, color label, price range)
  - the card (sold out, "From", placeholder, homepage output unchanged)
  - SEO metadata builders
  - "One catalog request per page", with a mocked `fetch` counting requests
- **Storefront catalog E2E:** a separate Playwright config, `playwright.catalog.config.ts`.
  - It starts the API (port 4200) on its own database (`ite_e2e_store`), migrated and seeded by a global setup through `packages/db` (the dev catalog seed plus generated fixtures: >24 active products, sold-out, multi-variant, draft, inactive, archived).
  - It runs the storefront (port 3200) with `API_URL` pointing at it.
  - Script: `pnpm --filter @ite/web e2e:catalog`.
- **The existing storefront suite keeps running without an API.** It gains "Catalog unavailable" (`/shop` without an API) and keeps proving the homepage makes no API request.
- **Accessibility:** axe in both, with the same WCAG 2.2 A/AA rules. **Responsive:** the six standard widths.
- **CI:** the new E2E config gets its own step, and the coverage step names `storefront-catalog` while active.

## Risks / Trade-offs

- [Up to 60 s stale availability] → Acceptable without a cart. The checkout change will read live stock where it matters.
- [Public, unauthenticated endpoints can be scraped or hammered] → Responses are small, cacheable, and bounded (fixed page size). A shared rate-limit store is already a recorded open item before horizontal scaling.
- [OFFSET pagination drifts if products change between page loads] → Acceptable for browsing. Totals are recomputed per request, and a page past the end is explained, not an error.
- [`ProductSummary` grows optional fields] → Homepage output is checked unchanged by a test, and the homepage spec's card requirements still hold.
- [Images on unknown hosts silently become placeholders] → Intended (safety and `next/image` rules). The storefront logs a warning once per host at server start, so a misconfigured host is noticed.
- [Placeholder product page could be mistaken for the real thing] → It says details are coming soon, has no purchase controls, and is `noindex`.

## Migration Plan

- **No database migration,** unless D3's `EXPLAIN` check adds one index (additive).
- **Deploy order:** API first (new public routes, additive), then the storefront with `SITE_URL` and optionally `STOREFRONT_IMAGE_HOSTS`.
- **Rollback:** redeploy the previous storefront, so `/shop` returns to 404; the API routes can stay unused.
- **After archive:** CI's coverage step swaps `storefront-catalog` for `specs/store-catalog-api` and `specs/storefront-catalog`.

## Open Questions

- Which image host(s) real product photography will use. Configured later through `STOREFRONT_IMAGE_HOSTS`, with no code change.
