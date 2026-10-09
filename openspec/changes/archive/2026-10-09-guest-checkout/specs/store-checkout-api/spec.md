# Spec Delta

## Purpose

Turns a guest's cart into a committed order: it prices the cart with shipping, re-checks it, takes the guest's contact and delivery details, reserves the stock, and keeps an order the guest can open again with a secret key. Unpaid orders expire and give their stock back.

## ADDED Requirements

### Requirement: Checkout summary
`GET /api/v1/store/checkout`, with the cart named by `X-Cart-Token`, SHALL return the cart's lines (as in the cart view), `subtotal`, `shippingFee`, `total` (subtotal plus shipping fee), and `ready`.
- **Shipping fee:** the flat fee from the API setting `SHIPPING_FLAT_FEE` (minor units of the store currency). It SHALL be zero when the optional `FREE_SHIPPING_THRESHOLD` is set and the subtotal reaches it.
- **`ready`:** true only when the cart has at least one line and every line is `AVAILABLE`.
- **Unknown cart:** an unknown or expired cart SHALL get `404 CART_NOT_FOUND`.
- **Caching:** responses SHALL carry `Cache-Control: no-store`.

#### Scenario: Checkout summary
- **WHEN** a cart holds two available lines with a subtotal of Rp 1.528.000, the flat fee is Rp 20.000, and no threshold is set
- **THEN** the summary shows the lines, subtotal Rp 1.528.000, shipping fee Rp 20.000, total Rp 1.548.000, and `ready: true`

#### Scenario: Free shipping threshold
- **WHEN** `FREE_SHIPPING_THRESHOLD` is Rp 1.500.000 and the subtotal is Rp 1.528.000, or Rp 699.000
- **THEN** the shipping fee is Rp 0 for the first and the flat fee for the second

#### Scenario: Cart that cannot be checked out
- **WHEN** the cart is empty, or one of its lines is unavailable or has too little stock
- **THEN** the summary has `ready: false`

### Requirement: Place an order
`POST /api/v1/store/orders`, with the cart named by `X-Cart-Token`, SHALL place an order from the cart. The strict body SHALL hold:
- `email`: a valid address, at most 254 characters, stored lowercased
- `name`: the recipient, 1–100 characters
- `phone`: an Indonesian mobile number (`08…` or `+628…`, 10–15 digits), stored as `+62…`
- `address`:
  - `line1`: 1–200 characters
  - `line2`: optional, at most 200
  - `city`: the city or regency, 1–100
  - `province`: one of Indonesia's provinces by its code
  - `postalCode`: 5 digits
- `note`: optional, at most 500 characters
- `expectedTotal`: the total the customer was shown, as `Money`

All checks and writes SHALL happen in one transaction. Placing an order SHALL fail without any change when:
- the cart is empty (`409 CART_EMPTY`)
- any line is not `AVAILABLE`, or the current total differs from `expectedTotal` (`409 CART_CHANGED`)
- the details are invalid (`400 VALIDATION_FAILED`, with field errors)

On success, the API SHALL:
- decrement each variant's stock by its line's quantity
- create the order with status `AWAITING_PAYMENT`, a unique order number of the form `ITE-` followed by 8 letters and digits, and a payment deadline 24 hours later
- copy each line as it was ordered: product name and slug, color name, size code, unit price, quantity, and line total
- store the subtotal, shipping fee, and total
- empty the cart
- respond `201` with the order and a random access key of at least 256 bits, shown only in this response; only a keyed hash of the key SHALL be stored

#### Scenario: Place an order
- **WHEN** a customer with a ready cart of two lines sends valid details and the expected total
- **THEN** the API responds `201` with an `AWAITING_PAYMENT` order whose lines, totals, and details match, a deadline 24 hours ahead, and an access key; each variant's stock is lower by its quantity, and the cart is empty

#### Scenario: Order needs a sellable cart
- **WHEN** a customer places an order from an empty cart, or from a cart with an unavailable line
- **THEN** the API responds `409` with `CART_EMPTY` or `CART_CHANGED`, no order is created, and no stock changes

#### Scenario: Prices changed since the summary
- **WHEN** a variant's price changes after the customer read the summary, and the customer places the order with the old total
- **THEN** the API responds `409` with code `CART_CHANGED`, and no order is created and no stock changes

#### Scenario: Last unit sold once
- **WHEN** two customers each have the last unit of a variant in their carts and place orders at the same time
- **THEN** exactly one order is created, the other gets `409 CART_CHANGED`, and the stock ends at 0, never below

#### Scenario: Invalid checkout details
- **WHEN** a customer sends an invalid email, a phone number that is not an Indonesian mobile number, an unknown province, a postal code that is not 5 digits, or an unknown field
- **THEN** the API responds `400` with code `VALIDATION_FAILED` and a field error for each, and nothing changes

### Requirement: Guest order view
`GET /api/v1/store/orders/{number}` SHALL return the order to a request whose `X-Order-Key` header holds its access key. The order SHALL include:
- its number, status, payment deadline, and placing time
- the copied lines
- the subtotal, shipping fee, and total
- the contact and delivery details

A missing, wrong, or malformed key, or an unknown number, SHALL get `404` with code `ORDER_NOT_FOUND`, the same in every case. Responses SHALL carry `Cache-Control: no-store`. Contact and address details SHALL NOT be written to logs.

#### Scenario: View an order with its key
- **WHEN** a customer requests their order with its number and access key
- **THEN** the API responds `200` with the order's number, status, deadline, lines, totals, and details

#### Scenario: Wrong or missing order key
- **WHEN** a client requests an order with no key, another order's key, or a key in the URL instead of the header
- **THEN** the API responds `404` with code `ORDER_NOT_FOUND` and the same detail in every case

#### Scenario: Order keeps what was ordered
- **WHEN** a product's name or price changes, or it is deactivated, after an order for it was placed
- **THEN** the order still shows the name, price, and totals it was placed with

### Requirement: Unpaid order expiry
The API SHALL, at least once a minute, mark every `AWAITING_PAYMENT` order whose payment deadline has passed as `EXPIRED`, and return each of its lines' quantities to the variants' stock, whether or not the variant is still sellable. Each order SHALL expire, and its stock SHALL be returned, exactly once, even when several API instances run the sweep at the same time.

#### Scenario: Unpaid order expires
- **WHEN** an order is still `AWAITING_PAYMENT` 24 hours after it was placed and the sweep runs
- **THEN** the order is `EXPIRED` and each ordered variant's stock is higher by the ordered quantity

#### Scenario: Expiry returns stock once
- **WHEN** two sweeps run at the same time over the same expired order
- **THEN** the order is expired once and its stock is returned once
