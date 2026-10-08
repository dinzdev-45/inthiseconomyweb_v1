# storefront-catalog Specification

## Purpose

Lets customers browse, filter, sort, and search InThisEconomy's active products on the storefront, as guests, in the existing visual direction. Card links lead somewhere useful until product detail pages exist.

## Requirements

### Requirement: Shop page
The storefront SHALL provide `/shop`, listing active products from the store catalog API:
- **Layout:** a grid of product cards, two columns below 768 px, three at 768 px, and four at 1024 px and wider.
- **Header:** a page heading and the number of matching products.
- **Order:** newest first, 24 products per page.

The page SHALL be rendered on the server; the browser SHALL NOT call the API.

#### Scenario: Shop shows active products
- **WHEN** a customer opens `/shop`
- **THEN** it lists active products as cards, newest first, and shows no draft, inactive, or archived product

#### Scenario: Shop result count
- **WHEN** 30 active products exist and a customer opens `/shop`
- **THEN** the page states that there are 30 products and shows the first 24

### Requirement: Catalog product cards
Catalog products SHALL use the storefront's product card. Each card SHALL show:
- **Image:** the primary image, or the decorative placeholder. A second image appears on hover, as on the homepage.
- **Name.**
- **Color summary:** the color name when there is one color, otherwise the number of colors.
- **Price:** formatted in its currency. When the product's prices differ, it reads "From" followed by the lowest price.

A sold-out product's card SHALL say "Sold out" in text, and that text SHALL be part of the link's accessible name. Availability SHALL NOT be conveyed by color alone, and stock quantities SHALL NOT be shown. The whole card SHALL be one link to `/products/<slug>`. Cards SHALL contain no wishlist, quick-add, or cart control. An image that is missing, or fails to load, SHALL show the decorative placeholder, never a broken image.

#### Scenario: Catalog card content
- **WHEN** an in-stock product with one color and one price is shown in the catalog
- **THEN** its card shows the image, name, color name, and formatted price, with no availability label, as one link to `/products/<slug>`

#### Scenario: Price range on a card
- **WHEN** a product's active variants cost Rp 899.000 and Rp 949.000
- **THEN** its card shows "From Rp 899.000"

#### Scenario: Sold-out card
- **WHEN** a sold-out product is shown in the catalog
- **THEN** its card shows the text "Sold out", the link's accessible name includes "Sold out", and the card is still a link

#### Scenario: Missing or broken product image
- **WHEN** a product has no image, or its image URL fails to load or is not on an allowed host
- **THEN** the card shows the decorative placeholder at the same aspect ratio and no broken-image icon

### Requirement: Filters and sorting
The shop page SHALL offer:
- **Filters:** category, size, color, and "In stock only", with options from the API's filter options
- **Sort:** newest, price low to high, price high to low

The current search, filters, sort, and page SHALL be kept in the URL (`category`, `size`, `color`, `availability`, `sort`, `page`), so a view can be reloaded, shared, or reached with the back button. Applying filters or a sort SHALL return to page 1. Active filters SHALL be listed, each removable, with a way to clear all. Controls SHALL work without client-side JavaScript (a plain form submission).

#### Scenario: Filter the shop by category
- **WHEN** a customer chooses a category and applies the filters
- **THEN** only that category's products are shown, the URL contains `category=<slug>`, and the category appears among the active filters

#### Scenario: Combine shop filters
- **WHEN** a customer chooses a size, a color, and "In stock only" together
- **THEN** only products with an in-stock variant of that size and color are shown

#### Scenario: Sort the shop
- **WHEN** a customer sorts by price, low to high
- **THEN** products are shown from the lowest price upward and the URL contains `sort=price-asc`

#### Scenario: Filters reset to the first page
- **WHEN** a customer on page 2 changes a filter or the sort
- **THEN** the results start again at page 1

