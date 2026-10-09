# Spec Delta

## MODIFIED Requirements

### Requirement: Add to cart
The product page SHALL offer an "Add to cart" button for the selected variant that adds one of it and works without client JavaScript.
- **Before a size is selected:** the button SHALL be unavailable, with the text "Select a size".
- **Sold-out variant:** the button SHALL be unavailable, with the text "Sold out".
- **Unreleased product:** the button SHALL be unavailable, with the text "Releases <date and time in WIB>", whatever the selection.
- **After adding:** the customer SHALL be taken to `/cart`, which confirms what was added.
- **Failed add:** the customer SHALL return to the same product page and selection, with a message saying why. The reasons are that the variant is no longer available, not released yet, not enough stock, the quantity limit, the cart is full, or the cart is temporarily unavailable.

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

#### Scenario: Unreleased product cannot be added from its page
- **WHEN** a customer opens the page of a product whose drop releases tomorrow and selects a size
- **THEN** the "Add to cart" control is unavailable and says when the product releases
