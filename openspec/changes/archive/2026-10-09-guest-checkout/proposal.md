# Proposal

## Why

Customers can fill a cart but cannot turn it into an order: the cart page says checkout is coming soon. Guest checkout is the step that turns a cart into a committed order with reserved stock, a delivery address, and a total, so the payment change that follows only has to collect money for an order that already exists. Customers never have accounts, so the checkout and the order page must work for guests.

## What Changes

- **Checkout in the store API:**
  - **Summary:** `GET /api/v1/store/checkout` returns the cart's checkout summary: the lines, subtotal, shipping fee, and total.
  - **Shipping:** a flat fee per order, set by the API settings `SHIPPING_FLAT_FEE`, with an optional `FREE_SHIPPING_THRESHOLD` (orders whose subtotal reaches it ship free).
  - **Placing an order:** `POST /api/v1/store/orders` places an order from the cart (by its token). It takes the guest's email, recipient name, phone, and an Indonesian address (street, optional second line, city or regency, province, postal code), plus an optional note, and the total the customer saw. In one transaction it:
    - checks that every line is still sellable, in stock, and priced as shown (otherwise nothing changes and the customer gets the current summary)
    - decrements stock
    - snapshots each line (name, color, size, unit price, quantity)
    - creates the order with status `AWAITING_PAYMENT`, a human-readable order number, and a payment deadline 24 hours ahead
    - empties the cart
  - **Order view:** `GET /api/v1/store/orders/{number}` returns an order to whoever holds its access key (a random secret, stored hashed).
- **Order expiry:** a background sweeper in the API marks `AWAITING_PAYMENT` orders past their deadline `EXPIRED` and restores their stock. It is safe with several API instances.
- **Stock rule change:** stock may now also change through placed orders (decrement) and expired orders (restore). It is still never negative and still never loses concurrent updates.
- **Storefront:**
  - **`/checkout`:** a form for contact and delivery details next to the order summary, with field errors that keep what was typed. It works without client JavaScript and shows a message when prices or stock changed. It is `noindex`.
  - **Placing the order** leads to the order page.
  - **The cart page** offers "Checkout" instead of "Checkout is coming soon".
  - **Order page `/orders/<number>?key=<access key>`:** the order number, status ("Awaiting payment" with the deadline, or "Expired"), lines, totals, and delivery details, plus a note that online payment is coming next. It is `noindex`, and a wrong or missing key gives 404.

**Out of scope:**
- payment (gateway, webhooks, `PAID` status)
- emails
- courier rates and tracking
- promotions
- addresses outside Indonesia
- admin order screens
- customer order lookup by email

## Capabilities

### New Capabilities

- `store-checkout-api`: The checkout summary, shipping fee settings, placing an order from a cart (validation, re-checks, stock decrement, line snapshots, order number, access key, deadline), the guest order view, and the expiry sweeper.
- `storefront-checkout`: The `/checkout` page and form (fields, validation, no-JS behavior, price and stock change handling) and the order page, with their states, accessibility, and responsive layout.

### Modified Capabilities

- `product-variants-inventory`: "Non-negative stock" no longer says stock changes only through staff adjustments. Placed and expired orders also change it, under the same guarantees.
- `storefront-cart`: "Cart page" offers a "Checkout" link when the cart has lines that can be bought, instead of "Checkout is coming soon".

## Impact

- **Code:**
  - `packages/db`: `orders` and `order_lines` tables and an `order_status` enum, in one migration.
  - `packages/contracts`: the checkout and order schemas, a list of Indonesian provinces, and new error codes.
  - `apps/api`:
    - an `orders` module (checkout summary, place order, order view)
    - the expiry sweeper, started with the server
    - the shipping settings in `env.ts`
  - `apps/web`:
    - a `checkout` feature (form, Server Action, loaders)
    - the `/checkout` and `/orders/[number]` routes
    - the cart page's checkout link
- **APIs:** new public endpoints for checkout and orders. The catalog, cart, and admin endpoints are unchanged.
- **Database:** two new tables and one enum. Existing tables are unchanged; stock is written through the existing column and constraint.
- **Dependencies:** none. The sweeper runs in the API process on a timer, until background jobs (pg-boss) arrive.
- **Data:**
  - Orders hold guest contact and address data, the first personal data in the system.
  - It is returned only with the order's access key and never logged.
  - Retention and erasure are a later concern, recorded as an open item.
- **Tests:**
  - API integration tests, including concurrent checkouts for the last unit and the sweeper with the injectable clock
  - storefront unit tests
  - catalog E2E for checkout and the order page
  - the no-API suite for "checkout unavailable"

**Note:** until the payment change lands, orders can be placed but not paid, and they expire after 24 hours. This change should not go live on its own.
