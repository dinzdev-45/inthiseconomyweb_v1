# Spec Delta

## MODIFIED Requirements

### Requirement: Add to cart
`POST /api/v1/store/cart/items` SHALL add a variant identified by `productSlug`, `colorSlug`, and `sizeCode`, with a `quantity` from 1 to 10 (default 1). The body SHALL be strict.
- **Sellable variants only:** the product SHALL be `ACTIVE` and the variant `ACTIVE`. Otherwise the API SHALL respond `409` with code `VARIANT_UNAVAILABLE`, the same for a product or variant that does not exist.
- **Released products only:** an unreleased product (see `drops-management`) SHALL be refused with `409` and code `NOT_RELEASED`, whatever its drop's status.
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

#### Scenario: Unreleased product cannot be added
- **WHEN** a customer adds a variant of an active product whose drop releases tomorrow
- **THEN** the API responds `409` with code `NOT_RELEASED` and the cart is unchanged, and after the release time the same add succeeds

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
  - `status`: `AVAILABLE`, `INSUFFICIENT_STOCK` (stock is now below the quantity), or `UNAVAILABLE` (the product or variant is no longer sellable, or the product is unreleased)
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

#### Scenario: Line that became unreleased
- **WHEN** a product in the cart is added to a drop releasing tomorrow
- **THEN** its line has status `UNAVAILABLE` and does not count toward `itemCount` or `subtotal`
