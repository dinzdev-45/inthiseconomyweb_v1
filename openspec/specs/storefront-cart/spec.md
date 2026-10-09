# storefront-cart Specification

## Purpose

Lets guests put the variant they chose into a cart, review and change it on a cart page, and see how many items they have from any page, without accounts and without the browser calling the API.

## Requirements

### Requirement: Cart cookie
The storefront SHALL keep the cart token in a cookie that is HTTP-only, `SameSite=Lax`, scoped to `/`, `Secure` in production, and kept for 30 days. Only the storefront server SHALL read or set it. The browser SHALL NOT call the API. A cart SHALL be created only when a customer first adds an item. A cookie whose cart has expired or is unknown SHALL be treated as no cart and replaced on the next add.

#### Scenario: First add creates the cart
- **WHEN** a customer without a cart cookie adds an item
- **THEN** a cart is created, an HTTP-only cart cookie is set, and no API request is made from the browser

#### Scenario: Expired cart cookie
- **WHEN** a customer whose cart cookie names an expired or unknown cart opens the cart and then adds an item
- **THEN** the cart page shows an empty cart without an error, and the add creates a new cart and replaces the cookie

### Requirement: Add to cart
The product page SHALL offer an "Add to cart" button for the selected variant that adds one of it and works without client JavaScript.
- **Before a size is selected:** the button SHALL be unavailable, with the text "Select a size".
- **Sold-out variant:** the button SHALL be unavailable, with the text "Sold out".
- **After adding:** the customer SHALL be taken to `/cart`, which confirms what was added.
- **Failed add:** the customer SHALL return to the same product page and selection, with a message saying why. The reasons are that the variant is no longer available, not enough stock, the quantity limit, the cart is full, or the cart is temporarily unavailable.

#### Scenario: Add the selected variant
- **WHEN** a customer selects a color and an in-stock size and presses "Add to cart"
- **THEN** `/cart` opens with that variant as a line with quantity 1 and a confirmation naming the product, color, and size

#### Scenario: No size selected
- **WHEN** a product page has no size selected
- **THEN** the "Add to cart" control is unavailable and says "Select a size"

#### Scenario: Sold-out variant cannot be added
- **WHEN** the selected size is sold out
- **THEN** the "Add to cart" control is unavailable and says "Sold out"

#### Scenario: Add fails
- **WHEN** a customer adds a variant whose quantity in the cart is already 10
- **THEN** the product page is shown again with the same selection and a message that the quantity limit is reached

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

### Requirement: Header cart count
The header's Cart link SHALL show the number of items in the cart (the cart's `itemCount`) when it is above zero, and its accessible name SHALL include it, for example "Cart, 3 items". The count SHALL be loaded in the browser from a storefront route, so pages that are statically rendered stay static. That route SHALL return zero without calling the API when there is no cart cookie. When the count cannot be loaded, the link SHALL remain a plain link.

#### Scenario: Count after adding
- **WHEN** a customer adds two items and then opens any page
- **THEN** the header's Cart link shows 2 and is named "Cart, 2 items"

#### Scenario: No cart, no count
- **WHEN** a visitor without a cart cookie opens the homepage
- **THEN** the Cart link shows no count, and no request reaches the API

#### Scenario: Homepage stays static with a cart
- **WHEN** a customer with items in the cart opens the homepage
- **THEN** the homepage is still served from its static render, and the count appears in the header

### Requirement: Cart accessibility and layout
The cart page and the add-to-cart control SHALL:
- have no serious or critical automated accessibility violations (WCAG 2.2 A and AA)
- label every quantity control with the product it changes
- announce cart messages (added, changed, failed) politely
- be fully usable with a keyboard and a visible focus indicator
- lay out without horizontal scrolling or clipped text at 320, 375, 768, 1024, 1440, and 1920 px

#### Scenario: Cart accessibility scan
- **WHEN** the cart page (empty, with lines, with a flagged line) and a product page with the add-to-cart control are scanned with axe
- **THEN** there are zero serious or critical violations

#### Scenario: Keyboard cart use
- **WHEN** a customer uses only the keyboard
- **THEN** they can add an item from a product page, change a quantity, and remove a line, with a visible focus indicator

#### Scenario: Cart without horizontal overflow
- **WHEN** the cart page with lines is loaded at 320, 375, 768, 1024, 1440, and 1920 px
- **THEN** no page scrolls horizontally and no text is clipped
