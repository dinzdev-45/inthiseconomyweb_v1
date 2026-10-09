# Design

## Context

See `proposal.md` for motivation; requirements are in `specs/`.

**What exists today:**
- **Catalog visibility** is enforced in SQL in three places:
  - `store-catalog`: the page query (with the summary extras) and the filter options
  - `store-cart`: the sellable-variant lookup and the cart view's line status
  - `orders`: the conditional stock take
  
  None of them knows about time: they test product and variant status only.
- **Admin catalog API modules** (`catalog/products`, `catalog/variants`, …) follow routes / service / repository, with attribution, `catalog:read` or `catalog:manage` permissions, and a route-coverage table test.
- **The admin app** has catalog screens under `/catalog/*` with list, form, confirmation, and error patterns (see `admin-catalog-ui`).
- **Storefront:**
  - The homepage is prerendered with no revalidation. `getHomeContent()` returns static content, including a placeholder drop rendered by `DropFeature`, whose countdown area is reserved but empty.
  - The `drops` feature folder holds `DropFeature`, `DropSummary`, and `formatReleaseDate`.
  - The no-API E2E suite asserts the homepage's 9 sections and that it is static.
- **E2E:** the catalog suite's fixtures keep exactly 30 active products in a fixed order. Several tests rely on that.

## Goals / Non-Goals

**Goals:**
- One release rule, in one SQL fragment, used everywhere a product could be shown or sold, evaluated against the injectable clock.
- Drops add no per-visit API work to the homepage. A failing API never breaks the homepage.
- Admin drop screens reuse the admin catalog's existing patterns rather than inventing new ones.

**Non-Goals:**
- Scheduled jobs: a release needs no job, because the rule is time-based.
- Drop-level caching beyond the existing 60 s store caching.
- Moving the rest of the homepage content (products, look) to real data.

## Decisions

### D1. Data model (one migration)

```
drop_status    enum: DRAFT, PUBLISHED
drops          id, slug unique, collection, title, description null, release_at timestamptz(3),
               image_url null, image_alt null, status drop_status default DRAFT,
               created_at, updated_at, created_by, updated_by (attribution, as catalog tables)
drop_products  drop_id → drops ON DELETE CASCADE, product_id → products ON DELETE RESTRICT,
               position int, PRIMARY KEY (drop_id, product_id), UNIQUE (product_id)
```

- **One drop per product** is `UNIQUE (product_id)` in the database, not only in the service. Inserting a product that is in another drop maps the unique violation to `PRODUCT_IN_OTHER_DROP`.
- **Constraints:** CHECKs cover the slug format, collection and title lengths, and "image URL and alt are both set or both null".
- **Indexes:** `(release_at)` serves the overview, and `(product_id)` is covered by the unique index.

### D2. The release rule

`modules/drops/release.ts` exports `unreleased(productAlias, now)`, a Prisma SQL fragment:

```sql
EXISTS (SELECT 1 FROM drop_products dp JOIN drops d ON d.id = dp.drop_id
        WHERE dp.product_id = <alias>.id AND d.release_at > <now>)
```

