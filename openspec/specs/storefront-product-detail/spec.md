# storefront-product-detail Specification

## Purpose

Gives customers a real product page: the product's images, description, and every color and size it comes in, with the price and availability of the exact variant they choose, so they can decide what to buy before a cart exists.

## Requirements

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

### Requirement: Product gallery
The gallery SHALL show the selected color's images first, then the images tied to no color, each in display order. Images of other colors SHALL NOT be shown. Every image SHALL have its alt text. A product with no image to show SHALL show the decorative placeholder. An image that is missing or fails to load SHALL show the placeholder, never a broken image.

#### Scenario: Gallery follows the selected color
- **WHEN** a product has a black image, a white image, and an image tied to no color, and a customer selects white
- **THEN** the gallery shows the white image first, then the untied image, and not the black image

#### Scenario: Product without images
- **WHEN** a product has no image to show
- **THEN** the gallery shows the decorative placeholder at the gallery's aspect ratio and no broken-image icon

### Requirement: Color and size selection
The page SHALL offer the product's colors and sizes from its active variants: colors by name, sizes in display order. The choice SHALL be kept in the URL (`color`, `size`), so it can be reloaded, shared, or reached with the back button, and SHALL work without client-side JavaScript.
- **Default color:** when the URL names none, the first color by name that has an in-stock variant, otherwise the first color by name.
- **Default size:** none, unless the product has exactly one size.
- **Selected options:** marked in a way assistive technology announces.
- **Sold-out sizes:** a size whose variant in the selected color is sold out SHALL say "Sold out" in text and stay selectable.
- **Missing combinations:** a size that does not exist in the selected color SHALL be shown as unavailable and SHALL NOT be selectable.
- **Invalid values:** a `color` or `size` that is not well-formed, or that the product does not offer, SHALL be ignored in favor of the defaults, without an error page.

#### Scenario: Choose a color
- **WHEN** a customer selects white on a product offered in black and white
- **THEN** the URL contains `color=white`, white is marked as selected, and the gallery and sizes reflect white

#### Scenario: Choose a size
- **WHEN** a customer selects size `M`
- **THEN** the URL contains `size=M` and keeps the color, `M` is marked as selected, and reloading or going back shows the same selection

#### Scenario: Sold-out size
- **WHEN** the selected color's `L` variant is sold out
- **THEN** the `L` option says "Sold out" in text, and selecting it shows that the variant is sold out

#### Scenario: Combination that does not exist
- **WHEN** a product has `M` and `L` in black but only `M` in white, and white is selected
- **THEN** `L` is shown as unavailable in white and cannot be selected

#### Scenario: Default selection
- **WHEN** a customer opens a product page without `color` or `size`, and the first color by name is sold out in every size
- **THEN** the first color by name with an in-stock variant is selected and no size is selected, and a product with a single size has that size selected

#### Scenario: Invalid selection in the URL
- **WHEN** a customer opens `/products/<slug>?color=purple&size=M%20L`
- **THEN** the page shows the default selection and no error

### Requirement: Price and availability
The page SHALL show:
- **With a size selected:** the selected variant's price and its availability ("In stock" or "Sold out").
- **Without a size selected:** the selected color's price, or "From" its lowest price when its variants' prices differ.
- **A sold-out product:** "Sold out" near the price when every variant is sold out.

Prices SHALL be formatted in their currency. Availability SHALL be stated in text, never by color alone, and stock quantities SHALL NOT be shown.

#### Scenario: Price of the selected variant
- **WHEN** a product's `M` costs Rp 799.000 and its `L` costs Rp 829.000, and a customer selects `L`
- **THEN** the page shows Rp 829.000 and "In stock"

#### Scenario: Price before choosing a size
- **WHEN** no size is selected and the selected color's variants cost Rp 799.000 and Rp 829.000
- **THEN** the page shows "From Rp 799.000"

#### Scenario: Sold-out product
- **WHEN** every variant of a product is sold out
- **THEN** the page says "Sold out" near the price, and every size option says "Sold out"

### Requirement: Size guide
The page SHALL offer a "Size guide", closed by default, that opens and closes with a pointer and the keyboard. It SHALL show a measurement table for the product's sizing:
- **Letter sizes** (such as S to XXL): chest, length, and sleeve per size.
- **Waist sizes** (such as 28 to 34): waist, inseam, and leg opening per size.
- **One size:** a note that the item is one size, with its measurements.

The table SHALL have a caption and header cells, and its measurements SHALL state their unit. A product whose sizes fit none of these systems SHALL show no size guide.

#### Scenario: Open the size guide
- **WHEN** a customer opens the "Size guide" with the keyboard or a pointer
- **THEN** the measurement table is shown, and it closes again the same way

#### Scenario: Size guide matches the product's sizes
- **WHEN** the size guide of a product sized in letters, and that of a product sized by waist, are opened
- **THEN** the first shows chest, length, and sleeve for its sizes, and the second shows waist, inseam, and leg opening

#### Scenario: One-size product
- **WHEN** a one-size product's page is opened
- **THEN** the one size is selected and the size guide says the item is one size

### Requirement: Product page SEO
The product page SHALL be indexable, with:
- **Title:** the product's name.
- **Description:** the product's description, shortened to at most 160 characters, or a generic description when it has none.
- **Canonical URL:** `/products/<slug>`, absolute and based on the configured site URL, without `color` or `size`.

#### Scenario: Product page metadata
- **WHEN** an active product's page is rendered
- **THEN** it has the product's name as title, a description of at most 160 characters, an absolute canonical URL to `/products/<slug>`, and no `noindex`

#### Scenario: Selection does not change the canonical URL
- **WHEN** `/products/<slug>?color=white&size=M` is rendered
- **THEN** its canonical URL is `/products/<slug>` and it is indexable

### Requirement: Product page accessibility
The product page SHALL:
- have no serious or critical automated accessibility violations (WCAG 2.2 A and AA)
- present colors and sizes as labelled groups
- announce the selected options
- be fully usable with a keyboard and a visible focus indicator

#### Scenario: Product page accessibility scan
- **WHEN** a product page is scanned with axe with no selection, with a color and size selected, and with the size guide open
- **THEN** there are zero serious or critical violations

#### Scenario: Keyboard product selection
- **WHEN** a customer uses only the keyboard
- **THEN** they can choose a color and a size, open and close the size guide, and follow the link back to the shop, with a visible focus indicator

### Requirement: Product page layout and performance
The product page SHALL lay out without horizontal scrolling or clipped text at 320, 375, 768, 1024, 1440, and 1920 px. With a reduced-motion preference, nothing on the page SHALL animate.
- **Requests:** rendering the page SHALL make one product request to the API.
- **No layout shift:** gallery media SHALL reserve its aspect ratio.
- **Images:** served through Next.js image optimization; the first gallery image loads first, the rest lazily.
- **Freshness:** product data MAY be up to 60 seconds old.

#### Scenario: Product page without horizontal overflow
- **WHEN** a product page is loaded at 320, 375, 768, 1024, 1440, and 1920 px
- **THEN** no page scrolls horizontally and no text is clipped

#### Scenario: One product request per page
- **WHEN** a product page is rendered
- **THEN** the storefront makes exactly one product request to the API

#### Scenario: Reserved product media space
- **WHEN** a product page loads, before images arrive
- **THEN** every gallery media frame already has its final aspect ratio, and the measured cumulative layout shift is below 0.1
