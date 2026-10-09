# Tasks

## 1. Data, settings, and contracts

- [x] 1.1 Add the `order_status` enum and the `Order` and `OrderLine` models with one migration (CHECKs for amounts, currency, postal code, order number, line quantity; `(status, payment_deadline)` index; cascades and RESTRICT as in design D1); verify `pnpm db:check` reports no difference and the migration applies to a fresh database
- [x] 1.2 Add `SHIPPING_FLAT_FEE` (required in production, default 2000000) and `FREE_SHIPPING_THRESHOLD` (optional) to the API env (design D4); verify env unit tests (valid, missing in production, out of range, values never printed)
- [x] 1.3 Add `checkout.ts` contracts (`CheckoutSummary`, `PlaceOrderRequest`, `PlaceOrderResponse`, `StoreOrder`, `OrderNumber`, `IndonesianPhone`, `PostalCode`, `PROVINCES`) and the error codes `CART_EMPTY`, `CART_CHANGED`, `ORDER_NOT_FOUND`; verify contract unit tests (phone normalization, 38 provinces, strict bodies, no internal ids or stock in responses)

## 2. Orders API

- [x] 2.1 Add the `orders` module with `GET /checkout` (cart view reuse, shipping fee, `ready`; `no-store`); verify the "Checkout summary", "Free shipping threshold", and "Cart that cannot be checked out" scenario tests
- [x] 2.2 Add `POST /orders` (one transaction: cart lock, re-check, expected total, conditional stock decrements in variant id order, order number and access key, line snapshots, empty the cart; design D2, D3); verify the "Place an order", "Order needs a sellable cart", "Prices changed since the summary", "Last unit sold once", and "Invalid checkout details" scenario tests
- [x] 2.3 Add `GET /orders/:number` with `X-Order-Key` (`no-store`, identical 404s, no customer data in logs); verify the "View an order with its key", "Wrong or missing order key", and "Order keeps what was ordered" scenario tests, plus a log-capture test that order details are never logged
- [x] 2.4 Add the expiry sweeper (`expireDue` with `SKIP LOCKED` batches, stock return and status change in one transaction; `createOrderSweeper` started from `server.ts` only; design D5); verify the "Unpaid order expires", "Expiry returns stock once", and "Orders and adjustments together" scenario tests, and that `buildApp` starts no timer

## 3. Storefront checkout

- [x] 3.1 Add `features/checkout` server loaders (`getCheckoutSummary`, `getOrder`) and the `placeOrder` Server Action (contract-parsed form, field errors and kept values in the returned state, `CART_CHANGED` flag, redirect with the access key; design D7); verify unit tests for each outcome and that no form value is put in a URL
- [x] 3.2 Build `/checkout` (summary aside, `useActionState` form with fieldsets, province select, autocomplete hints, error summary, `aria-invalid`/`aria-describedby`, `noindex`, `error.tsx`) and the cart page's "Checkout" link with the flagged-line note; add the "Checkout Tee" fixture in Filler Tee 19's slot; verify the "Open checkout", "Checkout with nothing to buy", "Checkout unavailable" (no-API suite), "Place an order", "Invalid details in the form", "Cart changed during checkout", "Review the cart", and "Unavailable line in the cart" scenario tests
- [x] 3.3 Build `/orders/[number]` (status with the WIB deadline, lines, totals, delivery details, payment-coming note, 404 for a wrong key, no loading boundary); verify the "Order confirmation", "Expired order", and "Order page without the right key" scenario tests

## 4. Accessibility and layout

- [x] 4.1 Add axe scans (empty checkout form, form with errors, order page), a keyboard checkout test, and the six-width overflow check for checkout and the order page; fix serious or critical violations; verify the "Checkout accessibility scan", "Keyboard checkout", and "Checkout without horizontal overflow" scenario tests

## 5. CI and verification

- [x] 5.1 Add `guest-checkout` to the CI spec-coverage targets and `SHIPPING_FLAT_FEE` where CI and the E2E API need it; verify `pnpm spec:coverage` reports 0 missing for it and every main spec, and that `actionlint` passes
- [x] 5.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:check`, the admin, storefront, and catalog E2E suites, `pnpm format:check`, and `openspec validate --all --strict`; verify everything passes, the homepage is still static and API-free, and no admin endpoint changed
