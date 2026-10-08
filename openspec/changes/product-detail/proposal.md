# Proposal

## Why

Customers can now browse and search the catalog, but every product link ends on a placeholder that only shows a name and a price. Before a cart can exist, customers need a real product page: see the product properly, pick a color and size, and know whether that exact variant is available and what it costs.

## What Changes

- **Product detail in the store API:** `GET /api/v1/store/products/{slug}` returns a product detail instead of the list summary. It adds, still with only customer-safe fields:
  - the description
  - every image in display order, each tagged with the color it shows (or none)
  - the `ACTIVE` variants: size (code, label, display order), color (slug, name, hex), effective price, and availability (`IN_STOCK` or `SOLD_OUT`, never quantities)
  - no SKUs, ids, stock quantities, attribution, timestamps, or inactive variants
  - list endpoints and the summary shape are unchanged
- **Product detail page `/products/[slug]`** replaces the placeholder:
  - **Gallery:** the selected color's images first, then images not tied to a color; other colors' images are left out. Media reserves its space, and the first image loads first.
  - **Color and size selection:** kept in the URL (`?color=<slug>&size=<code>`), server-rendered, and working without client JavaScript. Each option says when it is sold out, in text. Size and color combinations that do not exist are shown as unavailable.
  - **Price and availability:** the selected variant's price and availability. Before a size is chosen, the color's price or price range.
  - **Size guide:** a disclosure on the page with a static measurement table for the product's sizing (letter sizes, waist sizes, or one size).
  - **Details:** the description, category, and a link back to the shop.
  - **No cart:** no add-to-cart, quantity, or wishlist control. There is no cart yet.
- **SEO:** the product page becomes indexable, with a title, a description, and a canonical URL without `color` or `size`.
- **Placeholder removed:** the catalog's "Product page placeholder" requirement goes away. The SEO and accessibility requirements stop referring to it.

**Out of scope:**
- the cart, add to cart, checkout, and restock notifications
- reviews, recommendations, related products, and "Shop the look"
- structured data (JSON-LD)
- the standalone `/size-guide` page linked from the footer (it stays a planned page)
- admin-managed size guides, and changes to the admin

## Capabilities

### New Capabilities

- `storefront-product-detail`: The product detail page in `apps/web`. Covers the gallery, color and size selection in the URL, per-variant price and availability, the size guide, unavailable and sold-out states, the 404 for non-active products, SEO, accessibility, responsive layout, and performance.

### Modified Capabilities

- `store-catalog-api`:
  - `GET /products/{slug}` returns a customer-safe product detail (description, color-tagged gallery, `ACTIVE` variants with price and availability) instead of the list summary.
  - The summary rules apply to lists.
- `storefront-catalog`:
  - The "Product page placeholder" requirement is removed (replaced by `storefront-product-detail`).
  - "Catalog SEO" and "Catalog accessibility" no longer mention the placeholder.

## Impact

- **Code:**
  - `packages/contracts`: a `StoreProductDetail` schema.
  - `apps/api`: the `store-catalog` module's by-slug read returns the detail. It stays in the same module and keeps the same visibility rules, with a bounded number of queries.
  - `apps/web`:
    - a `product-detail` feature: loader and mapper, gallery, option pickers, size guide, and metadata
    - `/products/[slug]` route, loading, and error states
    - removal of the catalog placeholder component
- **APIs:** one public response shape grows (additive fields; the summary fields stay). No admin endpoint changes.
- **Database:** none. Images already link to variants, and variants link to colors.
- **Dependencies:** none.
- **Tests:**
  - API integration tests
  - storefront unit tests
  - catalog E2E fixtures gain gallery images per color and a multi-size, multi-color product
  - spec coverage for the active change in CI

**Assumption:** a size guide is chosen by the sizing system of the product's sizes (letters such as S–XXL, waist sizes such as 28–34, or one size), not by category. Categories are broad (for example "Apparel" covers tees and trousers). The measurement values are placeholder content until the brand supplies real ones.
