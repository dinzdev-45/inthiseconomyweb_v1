# Tasks

## 1. Data and contracts

- [x] 1.1 Add the `Cart` and `CartLine` Prisma models and one migration (`carts`, `cart_lines` with the quantity CHECK, unique `(cart_id, variant_id)`, cascades; design D1); verify `pnpm db:check` reports no difference and `prisma migrate deploy` applies it to a fresh database
- [x] 1.2 Add cart contracts to `@ite/contracts` (`AddCartItemRequest`, `UpdateCartItemRequest`, `CartLineParams`, `StoreCart`, `CreateCartResponse`) and the error codes `CART_NOT_FOUND`, `VARIANT_UNAVAILABLE`, `QUANTITY_LIMIT`, `CART_FULL`; verify contract unit tests (strict bodies, quantity 1–10, slug and size code formats, no stock or id fields in `StoreCart`)

## 2. Store cart API

- [x] 2.1 Add the cart token helpers (256-bit token, `HMAC-SHA-256(SESSION_SECRET, "cart:" + token)`, shared with the session hashing; design D2) and the `store-cart` repository, service, and routes for `POST /cart` and `GET /cart` with expiry through the injectable clock and `Cache-Control: no-store`; verify the "Create a cart", "Cart token in a header only", and "Unknown or expired cart" scenario tests
- [x] 2.2 Add `POST /cart/items` (transaction with cart row lock, sellable-variant lookup, merge into an existing line, quantity, stock, and 50-line checks; design D3) and the cart view query (D4); verify the "Add a variant", "Add the same variant again", "Variant that cannot be sold", and "Quantity and stock limits" scenario tests, plus a concurrent-add test
- [x] 2.3 Add `PATCH` and `DELETE /cart/items/:lineId` (lowering and removing always allowed); verify the "Change a quantity", "Remove a line", "Another cart's line", "Current prices in the cart", "Line that is no longer available", and "Customer-safe cart fields" scenario tests, and that catalog endpoints and the admin route-coverage table are unchanged

## 3. Storefront foundations

- [x] 3.1 Add `storeRequest` to `lib/api/store.ts` (methods, JSON body, `X-Cart-Token`, `no-store`) and the cart cookie helpers and `getCart()` in `features/cart/server` (design D5); verify unit tests for headers, cookie attributes (HTTP-only, SameSite Lax, Secure in production, 30 days), and null on missing cookie or `CART_NOT_FOUND`
- [x] 3.2 Add the Server Actions `addToCart`, `updateLine`, and `removeLine` (contract-parsed form input, create-on-first-add with one retry on `CART_NOT_FOUND`, redirects with outcome reasons); verify unit tests for each problem code → redirect mapping and for the cookie being set on the first add

## 4. Storefront UI

- [x] 4.1 Add `AddToCartForm` and the `cartControl` slot on `ProductDetailView`, wired by the product route, with the failure message from `cart=`; verify the "Add the selected variant", "No size selected", "Sold-out variant cannot be added", "Add fails", "First add creates the cart", and "Product page from a catalog card" scenario tests
- [x] 4.2 Build `/cart` (`CartView` lines, quantity and remove forms, subtotal, "Checkout is coming soon", empty state, messages in a polite live region, `noindex`, `error.tsx`); verify the "Review the cart", "Change a quantity on the cart page", "Remove a line on the cart page", "Empty cart", "Unavailable line in the cart", "Expired cart cookie", and "Cart unavailable" scenario tests (the last in the no-API suite)
- [x] 4.3 Add the `/cart/count` route handler and the navigation `CartCount` client component (visible badge, screen-reader suffix, refetch on pathname change; design D6); verify the "Count after adding", "No cart, no count", "Homepage stays static with a cart", and "No account or wishlist controls" scenario tests, and that the existing homepage and navigation suites still pass

## 5. Accessibility and layout

- [x] 5.1 Add axe scans (empty cart, cart with lines, flagged line, product page with the add-to-cart control), a keyboard test, and the six-width overflow check for the cart; fix serious or critical violations; verify the "Cart accessibility scan", "Keyboard cart use", and "Cart without horizontal overflow" scenario tests

## 6. CI and verification

- [x] 6.1 Add `guest-cart` to the CI spec-coverage targets; verify `pnpm spec:coverage` reports 0 missing for it and every main spec, and that `actionlint` passes
- [x] 6.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:check`, the admin, storefront, and catalog E2E suites, `pnpm format:check`, and `openspec validate --all --strict`; verify everything passes, the homepage is still static and API-free, and no admin endpoint changed
