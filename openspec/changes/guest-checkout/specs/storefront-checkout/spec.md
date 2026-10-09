# Spec Delta

## Purpose

Lets guests check out their cart on the storefront: enter contact and delivery details, review the total with shipping, place the order without signing in, and come back to the order with a private link.

## ADDED Requirements

### Requirement: Checkout page
The storefront SHALL provide `/checkout`, rendered on the server and not indexed. It SHALL show the order summary (lines with name, color, size, quantity, and line total, plus the subtotal, shipping fee, and total) next to a form for contact and delivery details. Every field SHALL be labelled. Province SHALL be a choice from Indonesia's provinces.
- **Nothing to buy:** without a cart, or with an empty cart, the page SHALL say there is nothing to check out and link to the shop.
- **Cart that is not ready:** when a line is unavailable or short of stock, the page SHALL say which items need attention, link back to the cart, and offer no form.
- **API failure:** if the API cannot be reached, the page SHALL show a friendly "checkout unavailable" message with a retry link, inside the header and footer, without error details.

#### Scenario: Open checkout
- **WHEN** a customer with a ready cart opens `/checkout`
- **THEN** the page shows the lines, subtotal, shipping fee, and total, and a labelled form for email, name, phone, address, city or regency, province, postal code, and an optional note

#### Scenario: Checkout with nothing to buy
- **WHEN** a customer without a cart opens `/checkout`, and another customer whose cart has an unavailable line opens it
- **THEN** the first sees that there is nothing to check out with a link to the shop, and the second sees which item needs attention with a link to the cart, and neither sees the form

#### Scenario: Checkout unavailable
- **WHEN** the API is not reachable and a customer with a cart cookie opens `/checkout`
- **THEN** the page shows that checkout is unavailable with a retry link, the header and footer are present, and no error details are shown

### Requirement: Place an order from the storefront
Submitting the checkout form SHALL place the order and work without client JavaScript.
- **On success:** the customer SHALL be taken to the order page, and the cart SHALL be empty.
- **Invalid details:** the form SHALL be shown again with each problem next to its field, and the values entered SHALL be kept.
- **Cart changed** (the cart changed, or prices or stock changed, since the page was shown): the page SHALL show the updated summary and a message to review it before placing the order, with the entered values kept.

The browser SHALL NOT call the API, and the order's access key SHALL reach the browser only in the order page's URL.

#### Scenario: Place an order
- **WHEN** a customer fills in valid details and places the order
- **THEN** the order page opens showing the new order, and the header's cart count and the cart page show an empty cart

#### Scenario: Invalid details in the form
- **WHEN** a customer submits an invalid email and a 4-digit postal code
- **THEN** the form shows an error next to each of those fields, keeps every value entered, and places no order

#### Scenario: Cart changed during checkout
- **WHEN** a product's price changes after the customer opened checkout and the customer places the order
- **THEN** no order is placed, and the page shows the new total and a message to review it, with the details still filled in

### Requirement: Order page
`/orders/<number>?key=<access key>` SHALL show the order:
- its number
- its status ("Awaiting payment" with the payment deadline in Western Indonesian Time, or "Expired")
- the lines and totals
- the delivery details
- a note that online payment is coming next

It SHALL be rendered on the server, not indexed, and never cached. A missing or wrong key, or an unknown number, SHALL show the storefront's "Page not found" page with status 404.

#### Scenario: Order confirmation
- **WHEN** a customer opens their order page right after placing the order
- **THEN** it shows the order number, "Awaiting payment" with the deadline 24 hours ahead, the lines, subtotal, shipping fee, total, and delivery details

#### Scenario: Expired order
- **WHEN** a customer opens the page of an order that expired unpaid
- **THEN** it shows the order as "Expired" and explains that it was not paid in time

#### Scenario: Order page without the right key
- **WHEN** someone opens an order page with no key or a wrong key
- **THEN** the storefront "Page not found" page is shown with status 404

### Requirement: Checkout accessibility and layout
The checkout and order pages SHALL:
- have no serious or critical automated accessibility violations (WCAG 2.2 A and AA)
- tie each field error to its field, marking the field invalid
- list the errors at the top of the form
- be fully usable with a keyboard and a visible focus indicator
- lay out without horizontal scrolling or clipped text at 320, 375, 768, 1024, 1440, and 1920 px

#### Scenario: Checkout accessibility scan
- **WHEN** the checkout page (empty form and with errors) and an order page are scanned with axe
- **THEN** there are zero serious or critical violations

#### Scenario: Keyboard checkout
- **WHEN** a customer uses only the keyboard
- **THEN** they can fill in every field, choose a province, place the order, and reach the order page, with a visible focus indicator

#### Scenario: Checkout without horizontal overflow
- **WHEN** the checkout page and an order page are loaded at 320, 375, 768, 1024, 1440, and 1920 px
- **THEN** no page scrolls horizontally and no text is clipped