**Where it is used:**
- **Store catalog:** the page query (`AND NOT unreleased`, unless a drop filter asks for that drop's products), the filter options, and the by-slug lookup. By slug, a product in a published drop returns with `releaseAt`, and one in a draft drop is treated as not found.
- **Store cart:**
  - The sellable-variant lookup returns `unreleased`, and the service turns it into `NOT_RELEASED`.
  - The cart view's status `CASE` gains `WHEN unreleased THEN 'UNAVAILABLE'`.
- **Orders:** `takeStock` adds `AND NOT unreleased`. Checkout already refuses non-`AVAILABLE` lines, so this only closes the race.

**Time source:** `now` comes from the injectable `Clock`. The store-catalog and store-cart services currently pass no time, so they gain a `clock` dependency, and tests move time with `FakeClock`.

**Staleness:** catalog responses are cached for 60 s (API) plus 60 s (storefront fetch revalidation), so a released product can appear in the shop up to about two minutes late. Adding to the cart reads live data, so it opens exactly at the release time. This is accepted and noted in Risks.

### D3. Admin drops API (`modules/drops`)

**Routes** (under `/api/v1/admin`), with permissions:

| Route | Permission |
|---|---|
| `GET /drops` | `catalog:read` |
| `POST /drops` | `catalog:manage` |
| `GET /drops/:id` | `catalog:read` |
| `PATCH /drops/:id` | `catalog:manage` |
| `PUT /drops/:id/products` | `catalog:manage` |
| `POST /drops/:id/publish` | `catalog:manage` |
| `POST /drops/:id/unpublish` | `catalog:manage` |
| `DELETE /drops/:id` | `catalog:manage` |
| `GET /drops/:id/candidates` | `catalog:read` |

The route-coverage table gains these entries, with HEAD for each GET.

- **Slug generation** reuses the catalog slug helper (unique suffixes).
- **Writes:** each write locks the drop row, and attribution uses `withAttribution`.
- **`PUT products`:** replaces the set in one transaction (delete, then insert with positions). It refuses unknown ids (`UNKNOWN_REFERENCE`) and products in other drops (`PRODUCT_IN_OTHER_DROP`, with that drop's id in `errors[]`).
- **Publish readiness:** reported like product activation readiness: `409 DROP_NOT_READY`, with an `errors[]` entry per missing item (`title`, `releaseAt`, `image`, `products`).
- **Admin responses** carry the products with id, name, slug, status, and primary image, enough for the picker.
- **Picker search:** `GET /drops/:id/candidates?q=` (`catalog:read`) returns up to 20 products by name, each with the drop it already belongs to. The admin product list is unchanged, so the `product-management` spec needs no change.

### D4. Public drops API (`modules/store-drops`)

- **`GET /drops`:** one query over `PUBLISHED` drops with `release_at` and a visible-product count. The service splits the rows into `upcoming`, `current`, and `archive` against the clock.
- **`GET /drops/:slug`:**
  1. the drop
  2. its products through `store-catalog`'s page query, with a new internal filter `{ dropId }` that includes that drop's unreleased products, keeps `ACTIVE` products only, orders by drop position, and is not paginated (at most 100)
  3. the summary extras, as usual

  Each summary gains `releaseAt` from the same fragment.
- **Contracts:** `StoreDropSummary`, `StoreDropsOverview`, and `StoreDropDetail`. `StoreProductSummary` and `StoreProductDetail` gain an optional-nullable `releaseAt`; it is null when released.
- **Caching:** `Cache-Control: public, max-age=60`, as for the catalog.

### D5. Storefront

**`features/drops` grows:**
- **Server loaders:** `getDropsOverview()` and `getDrop(slug)`, with `revalidate: 60`.
- **Pages:**
  - `/drops`, `/drops/[slug]`, and `/drops/archive`, each with metadata and a shared `error.tsx`.
  - No loading boundary on `/drops/[slug]`, so 404s keep their status (the same lesson as the product page).
- **`Countdown`:** a client component.
  - It is given `releaseAt` and the server-rendered `<time>`. It renders days, hours, minutes, and seconds, updating each second.
  - It uses `role="timer"` with `aria-live="off"` and a visible label ("Releases in"), and the `<time>` text stays in the DOM for screen readers and no-JS readers.
  - Under reduced motion there are no transitions on the digits. At zero it calls `router.refresh()` once.
- **`DropFeature`:** fills its reserved area with `Countdown`. Its props and markup otherwise stay.

**Homepage:**
- `getHomeContent()` fetches the overview through `storeGet('/api/v1/store/drops', …, { revalidate: 300 })` inside `try`/`catch`.
  - The drop is `upcoming[0] ?? current`.
  - On any failure it is `null`, so the section is omitted.
- The placeholder drop in `content.ts` is removed.
- `app/page.tsx` exports `revalidate = 300`.
- **Build without an API** (CI's build step and the no-API suite): the homepage prerenders without the drop section and is revalidated later.

**Release state elsewhere:**
- **Catalog cards:** `ProductSummary` gains optional `releaseAt`. The card shows "Releases <date>" as text inside the link when it is set. The homepage card output stays unchanged, since homepage products set none, and the baseline test still holds.
- **Product page:**
  - `ProductDetail` carries `releaseAt`.
  - `PriceBlock` shows "Releases <date and time WIB>" with a link to the drop (the API's detail gains the drop slug as `drop: { slug, title } | null` for that link).
  - `AddToCartForm` receives `releaseAt` and renders the disabled "Releases …" button.
- **Cart:** the add action maps `NOT_RELEASED` to the reason `notReleased` ("This item isn't released yet.").

### D6. Admin screens

They follow the admin catalog's existing structure (`features/catalog/products` patterns):
- **List page:** `/catalog/drops` (`DropList`).
- **Form:** `/catalog/drops/new` and `/catalog/drops/[id]` (`DropForm`).
  - The release is entered as a date and time in WIB (`datetime-local`), converted to UTC with a fixed +07:00 offset (Indonesia has no daylight saving time).
- **Product picker section:** search through the candidates endpoint, results showing "In <drop>" for taken products, a selected list with up and down buttons and remove, and "Save products".
- **Actions section:** publish, unpublish, and delete with the existing confirmation dialog. The missing items from `DROP_NOT_READY` are listed.
- **Navigation:** the catalog navigation adds "Drops" after "Products".

### D7. Tests and fixtures

- **API integration tests:**
  - every `drops-management` and `store-drops-api` scenario
  - the release rule across catalog list, filters, by-slug, cart add, cart view, and checkout `takeStock`, with `FakeClock` moving past `release_at`
  - route coverage
- **Storefront unit tests:**
  - the overview split rendering
  - `Countdown` (fake timers: ticking, zero → refresh, reduced motion), with no per-tick announcement
  - release labels on cards, the price block, and add to cart
  - the homepage drop selection and its failure → omitted
- **Admin unit tests:** the form (WIB conversion), the picker (taken products, reordering), and the actions; plus an **admin E2E** create → add products → publish flow.
- **Catalog E2E fixtures** (counts unchanged):
  - **"Collection 001: Cost of Living":** published, released 2026-10-01, holding the four dev seed active products. It is the current drop and changes nothing in the catalog, because released products stay listed.
  - **"Collection 002: Overtime":** published, releasing in 2099, holding two **new** active products ("Overtime Jacket" and "Night Shift Tee"). They are unreleased, so they never count toward the shop's 30.
  - **"Archive 000":** published, released 2026-09-01, holding one existing filler tee, for the archive page.
  - E2E covers the drops pages, the countdown (with the browser clock faked through Playwright's `page.clock`), unreleased product page and add-to-cart, and accessibility and overflow.
- **No-API suite:**
  - The homepage section count becomes 8 (no drop section without an API).
  - "Static homepage" expects a revalidation of 300 s.
  - The homepage drop scenarios ("Live drop" and "Upcoming drop") move to unit tests of `DropFeature` plus a catalog-E2E check that the homepage shows the upcoming 2099 drop with its countdown.

## Risks / Trade-offs

- **[A released product appears in the shop up to about 2 minutes late]** (two 60 s caches) → Adding to the cart and the product page's release state switch exactly at the release time, and the drop page refreshes at zero. Shorter caches can be considered once traffic is known.
- **[The homepage drop section is up to 5 minutes stale]** and is missing when the API was down during the last revalidation → It is a deliberate trade for a static homepage. Next.js keeps serving the last successful render while a revalidation fails only when the render throws; we prefer an omitted section to a stale-forever page.
- **[The clock skew of the API host decides release]** → Releases use the API's time only, never the browser's. The countdown is cosmetic.
- **[Products of any status can be put in a drop]** → That is intended: staff prepare drafts for a drop and activate them before release. The drop page lists only `ACTIVE` ones.

## Migration Plan

1. **Deploy** the migration (additive), then the API, then admin and storefront (any order between those two).
2. **No release on deploy:** existing products are in no drop, so nothing becomes unreleased.
3. **Rollback:** redeploy the previous apps. The tables stay unused.
4. **After archive:** CI coverage swaps `drops` for `specs/drops-management`, `specs/store-drops-api`, `specs/storefront-drops`, and `specs/admin-drops`.