#### Scenario: Shareable catalog URL
- **WHEN** a customer reloads, or opens in a new tab, a shop URL with filters, a sort, and a page
- **THEN** the same results, controls, and active filters are shown, and going back restores the previous view

### Requirement: Shop pagination
When there is more than one page, the shop SHALL show:
- numbered page links
- "Previous" and "Next" links
- the current page marked with `aria-current="page"`

All page links SHALL keep the search, filters, and sort. A page number beyond the last page SHALL show a message with a link to page 1.

#### Scenario: Paginate the shop
- **WHEN** 30 active products exist and a customer follows "Next"
- **THEN** page 2 shows the remaining 6 products, marked as the current page, with the same filters and sort

#### Scenario: Shop page beyond the last
- **WHEN** a customer opens `/shop?page=9` for a two-page catalog
- **THEN** the page says there are no products on that page and links to page 1

### Requirement: Search page
The storefront SHALL provide `/search` with a labelled search box (a `search` landmark) and the same cards, sort, and pagination as the shop:
- **The query:** kept in `q`, matching product names containing it, ignoring case.
- **Empty query:** invites the customer to search instead of listing everything.
- **No matches:** says nothing matched and links to the shop.

The header's Search link SHALL lead here.

#### Scenario: Search for a product
- **WHEN** a customer searches for "hoodie"
- **THEN** only active products whose names contain "hoodie" are shown, the URL contains `q=hoodie`, and the search box keeps the query

#### Scenario: Search with no results
- **WHEN** a customer searches for text no product name contains
- **THEN** the page says nothing matched that search and links to the shop

#### Scenario: Empty search
- **WHEN** a customer opens `/search` without a query
- **THEN** the page shows the search box and an invitation to search, and lists no products

### Requirement: Catalog states
- **Loading:** a skeleton grid with the cards' final dimensions.
- **Empty catalog:** when there are no active products, the shop SHALL say the catalog is empty, with a link to the homepage.
- **No matches:** when filters match nothing, it SHALL say so and offer to clear the filters.
- **Invalid URL values:** filter or sort values in the URL that are not well-formed SHALL be ignored, with a short notice that some filters were ignored, rather than an error page.
- **API failure:** if the catalog API fails or is unreachable, the page SHALL show a friendly "catalog unavailable" message with a retry link, inside the normal header and footer, and no technical details.

#### Scenario: Empty catalog
- **WHEN** no product is active and a customer opens `/shop`
- **THEN** the page says there are no products yet and links to the homepage, with no grid

#### Scenario: No filter results
- **WHEN** a customer's filters match no product
- **THEN** the page says no products match and offers a link that clears the filters

#### Scenario: Invalid filter in the URL
- **WHEN** a customer opens `/shop?sort=popular&size=M%20L`
- **THEN** the page shows the unfiltered catalog in the default order with a notice that some filters were ignored

#### Scenario: Catalog unavailable
- **WHEN** the catalog API is not reachable and a customer opens `/shop`
- **THEN** the page shows that the catalog is unavailable with a retry link, the header and footer are present, and no error details are shown

#### Scenario: Catalog loading skeleton
- **WHEN** the shop is loading
- **THEN** placeholder cards with the final card dimensions are shown and marked as busy

### Requirement: Product page placeholder
Until product detail exists, `/products/<slug>` SHALL show:
- an active product's name, its price or price range, and "Sold out" when sold out
- that full details are coming soon
- a link back to the shop

It SHALL NOT offer size selection or any cart control. A slug that is not an active product SHALL show the storefront's "Page not found" page with status 404.

#### Scenario: Product link from a card
- **WHEN** a customer follows a catalog card's link
- **THEN** `/products/<slug>` shows that product's name and price, says full details are coming soon, and links back to the shop

#### Scenario: Unavailable product page
- **WHEN** a customer opens `/products/<slug>` for a draft, inactive, archived, or unknown product
- **THEN** the storefront "Page not found" page is shown with status 404

