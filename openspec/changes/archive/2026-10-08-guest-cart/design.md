# Design

## Context

See `proposal.md` for motivation; requirements are in `specs/`.

**What exists today:**
- **API:**
  - The store zone is public and has no session handling. Its routes are registered from `app.ts` (`store-catalog` is the model).
  - Errors are problem+json with `ErrorCode` from `@ite/contracts`. `INSUFFICIENT_STOCK` already exists for admin stock adjustments.
  - Admin sessions use 256-bit random tokens stored as an HMAC-SHA-256 keyed with `SESSION_SECRET` (`admin-auth/session-token.ts`).
  - There are no background jobs yet (pg-boss is deferred).
- **Data:** variants have `stock_quantity`, an `ACTIVE`/`INACTIVE` status, and a price override. Products have a status. Variants cannot be deleted (there is no delete route).
- **Storefront:**
  - It reads the API only server-side through `storeGet` (GET only).
  - Features live under `src/features`, compose in routes, and do not import each other's internals (`src/features/README.md`).
  - The header is a Server Component in the root layout; the homepage is statically rendered and must make no API call.
  - The product page is dynamic (search params), with no loading boundary, so non-active products keep their 404.
- **E2E:**
  - The catalog suite runs a real API on the seeded `ite_e2e_store` database, with exactly 30 active products whose counts other tests rely on.
  - The no-API suite proves the homepage is static and API-free.

## Goals / Non-Goals

**Goals:**
- The server owns cart truth: which variants are sellable, prices, totals, the quantity limit, and stock checks. The storefront never computes or trusts them.
- Every cart action works without client JavaScript: forms posting to Server Actions, then redirects.
- No regression for the static homepage, and no API traffic for visitors without a cart.

