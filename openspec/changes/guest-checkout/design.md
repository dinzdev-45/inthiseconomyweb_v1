# Design

## Context

See `proposal.md` for motivation; requirements are in `specs/`.

**What exists today:**
- **Carts** (`store-cart` module): server-side carts with a token in `X-Cart-Token` (HMAC-hashed). The cart view computes live prices and flags lines `UNAVAILABLE` or `INSUFFICIENT_STOCK`. Writes lock the cart row (`FOR UPDATE`).
- **Stock:**
  - `product_variants.stock_quantity` with `CHECK (>= 0)`.
  - Staff adjustments are a single conditional `UPDATE … SET stock = stock + delta WHERE … AND stock + delta BETWEEN 0 AND max`. They are atomic and lock one row.
  - Other admin variant writes lock the product, then its variants ordered by id.
- **API:**
  - The store zone is public, with problem+json errors and an injectable `Clock`.
  - `buildApp` is used by hundreds of tests.
  - `server.ts` starts and stops the real server.
  - There are no background jobs yet.
- **Storefront:**
  - Server Actions and redirects for cart forms.
  - Features compose in routes, and nothing in the browser calls the API.
  - The cart page shows "Checkout is coming soon".
- **E2E:** the catalog suite runs a real API on the seeded `ite_e2e_store` database (30 active products, with fixed counts other tests rely on).

## Goals / Non-Goals

**Goals:**
- Placing an order is all-or-nothing: re-check, stock decrement, order, line snapshots, and emptying the cart happen in one transaction, and the last unit can never be sold twice.
- Orders are immutable records of what was bought: names and prices are copied, never joined live.
- The order is reachable without an account, and only by whoever holds its key.
- Unpaid orders give their stock back automatically, without a job framework.

**Non-Goals:**
- Payment, emails, courier rates, and admin order screens.
- Data retention and erasure (recorded as an open item).
- Idempotency keys for placing orders: the cart is emptied by the same transaction, so a double submit fails with `CART_EMPTY` instead of creating a second order.

## Decisions

### D1. Data model (one migration)

```
order_status  enum: AWAITING_PAYMENT, EXPIRED   (PAID and others arrive with payment)
orders        id uuid pk, number text unique (ITE-XXXXXXXX), access_key_hash char(64) unique,
              status order_status, email, name, phone, address_line1, address_line2 null,
              city, province char(2)…, postal_code char(5), note null,
              subtotal_amount int, shipping_fee_amount int, total_amount bigint, currency char(3),
              payment_deadline timestamptz(3), placed_at, updated_at, expired_at null
order_lines   id uuid pk, order_id → orders ON DELETE CASCADE,
              variant_id → product_variants ON DELETE RESTRICT,
              product_name, product_slug, color_name, size_code,
              unit_amount int, quantity int CHECK 1..10, line_total_amount bigint, position int
```

- **Constraints:** `CHECK` constraints cover the amounts (non-negative), the currency format, the postal code (`^[0-9]{5}$`), and the order number format.
- **Indexes:** `(status, payment_deadline)` serves the sweeper.
- **Variant link:** `variant_id` is `RESTRICT`. Variants are never deleted, and expiry needs the variant to return stock to.
- **No attribution columns:** orders are created by guests, not staff.

### D2. Order number and access key

- **Order number:** `ITE-` plus 8 characters from Crockford base32 (no I, L, O, or U), so it reads well over the phone. It comes from 40 random bits, and generation retries on the rare unique collision (at most 5 attempts).
- **Access key:** 256 random bits (base64url). It is stored as `HMAC-SHA-256(SESSION_SECRET, "order:" + key)` through the shared `secret-token` helpers. The API reads it only from `X-Order-Key`.
- **The storefront link carries the key in the query** (`/orders/<number>?key=…`). That is what a link in a future email needs. The site's `Referrer-Policy: strict-origin-when-cross-origin` keeps it from leaking to other sites. The page is `no-store` and `noindex`.

### D3. Placing an order: one transaction