### Requirement: Homepage to catalog
The homepage SHALL stay static and make no API calls. These links SHALL lead into the catalog:
- its "Shop all" link
- the header's "Shop" and "Search" links
- its product cards

The homepage's content and layout SHALL NOT change.

#### Scenario: Shop all from the homepage
- **WHEN** a customer follows "Shop all" on the homepage
- **THEN** `/shop` opens and lists active products

#### Scenario: Homepage card to a product page
- **WHEN** a homepage product card names a product that is active in the catalog and a customer follows it
- **THEN** that product's page opens, and the homepage itself still made no request to the API

### Requirement: Catalog SEO
- **Titles and descriptions:** catalog pages SHALL have them.
- **Indexable views, each with its own canonical URL:** `/shop`, its numbered pages, and `/shop?category=<slug>` (with its pages).
- **Other filter or sort combinations:** `noindex, follow`, with a canonical URL that drops those parameters.
- **Always `noindex`:** `/search` and the product page placeholder.

Canonical URLs SHALL be absolute, based on the configured site URL.

#### Scenario: Catalog metadata
- **WHEN** `/shop` and `/shop?page=2` are rendered
- **THEN** each has a title, a description, and a canonical URL to itself, and is indexable

#### Scenario: Category view is indexable
- **WHEN** `/shop?category=outerwear` is rendered
- **THEN** it is indexable, its canonical URL includes the category, and its title names the category

#### Scenario: Filter combinations are not indexed
- **WHEN** `/shop?size=M`, `/shop?sort=price-asc`, or `/shop?category=outerwear&color=black` is rendered
- **THEN** it is `noindex, follow`, and its canonical URL drops the size, sort, and color parameters

#### Scenario: Search and placeholder pages are not indexed
- **WHEN** `/search?q=hoodie` or a product page placeholder is rendered
- **THEN** it is `noindex`

### Requirement: Catalog accessibility
Catalog pages SHALL:
- have no serious or critical automated accessibility violations (WCAG 2.2 A and AA)
- present products as a list
- label every filter control
- announce the result count
- be fully usable with a keyboard and a visible focus indicator

#### Scenario: Catalog accessibility scan
- **WHEN** the shop (with and without filters), the search page, and a product page placeholder are scanned with axe
- **THEN** there are zero serious or critical violations

#### Scenario: Keyboard catalog navigation
- **WHEN** a customer uses only the keyboard
- **THEN** they can operate every filter, the sort, the pagination links, and each product card link, with a visible focus indicator

### Requirement: Catalog responsive layout and motion
Catalog pages SHALL lay out without horizontal scrolling or clipped text at 320, 375, 768, 1024, 1440, and 1920 px. Below 1024 px, filters and sort SHALL sit in a closed-by-default "Filter and sort" disclosure. With a reduced-motion preference, cards SHALL NOT animate.

#### Scenario: Catalog without horizontal overflow
- **WHEN** the shop and search pages are loaded at 320, 375, 768, 1024, 1440, and 1920 px
- **THEN** no page scrolls horizontally and no text is clipped

#### Scenario: Filters on small screens
- **WHEN** the shop is loaded at 375 px
- **THEN** the filters are inside a closed "Filter and sort" disclosure that opens and closes by keyboard and pointer

### Requirement: Catalog performance
- **Requests per page:** rendering a shop or search page SHALL make one catalog request (and, for the shop, one filter-options request), never one per product.
- **No layout shift:** card media SHALL reserve its aspect ratio.
- **Images:** served through Next.js image optimization, lazily except the first row.
- **Freshness:** catalog data MAY be up to 60 seconds old.

#### Scenario: One catalog request per page
- **WHEN** the shop page is rendered for 24 products
- **THEN** the storefront makes exactly one product-list request and one filter-options request to the API

#### Scenario: Reserved catalog media space
- **WHEN** the shop loads, before images arrive
- **THEN** every card's media frame already has its final aspect ratio, and the measured cumulative layout shift is below 0.1
