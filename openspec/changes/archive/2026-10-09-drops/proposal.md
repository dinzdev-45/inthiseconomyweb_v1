# Proposal

## Why

InThisEconomy sells in drops ("Collection 001: Cost of Living"), but drops exist only as placeholder content on the homepage. The header's "New Drop" link and every drop link lead to 404s, and products cannot be held back until a release time. Staff need to plan, publish, and release drops themselves, and customers need drop pages with a countdown and a release they cannot buy ahead of.

## What Changes

- **Drops in the database and admin API:**
  - A drop has a slug, a collection label (e.g. "COLLECTION 001"), a title, an optional description, a release time, an image (URL and alt), an ordered list of products, and a status of `DRAFT` or `PUBLISHED`.
  - Staff with `catalog:manage` create, edit, publish, unpublish, and delete drafts. Staff with `catalog:read` view them.
  - **Rules:**
    - A product belongs to at most one drop.
    - Publishing needs a title, a release time, an image, and at least one product.
- **Release gating:** a product in a drop whose release time is still ahead is **unreleased**, whether the drop is published or a draft:
  - It is left out of the shop, search, and filter options.
  - It cannot be added to a cart.
  - A cart line holding it is flagged and cannot be checked out.
  - Its product page shows the release time instead of "Add to cart", and only when the drop is published (a draft drop's products return 404).
- **Public drop API** (`/api/v1/store/drops`): the drops overview (upcoming, current, and archive) and one published drop with its products. Draft drops are never visible.
- **Storefront pages:**
  - **`/drops`:** the next upcoming drop with a live countdown, or the current live drop, plus a link to the archive.
  - **`/drops/<slug>`:** the drop's image, collection, title, description, status (upcoming with a countdown, now live, or past), and its products as cards. On an upcoming drop, the cards say when they release.
  - **`/drops/archive`:** earlier drops, newest first.
  - **The countdown:** live in the browser (days, hours, minutes, seconds). The release time stays readable without JavaScript, and nothing animates under a reduced-motion preference. At zero, the page refreshes to the live state.
- **Homepage drop section from real data:**
  - The featured drop is the next upcoming one, or else the current one.
  - The reserved countdown area now holds the live countdown.
  - The homepage stays prerendered: it is rebuilt from the API at most every 5 minutes, never per visit. When the API is unavailable, the drop section is left out and the rest still renders.
- **Admin screens:** a "Drops" entry in the catalog navigation, a drops list, and create and edit pages. The edit page has a product picker (search, add, remove, reorder) and publish, unpublish, and delete actions with confirmation.

**Out of scope:**
- restock or release notifications
- per-customer purchase limits
- queues and anti-bot measures for drops
- drop-specific prices
- scheduled automatic publishing (a published drop simply releases at its time)
- image upload (images remain URLs)
- lookbook and "Shop the look"

## Capabilities

### New Capabilities

- `drops-management`: Drops in the admin API. Covers fields, validation, statuses, publish readiness, product membership (one drop per product, order), permissions, and attribution.
- `store-drops-api`: The public drops overview and drop detail. Covers visibility, ordering, statuses (upcoming, live, past), and drop products.
- `storefront-drops`: The `/drops`, `/drops/<slug>`, and `/drops/archive` pages and the countdown. Covers their states, SEO, accessibility, and responsive layout.
- `admin-drops`: The admin screens for drops. Covers the list, create and edit forms, the product picker, and the publish, unpublish, and delete actions.

### Modified Capabilities

- `store-catalog-api`: "Active products only" also leaves unreleased drop products out of lists and filter options. The product detail gains the release time of an unreleased product of a published drop; a draft drop's products are not found.
- `store-cart-api`:
  - "Add to cart" rejects unreleased products (`NOT_RELEASED`).
  - "Cart view" flags an unreleased line as unavailable.
- `storefront-cart`: "Add to cart" shows the release time, unavailable, for an unreleased product.
- `storefront-product-detail`: "Price and availability" shows "Releases <time>" for an unreleased product.
- `storefront-homepage`:
  - "Drop feature" shows the live countdown and uses real drop data.
  - "Placeholder content and data seam" sources the drop from the API.
  - "Performance" allows periodic revalidation instead of a build-only render. The homepage still never calls the API while serving a visitor.
- `admin-catalog-ui`: "Catalog navigation and page access" adds the Drops entry.

## Impact

- **Code:**
  - `packages/db`: `drops` and `drop_products` tables and a `drop_status` enum, in one migration.
  - `packages/contracts`: admin and store drop schemas, plus new error codes.
  - `apps/api`:
    - an admin `drops` module and a store `store-drops` module
    - the release rule added to the catalog list, filter, and detail queries, the cart's add and view, and checkout's stock take
  - `apps/web`:
    - a `drops` feature (loaders, pages, countdown)
    - the homepage content seam now reading the featured drop (ISR)
    - product page release state
    - the cart's add-to-cart release state
  - `apps/admin`: the drops screens and the navigation entry.
- **APIs:** new admin and public drop endpoints, and the admin route-coverage table grows. The catalog, cart, and checkout responses keep their shapes; the product detail gains an optional `release` field.
- **Database:** two tables and one enum (additive).
- **Dependencies:** none.
- **Tests:**
  - API integration tests (including release gating across catalog, cart, and checkout)
  - storefront and admin unit tests
  - catalog E2E with drop fixtures (one upcoming drop with its own products, one past drop) chosen so existing catalog counts do not change
  - admin E2E for the drops screens
