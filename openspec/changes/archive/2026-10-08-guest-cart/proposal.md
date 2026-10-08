# Proposal

## Why

Customers can now browse products and choose an exact color and size, but they cannot keep anything: the product page has no "Add to cart", and the header's Cart link leads to a 404. A cart is the next step toward guest checkout. Customers check out as guests only (there are no customer accounts), so the cart must work without signing in.

## What Changes

- **Guest cart in the store API** (`/api/v1/store/cart`):
  - **Storage:** carts are stored on the server and identified only by a random cart token. There is no account and no personal data. The token is sent in a request header, never in the URL, and the database keeps only a keyed hash of it.
  - **Endpoints:**
    - create a cart
    - read it
    - add a variant (by product slug, color slug, and size code)
    - change a line's quantity
    - remove a line
  - **Rules:**
    - Only `ACTIVE` variants of `ACTIVE` products can be added.
    - A quantity is 1–10 per variant and never more than the stock in hand. Stock is checked on every add and change, but it is not reserved.
    - Adding a variant that is already in the cart increases its quantity.
    - A cart holds at most 50 lines.
  - **Reading the cart:**
    - Prices, line totals, and the subtotal are always computed from current prices. Nothing is stored or trusted from the client.
    - Lines whose product or variant stopped being sellable, or whose stock fell below the quantity, are flagged and left out of the subtotal.
    - Stock quantities are never exposed.
  - **Expiry:** a cart expires 30 days after its last change.
- **Storefront cart:**
  - **Add to cart on the product page:** works without client JavaScript and adds one of the selected variant.
    - It is disabled until a size is selected, and the reason is stated in text.
    - When the variant is sold out, the button is unavailable and says so.
    - After adding, the customer lands on the cart with a confirmation. A failure brings them back to the product page with a reason.
  - **`/cart` page:**
    - lines with image, name, color, size, unit price, quantity, and line total
    - change quantity and remove a line
    - the subtotal
    - notices for flagged lines
    - an empty state
    - "Checkout coming soon" in place of checkout
    - `noindex`
  - **Header cart count:** the Cart link shows the number of items. The count loads in the browser from a storefront route, so the homepage stays static and makes no API call. A visitor without a cart cookie causes no API request at all.
  - **Cart cookie:** HTTP-only, set by the storefront server only, and lasting 30 days.

**Out of scope:**
- checkout, shipping, payment, orders, and stock decrements
- stock reservation and restock notifications
- promotions and discount codes
- merging carts across devices (there are no accounts)
- background cleanup of expired carts (they are ignored and can be purged once background jobs exist)

## Capabilities

### New Capabilities

- `store-cart-api`: The guest cart endpoints in the store zone. Covers cart tokens and expiry, adding variants and the rules for doing so (sellability, quantity limit, stock), changing and removing lines, the cart view with current prices and line flags, and errors.
- `storefront-cart`: The cart in `apps/web`. Covers add to cart on the product page, the cart page, the header cart count, the cart cookie, and the cart's states, accessibility, and responsive layout.

### Modified Capabilities

- `storefront-product-detail`: "Product page" no longer forbids an add-to-cart control. The page offers "Add to cart" for the selected variant; quantity and wishlist controls stay out.
- `storefront-navigation`: "No customer account entry points" no longer requires the Cart link to have no item count. It shows the cart's item count, and still no account or wishlist entry.

## Impact

- **Code:**
  - `packages/db`: `carts` and `cart_lines` tables, in one migration.
  - `packages/contracts`: cart request and response schemas, plus new error codes.
  - `apps/api`: a `store-cart` module registered in the store zone.
  - `apps/web`:
    - a `cart` feature: server actions, loaders, the cart page, the add-to-cart form, and the header count
    - the cookie helpers
    - a `/cart/count` route handler
- **APIs:** new public cart endpoints. The catalog endpoints and admin are unchanged.
- **Database:** two new tables. No change to existing tables.
- **Dependencies:** none.
- **Security:**
  - Cart tokens are 256-bit random values, kept only as keyed hashes.
  - No personal data is stored.
  - Abuse limits (rate limiting the store zone) remain the open item already recorded for horizontal scaling.
- **Tests:**
  - API integration tests
  - storefront unit tests
  - catalog E2E grows cart scenarios against the seeded API
  - the no-API storefront suite keeps proving the homepage needs no API
