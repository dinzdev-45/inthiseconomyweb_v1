# Proposal

## Why

The product domain and the admin catalog now hold real products, but customers still see only placeholder cards. The storefront's "Shop" and "Search" links lead to 404s, and the API's public store zone has no endpoints. Customers need a catalog they can browse, filter, and search, fed by the same products staff manage, before product detail, cart, and checkout can follow.

## What Changes

- **Public catalog API** in the existing store zone (`/api/v1/store`), read-only and unauthenticated:
  - `GET /products`: a page of `ACTIVE` products, with filters (category, size, color, in stock only), sort (newest, price low–high, price high–low), name search, and numbered pages.
  - `GET /products/:slug`: one `ACTIVE` product's summary.
  - `GET /catalog/filters`: the categories, sizes, and colors that `ACTIVE` products actually use, for filter controls.
  - Each product summary contains only customer-safe fields:
    - slug, name, category
    - price range from active variants
    - availability (`IN_STOCK` or `SOLD_OUT`, never quantities)
    - available colors
    - primary and secondary image
  - No admin metadata (ids of staff, timestamps beyond "newest" ordering, stock counts, inactive variants, draft or archived products).
  - Rules come from the product domain: only `ACTIVE` products and `ACTIVE` variants count, and prices are already in the store currency.
- **Shop page `/shop`:**
  - a responsive product grid with URL-driven filters, sort, and numbered pagination
  - a result count
  - empty, no-results, invalid-filter, loading, and error states
- **Search page `/search`:** a search box over the same catalog (name contains), with sort and pagination. Not indexed.
- **Product page placeholder `/products/[slug]`:** a thin, non-indexed page so card links work. It confirms the product is active (otherwise the storefront's 404) and shows its name, price, and availability, with "full details coming soon" and a link back to the shop. The full product detail is a later change.
- **Product cards:** the existing storefront `ProductCard` gains two optional extras: an availability label ("Sold out" as text) and a "from" price for price ranges. Catalog images fall back to the decorative placeholder when missing or broken. Homepage cards are unchanged.
- **Homepage integration (links only):**
  - The homepage stays static and API-free, as its spec requires.
  - Its "Shop all" CTA, the header "Shop" and "Search" links, and its product cards now lead to real pages (`/shop`, `/search`, `/products/<slug>`).
  - No homepage redesign.
- **SEO:**
  - titles and descriptions
  - canonical URLs for `/shop`, its numbered pages, and single-category views
  - `noindex` for search, other filter combinations, and the placeholder product page
- **Store images:** remote image hosts are allowed only through a new storefront setting. Other URLs fall back to the placeholder.

**Out of scope:**
- product detail (gallery, size selection, size guide)
- cart, checkout, payment, shipping, and orders
- customer accounts and wishlist (permanently excluded)
- reviews and recommendations
- popularity or bestseller sorting
- collections and drops
- admin catalog management
- media upload
- sitemap and robots files
- homepage real-data integration

## Capabilities

### New Capabilities

- `store-catalog-api`: Public, read-only catalog endpoints in the store zone. Covers the customer-safe product summary, `ACTIVE`-only visibility, availability from active variants and stock, price ranges, filters, sorting, search, numbered pagination, filter options, and query validation.
- `storefront-catalog`: The customer catalog in `apps/web`. Covers the shop page, search page, catalog product cards (availability, price ranges, image fallback), URL-driven filter/sort/search/pagination, empty, no-results, invalid, loading, and error states, the product page placeholder, SEO rules, accessibility, responsive layout, and performance.

### Modified Capabilities

_None._
- `storefront-homepage` keeps its requirements: cards still show image, name, color, and price, link to `/products/<slug>`, and the homepage still makes no API call.
- `storefront-navigation`'s "Links to pages not built yet" still applies to the remaining planned routes; `/shop`, `/search`, and product links simply stop being 404s.
- `api-conventions` already defines the public store zone that these endpoints use.

## Impact

- **Code:**
  - `apps/api`: a new `store-catalog` module (routes, service, read-only repository queries) registered in the store zone.
  - `packages/contracts`: store catalog request and response schemas.
  - `apps/web`:
    - `features/catalog` server loaders and mappers
    - `/shop`, `/search`, and `/products/[slug]` routes
    - the `ProductCard` extensions
    - the image host setting and `next.config` `images.remotePatterns`
- **APIs:** three new public `GET` endpoints, and no change to admin endpoints.
- **Database:** none. Existing indexes are reviewed for the new queries, and one may be added if a query plan needs it (design D4).
- **Dependencies:** none.
- **Tests:**
  - API integration tests on PostgreSQL
  - storefront unit and Playwright tests (with a seeded API for catalog E2E)
  - spec coverage for the active change in CI