Inside one transaction:
1. Lock the live cart row (`FOR UPDATE`, as cart writes do). A missing cart gives `CART_NOT_FOUND`; no lines gives `CART_EMPTY`.
2. Read the cart view rows (the existing D4 query in `store-cart`). Any non-`AVAILABLE` line gives `CART_CHANGED`.
3. Compute the subtotal, shipping fee (D4), and total. A mismatch with `expectedTotal` (amount or currency) gives `CART_CHANGED`.
4. Decrement stock for each line, in variant id order, with the same conditional-update pattern as staff adjustments:
   `UPDATE product_variants SET stock_quantity = stock_quantity - $q WHERE id = $v AND status = 'ACTIVE' AND stock_quantity >= $q`.
   Zero rows updated gives `CART_CHANGED`, and the transaction rolls back. This covers a concurrent sale between steps 2 and 4.
5. Insert the order and its lines (snapshot fields from the view rows), then delete the cart's lines and touch the cart.

- **No deadlocks:**
  - Variant rows are locked in id order, the same order admin variant writes use.
  - Staff adjustments lock a single row.
  - The checkout never locks products, so it cannot wait in a cycle with admin writes.
- **Attribution:** stock updates by orders leave `updated_by` and `updated_at` untouched (the inventory spec change).
- **Reuse:** the cart view query and the cart token hashing are reused by importing from the `store-cart` repository and token modules. The `orders` module depends on `store-cart`, never the reverse.

### D4. Shipping settings

`env.ts` gains:
- **`SHIPPING_FLAT_FEE`:** an integer in minor units of the store currency, `0..CATALOG_PRICE_MAX`. It is required in production; otherwise it defaults to `2000000`, which is Rp 20.000.
- **`FREE_SHIPPING_THRESHOLD`:** optional, same range.

The fee is `0` when the subtotal is at or above the threshold, otherwise the flat fee. Values are validated and never printed, like the other settings. They are exposed only through the summary and the orders.

### D5. Expiry sweeper

- **The sweep:** `orders.expireDue(now)` runs one statement batch of at most 100 orders per call.
  - Select `AWAITING_PAYMENT` orders with `payment_deadline <= now`, `FOR UPDATE SKIP LOCKED`.
  - For each order, return stock (`stock_quantity = stock_quantity + q` per line, in variant id order) and set `status = 'EXPIRED', expired_at = now`. The status change happens in the same transaction, so a crash cannot return stock twice.
  - With `SKIP LOCKED`, concurrent sweepers (several API instances) never take the same order.
- **The timer:**
  - `createOrderSweeper({ orders, clock, log, intervalMs = 30_000 })` returns `start()`, `stop()`, and `runOnce()`.
  - `server.ts` starts it after `listen` and stops it on shutdown.
  - `buildApp` does not start it, so tests stay deterministic. Tests call `runOnce()` with a fake clock.
  - Each sweep logs only counts, never customer data.
- **Alternative:** pg-boss. It is deferred until there is more than one job. The sweeper's statement shape is what a pg-boss job would run anyway.

### D6. API module `orders` and contracts

- **Routes (store zone):**
  - `GET /checkout` (`X-Cart-Token`)
  - `POST /orders` (`X-Cart-Token`, body `PlaceOrderRequest`)
  - `GET /orders/:number` (`X-Order-Key`)
  
  All are `Cache-Control: no-store`.
- **Logging:** request bodies are not logged by the logger configuration. Orders' contact fields never appear in log calls.
- **Contracts (`@ite/contracts`, `checkout.ts`):**
  - `CheckoutSummary`, `PlaceOrderRequest`, `PlaceOrderResponse` (order and `accessKey`), and `StoreOrder`
  - `OrderNumber`, `IndonesianPhone` (normalizes `08…` to `+628…`), and `PostalCode`
  - `PROVINCES`: the 38 provinces with two-letter codes and names
  - **New error codes:** `CART_EMPTY` (409), `CART_CHANGED` (409), and `ORDER_NOT_FOUND` (404)

### D7. Storefront

- **`features/checkout`:**
  - **Server loaders:** `getCheckoutSummary()`, which returns null without a cart cookie, and `getOrder(number, key)`, which returns null on 404 or a malformed key or number.
  - **The Server Action `placeOrder`.**
  - **The form:** a client component that calls `useActionState(placeOrder, initialState)`.
    - Without JavaScript, React's progressive enhancement posts the form and re-renders the page with the returned state. That state carries the field errors, the entered values (rendered back as `defaultValue`), and, on `CART_CHANGED`, a flag. The page then re-reads the summary.
    - Values are never put in URLs, because they are personal data.
  - **On success:** the action redirects to `/orders/<number>?key=<accessKey>`.
