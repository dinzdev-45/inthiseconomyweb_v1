# Spec Delta

## MODIFIED Requirements

### Requirement: Catalog SEO
- **Titles and descriptions:** catalog pages SHALL have them.
- **Indexable views, each with its own canonical URL:** `/shop`, its numbered pages, and `/shop?category=<slug>` (with its pages).
- **Other filter or sort combinations:** `noindex, follow`, with a canonical URL that drops those parameters.
- **Always `noindex`:** `/search`.

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
- **WHEN** `/search` or `/search?q=hoodie` is rendered
- **THEN** it is `noindex` (product pages are no longer placeholders; their indexing is specified by `storefront-product-detail`)

### Requirement: Catalog accessibility
Catalog pages SHALL:
- have no serious or critical automated accessibility violations (WCAG 2.2 A and AA)
- present products as a list
- label every filter control
- announce the result count
- be fully usable with a keyboard and a visible focus indicator

#### Scenario: Catalog accessibility scan
- **WHEN** the shop (with and without filters) and the search page (with and without results) are scanned with axe
- **THEN** there are zero serious or critical violations

#### Scenario: Keyboard catalog navigation
- **WHEN** a customer uses only the keyboard
- **THEN** they can operate every filter, the sort, the pagination links, and each product card link, with a visible focus indicator

## REMOVED Requirements

### Requirement: Product page placeholder
**Reason**: `/products/<slug>` becomes the full product detail page.
**Migration**: The page's behavior, including the 404 for products that are not active, is specified by `storefront-product-detail`. Catalog cards keep linking to `/products/<slug>`.
