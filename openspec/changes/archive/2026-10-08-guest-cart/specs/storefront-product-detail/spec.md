# Spec Delta

## MODIFIED Requirements

### Requirement: Product page
For an active product, `/products/<slug>` SHALL show:
- its name and category
- the price (see "Price and availability")
- the gallery
- color and size selection
- an "Add to cart" control for the selected variant (see `storefront-cart`)
- the size guide
- its description, when it has one
- a link back to the shop

The page SHALL be rendered on the server; the browser SHALL NOT call the API. It SHALL NOT offer quantity or wishlist controls. A slug that is not an active product SHALL show the storefront's "Page not found" page with status 404.

#### Scenario: Product page from a catalog card
- **WHEN** a customer follows a catalog card's link
- **THEN** `/products/<slug>` shows that product's name, category, price, gallery, color and size options, an "Add to cart" control, description, and a link back to the shop, with no quantity or wishlist control

#### Scenario: Unavailable product page
- **WHEN** a customer opens `/products/<slug>` for a draft, inactive, archived, or unknown product
- **THEN** the storefront "Page not found" page is shown with status 404