- **`/checkout`:** dynamic, `noindex`, with an `error.tsx` ("Checkout unavailable").
  - The summary is in an `<aside>`.
  - The form uses fieldsets ("Contact", "Delivery"), a province `<select>`, `inputmode` and `autocomplete` attributes (email, name, tel, address-line1, address-level2, postal-code), and an error summary list at the top linking to the fields. Each field has `aria-invalid` and `aria-describedby` pointing at its error.
  - **Expected total:** the form posts the expected total as a hidden value. It is the total that was displayed, and the API re-checks it.
- **`/orders/[number]`:** dynamic, `noindex`, `no-store`, with no loading boundary, so a wrong key keeps its 404 status (the same lesson as the product page).
  - The deadline is formatted in `Asia/Jakarta` (WIB).
  - The note says that online payment is coming.
- **Cart page:**
  - The "Checkout is coming soon" note becomes a "Checkout" link (`cta.primary`).
  - When any line is flagged, a note replaces the link: "Remove or update the items marked above to check out."
- **The header count** already refetches on navigation, so it shows an empty cart after the redirect to the order page.

### D8. Tests and fixtures

- **API integration tests** for every `store-checkout-api` scenario and the modified inventory scenario:
  - concurrent last-unit orders (`Promise.all`)
  - the price change between summary and order
  - expiry with the `FakeClock` and two concurrent `runOnce()` calls
  - a snapshot that survives catalog edits
  - details missing from logs, checked with a log stream capture
- **Storefront unit tests:**
  - the action's outcome mapping
  - form state rendering (errors, kept values, the changed-cart message)
  - the order view statuses
  - the deadline formatting in WIB
  - the cart page's checkout link and flagged note
- **Catalog E2E:**
  - Placing orders really decrements fixture stock, so checkout tests use dedicated variants that no other test reads.
  - **One new fixture product, "Checkout Tee"** (white, size S, stock 50), takes the slot of Filler Tee 19: same category, price, and activation hour. The catalog keeps exactly 30 active products in the same order, and checkout tests never touch stock that other tests read. The "last unit" race is tested at the API level, where it is deterministic.
  - E2E covers:
    - place an order
    - invalid details with values kept
    - a changed cart (via a direct price update in the database, like the cart suite's flagged-line setup)
    - nothing to buy
    - the order page and a wrong key
    - accessibility, keyboard, and overflow
- **No-API suite:** "Checkout unavailable".
- **The expired-order page** is a unit test of the order view; driving a 24-hour expiry is not practical in E2E.

## Risks / Trade-offs

- **[Orders cannot be paid until the payment change]** → They expire after 24 hours and return their stock. This change must not be released to customers alone, as stated in the proposal.
- **[Personal data now stored]** → It is returned only with the access key, never logged, and stored only in the orders tables. Retention, erasure, and access by staff are open items for the admin orders and privacy work.
- **[The access key appears in the order page URL]** → The `Referrer-Policy` limits it to the site, and the page is `no-store` and `noindex`. A key leaked from browser history reveals one order, not others. Rotating `SESSION_SECRET` would break existing order links, which is acceptable before launch and recorded for later.
- **[The in-process sweeper]** → It only runs while an API instance runs, so a stopped API delays expiry until restart. It is safe with several instances (`SKIP LOCKED`). It moves to pg-boss with the next job.
- **[A flat shipping fee is approximate]** → It is chosen deliberately. Courier rates are a later change, and the fee is a setting.

## Migration Plan

1. **Deploy** the migration (additive: new enum and two tables), then the API with `SHIPPING_FLAT_FEE` (and optionally `FREE_SHIPPING_THRESHOLD`), then the storefront.
2. **Keep it off production** until the payment change is ready, or release both together.
3. **Rollback:** redeploy the previous apps. The tables can stay. Any `AWAITING_PAYMENT` orders still expire only while the new API runs, so roll back only before real orders exist.
4. **After archive:** CI coverage swaps `guest-checkout` for `specs/store-checkout-api` and `specs/storefront-checkout`.
