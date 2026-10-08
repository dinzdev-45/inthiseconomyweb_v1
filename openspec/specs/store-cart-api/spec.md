# store-cart-api Specification

## Purpose

Keeps a guest's cart on the server, identified only by a random cart token, so the storefront can add, change, and show cart lines with current prices and availability, without customer accounts and without trusting prices or quantities from the client.

## Requirements

### Requirement: Guest cart tokens
The store zone SHALL provide cart endpoints under `/api/v1/store/cart`. `POST /api/v1/store/cart` SHALL create an empty cart and return its token: a random value of at least 256 bits, shown only in that response. Every other cart endpoint SHALL identify the cart by the `X-Cart-Token` request header, never by a URL or query parameter. The API SHALL store only a keyed hash of the token. A cart SHALL expire 30 days after it was created or last changed. A missing, malformed, unknown, or expired token SHALL get `404` with code `CART_NOT_FOUND`, the same in every case. Cart endpoints SHALL require no other credentials and SHALL ignore cookies and authorization headers. Cart responses SHALL carry `Cache-Control: no-store`.

#### Scenario: Create a cart
- **WHEN** a client sends `POST /api/v1/store/cart`
- **THEN** the API responds `201` with a new token and an empty cart, and the database holds a hash of the token, not the token

#### Scenario: Cart token in a header only
- **WHEN** a client reads a cart with its token in the `X-Cart-Token` header, and again with the token only in the URL query
- **THEN** the first request returns the cart, and the second responds `404` with code `CART_NOT_FOUND`

#### Scenario: Unknown or expired cart
- **WHEN** a client sends no token, a malformed token, an unknown token, or the token of a cart last changed more than 30 days ago
- **THEN** the API responds `404` with code `CART_NOT_FOUND` and the same detail in every case

### Requirement: Add to cart
`POST /api/v1/store/cart/items` SHALL add a variant identified by `productSlug`, `colorSlug`, and `sizeCode`, with a `quantity` from 1 to 10 (default 1). The body SHALL be strict.
- **Sellable variants only:** the product SHALL be `ACTIVE` and the variant `ACTIVE`. Otherwise the API SHALL respond `409` with code `VARIANT_UNAVAILABLE`, the same for a product or variant that does not exist.
- **Same variant again:** adding a variant already in the cart SHALL increase that line's quantity rather than add a second line.
- **Quantity limit:** a line's quantity SHALL NOT exceed 10. Otherwise `409` with code `QUANTITY_LIMIT`.
- **Stock:** a line's quantity SHALL NOT exceed the variant's stock. Otherwise `409` with code `INSUFFICIENT_STOCK`, without stating the stock.
- **Line limit:** a cart SHALL hold at most 50 lines. Otherwise `409` with code `CART_FULL`.
- **On success:** `200` with the updated cart. A rejected add SHALL change nothing.

#### Scenario: Add a variant
- **WHEN** a customer adds `two-tone-hoodie` in black, size `M`, to an empty cart
- **THEN** the cart has one line for that variant with quantity 1, its current price, and a subtotal equal to that price

#### Scenario: Add the same variant again
- **WHEN** a customer adds a variant that is already in the cart with quantity 2
- **THEN** the cart still has one line for it, now with quantity 3

#### Scenario: Variant that cannot be sold
- **WHEN** a customer adds a variant of a draft, inactive, or archived product, an inactive variant, or a color and size combination that does not exist
- **THEN** the API responds `409` with code `VARIANT_UNAVAILABLE` and the cart is unchanged

#### Scenario: Quantity and stock limits
- **WHEN** a line would exceed 10, or exceed the variant's stock of 4 (for example by adding 5), or a sold-out variant is added
- **THEN** the API responds `409` with `QUANTITY_LIMIT` for the first and `INSUFFICIENT_STOCK` for the others, the body does not state the stock, and the cart is unchanged

### Requirement: Change and remove cart lines
`PATCH /api/v1/store/cart/items/{lineId}` SHALL set a line's quantity (1 to 10), under the same stock and quantity rules as adding. `DELETE /api/v1/store/cart/items/{lineId}` SHALL remove a line. Both SHALL respond with the updated cart. A line id that does not belong to the token's cart SHALL get `404` with code `NOT_FOUND`. Lowering a quantity, or removing a line, SHALL always be allowed, even when the variant is no longer sellable or its stock is lower.

#### Scenario: Change a quantity
- **WHEN** a customer sets a line's quantity from 1 to 3 and the variant has stock 5
- **THEN** the line's quantity is 3 and the subtotal reflects it, while setting it to 6 responds `409` with `INSUFFICIENT_STOCK` and leaves it at 3

#### Scenario: Remove a line
- **WHEN** a customer removes a line
- **THEN** the cart no longer has it, and removing it again responds `404`

#### Scenario: Another cart's line
- **WHEN** a customer changes or removes a line id that belongs to a different cart
- **THEN** the API responds `404` with code `NOT_FOUND` and neither cart changes

### Requirement: Cart view
`GET /api/v1/store/cart` and every cart change SHALL return the cart as:
- `lines`, in the order they were added. Each line has:
  - its id
  - the product (`slug`, `name`, primary image or null)
  - `color` (slug, name)
  - `size` (code, label)
  - `quantity`
  - `unitPrice`: the variant's current effective price
  - `lineTotal`
  - `status`: `AVAILABLE`, `INSUFFICIENT_STOCK` (stock is now below the quantity), or `UNAVAILABLE` (the product or variant is no longer sellable)
- `itemCount`: the sum of quantities of `AVAILABLE` lines
- `subtotal`: the sum of their line totals, in the store currency

Prices SHALL always be computed when the cart is read, never stored or taken from the client. Stock quantities, SKUs, variant and product ids, and staff data SHALL NOT appear.

#### Scenario: Current prices in the cart
- **WHEN** a variant in the cart changes price after it was added
- **THEN** reading the cart shows the new unit price, line total, and subtotal

#### Scenario: Line that is no longer available
- **WHEN** a product in the cart is deactivated, and another line's stock falls below its quantity
- **THEN** the first line has status `UNAVAILABLE`, the second `INSUFFICIENT_STOCK`, neither counts toward `itemCount` or `subtotal`, and no stock quantity is shown

#### Scenario: Customer-safe cart fields
- **WHEN** a customer reads a cart with lines
- **THEN** the response matches the published cart schema exactly, with no stock quantity, SKU, variant id, product id, or attribution field
