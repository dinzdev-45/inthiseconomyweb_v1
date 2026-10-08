# Spec Delta

## MODIFIED Requirements

### Requirement: No customer account entry points
The storefront header, mobile menu, and footer SHALL NOT contain any account, sign-in, register, or wishlist link, button, or icon. The Cart link SHALL show the cart's item count when the cart has items (see `storefront-cart`), and SHALL be a plain link otherwise.

#### Scenario: No account or wishlist controls
- **WHEN** the header, mobile menu, and footer are inspected on any screen size
- **THEN** none contains an element whose accessible name or destination refers to account, login, sign in, register, or wishlist