**Non-Goals:**
- Reserving stock, decrementing stock, or locking prices (checkout's job).
- Cleaning up expired carts (expired carts are ignored until a job exists).
- Optimistic client-side cart updates or a mini-cart drawer.

## Decisions

### D1. Data model (one migration)

```
carts       id uuid pk, token_hash text unique, created_at, updated_at, expires_at (timestamptz(3))
cart_lines  id uuid pk, cart_id → carts ON DELETE CASCADE,
            variant_id → product_variants ON DELETE CASCADE,
            quantity int CHECK (quantity BETWEEN 1 AND 10), created_at, updated_at,
            UNIQUE (cart_id, variant_id)
```

- **No attribution columns:** carts are not admin-managed.
- **No price or currency columns:** prices are always read live (D4).
- **`variant_id` cascades** so a cart can never block a future catalog change.
- **`expires_at` = last change + 30 days.** It is set on create and on every add, change, or remove. Reads do not extend it.
- **Indexes:** `UNIQUE (cart_id, variant_id)` serves line lookups; `token_hash` is unique.

### D2. Cart token

- **Generation:** `POST /cart` returns a 256-bit random token (base64url). The API stores `HMAC-SHA-256(SESSION_SECRET, "cart:" + token)`. The domain prefix keeps cart and session hashes apart under the shared key. Rotating `SESSION_SECRET` would orphan carts, which is acceptable for carts.
- **Transport:** the token travels in `X-Cart-Token`, never in the URL, so it does not end up in access logs or the `Referer` header.
- **Not found:** unknown, malformed, and expired tokens all give the same `404 CART_NOT_FOUND`.
- **Reuse:** the helpers mirror `session-token.ts` and live in a small shared module rather than being duplicated.

### D3. API module `store-cart`

Routes are `POST /cart`, `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:lineId`, and `DELETE /cart/items/:lineId`. All are in the store zone, return the cart view (`StoreCart` in `@ite/contracts`), and set `Cache-Control: no-store`.

**Writes:** each write runs in one transaction:
1. Lock the cart row (`FOR UPDATE`).
2. Resolve the variant by `(productSlug, colorSlug, sizeCode)` with the product `ACTIVE` and the variant `ACTIVE`.
3. Read its `stock_quantity`, without locking the variant: stock is not reserved, so a concurrent sale may still win at checkout.
4. Check `newQuantity ≤ 10` (`QUANTITY_LIMIT`), `≤ stock` (`INSUFFICIENT_STOCK`), and the 50-line cap (`CART_FULL`).
5. Upsert the line, and bump `updated_at` and `expires_at`.

- **Changing and removing:**
  - A quantity change checks only the new quantity.
  - Lowering a quantity is always allowed, even when the variant is no longer sellable or its stock is lower.
  - Removing is always allowed.
- **New error codes:** `CART_NOT_FOUND` (404), `VARIANT_UNAVAILABLE` (409), `QUANTITY_LIMIT` (409), and `CART_FULL` (409). `INSUFFICIENT_STOCK` (409) is reused. Details never contain stock numbers.

### D4. Cart view query

One statement reads the cart's lines:
- joined to variant, product, size, color, and primary image
- with `COALESCE(override, base)` as the unit price
- with the status computed in SQL:
  - `UNAVAILABLE` unless both the product and the variant are `ACTIVE`
  - else `INSUFFICIENT_STOCK` when the stock is below the quantity
  - else `AVAILABLE`

`itemCount`, `subtotal`, and the line totals are computed from those rows in the service. The currency is the product's (always the store currency). Lines come in `created_at` order. A cart request makes two statements: the token lookup or lock, and the view.

### D5. Storefront data layer and cookie

- **`lib/api/store.ts`:** `storeRequest(method, path, schema, { cartToken, body })` is added next to `storeGet`. It sends `X-Cart-Token` when given, uses `cache: 'no-store'`, and keeps the same `StoreApiError` handling.
- **`features/cart/server/`** (`server-only`):
  - **Cookie helpers:** the `ite_cart` cookie is HTTP-only, `SameSite=Lax`, `Secure` in production, path `/`, and kept for 30 days.
  - **`getCart()`:** returns null without a cookie or on `CART_NOT_FOUND`, and throws otherwise.
  - **The Server Actions** below.
- **Server Actions** (`features/cart/actions.ts`):
  - **`addToCart(formData)`:**
    - It creates a cart when none is valid, then posts the item, retrying once with a new cart on `CART_NOT_FOUND`.
    - On success it redirects to `/cart?added=<lineId>`.
    - On failure it redirects back to the product URL with `cart=<reason>`, where the reason is `unavailable`, `stock`, `limit`, `full`, or `failed`.
  - **`updateLine(formData)` and `removeLine(formData)`:** redirect to `/cart?status=<updated|removed|stock|limit|unavailable|failed>`.
  - **Input:** form values are parsed with the contract schemas, and nothing else from the form is trusted.
  - **Why Server Actions:** they work without JavaScript (progressive enhancement) and carry Next's built-in origin check against cross-site posts.

### D6. Pages and composition

- **Add to cart on the product page:** the product route renders the cart feature's `AddToCartForm` and passes it into `ProductDetailView` through a new `cartControl` slot. This keeps the feature boundary.
  - The form posts hidden `productSlug`, `colorSlug`, `sizeCode`, and `returnTo` (the product path with its selection).
  - Without a size, or for a sold-out variant, it renders a disabled button whose text is "Select a size" or "Sold out".
  - A `cart` query parameter shows the failure message (`role="status"`). The product page's selection parsing ignores that parameter.
- **`/cart`:** dynamic, `noindex`, with its own `error.tsx` ("Cart unavailable" and a retry link).
  - **Lines:** each line is an `<li>` with the image (`FallbackImage`, 4:5), a name link (`/products/<slug>?color=&size=`), color, size, and prices.
  - **Quantity:** a small form with a labelled `<select>` (1–10, label "Quantity for <name>, <color>, <size>") and an "Update" button.
  - **Removal:** a "Remove" form button per line.
  - **Messages:** from `added` and `status` in a polite live region.
  - **Footer of the page:** the subtotal and "Checkout is coming soon".
- **Header count:**
  - **Route:** `app/cart/count/route.ts` (dynamic, `no-store`). It returns `{ count: 0 }` without calling the API when there is no cookie, the cart's `itemCount` otherwise, and `503` on API failure.
  - **Badge:** a small client component in the navigation feature (`CartCount`) fetches it on mount and on every pathname change, so it updates after the redirect to `/cart`. It renders a visible badge (`aria-hidden`) and a screen-reader suffix (", 2 items").
  - **Why this keeps the homepage static:** the header stays a Server Component and the homepage stays prerendered. The path `/cart/count` contains no `/api/v1/`, `/health`, or API host, so the existing "Homepage does not depend on the API" check still holds.
- **Alternative:** rendering the count in the server layout. Rejected: reading cookies in the root layout makes every page dynamic, including the homepage, which its spec forbids.

### D7. Tests

- **API integration tests:** every `store-cart-api` scenario, including token hashing (read straight from the database), concurrency of two adds to the same line (the final quantity equals the sum, or one add fails with `QUANTITY_LIMIT`), and expiry with the injectable `Clock`.
- **Storefront unit tests:**
  - `storeRequest`
  - the cookie helpers
  - the action outcome mapping (problem code → redirect reason)
  - `CartView` states: empty, lines, a flagged line, messages
  - `AddToCartForm` states
  - `CartCount`
- **Catalog E2E**, using its own carts per browser context:
  - add, review, change, and remove
  - the limit (Filler tee stock 10, quantity 10, then one more add)
  - an expired cookie
  - the header count, and the homepage still prerendered
  - accessibility, keyboard, and overflow
  - The "Unavailable line in the cart" scenario is covered by a `CartView` unit test, and the API's `UNAVAILABLE` status by an API test. Deactivating a seeded product mid-run would break the other catalog tests' fixed counts.
- **No-API suite:**
  - "Cart unavailable", with a cart cookie and no API
  - "No cart, no count": `/cart/count` answers 0 although the API is down, which proves it made no API call

## Risks / Trade-offs

- **[Carts can be created anonymously and in bulk]** → They are bounded (50 lines, quantity 10), carry no personal data, and expire. Store-zone rate limiting is the existing open item; until then, `POST /cart` is the cheapest abuse target and is called only from the storefront server.
- **[Stock is not reserved]** → The cart may show an item that sells out before checkout. Lines are re-checked on every read and flagged `INSUFFICIENT_STOCK`. Checkout will check again when it decrements stock.
- **[Expired carts accumulate]** → Rows are small. A purge job (`expires_at < now()`) arrives with background jobs. Until then a manual SQL purge is safe because lines cascade.
- **[Rotating `SESSION_SECRET` orphans carts]** → Acceptable: customers see an empty cart and start again.
- **[The header count is fetched in the browser]** → One small request per navigation for visitors with a cart, none without. The count may lag the server by one navigation at most.

## Migration Plan

1. **Deploy** the migration (two new tables, additive), then the API, then the storefront. Old storefronts never call the new endpoints, so the order is safe.
2. **Rollback:** redeploy the previous storefront, so the cart UI disappears. The API endpoints and tables can stay unused, or be dropped by a down migration.
3. **After archive:** CI coverage swaps `guest-cart` for `specs/store-cart-api` and `specs/storefront-cart`. The modified product-detail and navigation specs are already listed.
