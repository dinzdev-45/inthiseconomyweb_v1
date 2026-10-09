# Spec Delta

## MODIFIED Requirements

### Requirement: Cart page
The storefront SHALL provide `/cart`, rendered on the server and not indexed. It SHALL list the cart's lines with the product image (or placeholder), the name linking to the product page with that color and size, color, size, unit price, quantity, and line total, followed by the subtotal and a "Checkout" link to `/checkout`. Each line SHALL let the customer change its quantity (1 to 10) and remove it, without client JavaScript.
- **Flagged lines:** a line that is unavailable or has too little stock SHALL say so in text, and SHALL not count toward the subtotal. While any line is flagged, the page SHALL say that those items must be fixed before checkout, instead of offering the "Checkout" link.
- **Empty cart:** with no lines, or no cart, the page SHALL say the cart is empty and link to the shop.
- **Failed change:** the page SHALL say why it failed and keep the cart as it was.
- **API failure:** if the API cannot be reached, the page SHALL show a friendly "cart unavailable" message with a retry link, inside the header and footer, without error details.

#### Scenario: Review the cart
- **WHEN** a customer with two lines opens `/cart`
- **THEN** each line shows its image or placeholder, linked name, color, size, unit price, quantity, and line total, followed by the subtotal and a "Checkout" link to `/checkout`

#### Scenario: Change a quantity on the cart page
- **WHEN** a customer changes a line's quantity to 2 and applies it
- **THEN** the line shows quantity 2 and the line total and subtotal are updated, and a quantity beyond the stock shows a "not enough stock" message and keeps the previous quantity

#### Scenario: Remove a line on the cart page
- **WHEN** a customer removes a line
- **THEN** the line is gone and the subtotal is updated, and removing the last line shows the empty cart

#### Scenario: Empty cart
- **WHEN** a customer without a cart, or with an empty cart, opens `/cart`
- **THEN** the page says the cart is empty and links to the shop, with no subtotal

#### Scenario: Unavailable line in the cart
- **WHEN** a product in the cart has been deactivated
- **THEN** its line says it is no longer available, can still be removed, and is left out of the subtotal, and the page says it must be removed before checkout instead of offering the "Checkout" link

#### Scenario: Cart unavailable
- **WHEN** the API is not reachable and a customer with a cart cookie opens `/cart`
- **THEN** the page shows that the cart is unavailable with a retry link, the header and footer are present, and no error details are shown
