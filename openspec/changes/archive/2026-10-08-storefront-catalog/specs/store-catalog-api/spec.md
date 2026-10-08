# Spec Delta

## Purpose

Gives the storefront a public, read-only view of the catalog, built on the product domain's own data and rules. It shows customers only active products and customer-safe facts about them, so pages can be built without any admin data or business logic in the frontend.

## ADDED Requirements

### Requirement: Public, read-only catalog endpoints
The store zone SHALL provide catalog endpoints under `/api/v1/store`:
- `GET /products`
- `GET /products/{slug}`
- `GET /catalog/filters`

They SHALL require no credentials and ignore any that are sent (cookies, authorization headers). They SHALL accept only `GET` and `HEAD`. Responses SHALL be JSON with problem+json errors and a request id, following the API conventions. Successful responses SHALL carry `Cache-Control: public, max-age=60`.

#### Scenario: Catalog needs no credentials
- **WHEN** a client without any cookie or authorization header requests `/api/v1/store/products`
- **THEN** the API responds `200` with the catalog, and a request carrying an admin session cookie gets the same response

#### Scenario: Catalog is read-only
- **WHEN** a client sends `POST`, `PATCH`, or `DELETE` to a store catalog path
- **THEN** the API responds `404` as for an unknown route and nothing changes

### Requirement: Active products only
Store catalog endpoints SHALL include only products whose status is `ACTIVE`. Draft, inactive, and archived products SHALL NOT appear in lists, filter options, or by slug. Only `ACTIVE` variants SHALL count toward prices, availability, sizes, and colors. A product that is not `ACTIVE` SHALL be indistinguishable from one that does not exist.

#### Scenario: Only active products are listed
- **WHEN** draft, active, inactive, and archived products exist and a customer lists the catalog
- **THEN** only the active products are returned, and the totals count only them

#### Scenario: Non-active product is not found
- **WHEN** a customer requests `/api/v1/store/products/{slug}` for a draft, inactive, or archived product, or an unknown slug
- **THEN** the API responds `404` with code `NOT_FOUND` and the same detail in every case

#### Scenario: Active product by slug
- **WHEN** a customer requests an active product by its slug
- **THEN** the API responds `200` with that product's summary

### Requirement: Customer-safe product summary
A catalog product SHALL be described only by:
- `slug`, `name`, and `category` (`slug` and `name`)
- `price`: `{ min, max }` as `Money`, the lowest and highest effective price among its `ACTIVE` variants, in the store currency
- `availability`: `IN_STOCK` or `SOLD_OUT`
- `colors`: name, slug, and hex of the colors its `ACTIVE` variants use, by name
- `image`: its primary image (`url`, `alt`), or null
- `secondaryImage`: the next image in display order, or null

It SHALL NOT include:
- stock quantities
- SKUs
- internal ids
- staff attribution
- timestamps
- inactive variants
- any other admin-only field

#### Scenario: Customer-safe summary fields
- **WHEN** a customer lists the catalog
- **THEN** every item matches the published store product schema exactly, with no stock quantity, SKU, id, attribution, or timestamp field

#### Scenario: Price range from active variants
- **WHEN** an active product's active variants have effective prices of Rp 899.000 and Rp 949.000, and an inactive variant costs Rp 1.200.000
- **THEN** its `price` is `{ min: Rp 899.000, max: Rp 949.000 }`, and a product whose active variants share one price has equal `min` and `max`

### Requirement: Availability
A product's `availability` SHALL be `IN_STOCK` when at least one of its `ACTIVE` variants has a stock quantity above zero, and `SOLD_OUT` otherwise. Quantities SHALL never be exposed.

#### Scenario: Sold-out product in the catalog
- **WHEN** every active variant of an active product has stock 0
- **THEN** the product is listed with `availability: "SOLD_OUT"`

#### Scenario: Inactive variant stock is ignored
- **WHEN** an active product's only stocked variant is inactive and its active variants have stock 0
- **THEN** the product is `SOLD_OUT`

### Requirement: Catalog filters
`GET /products` SHALL accept these optional filters, combined with AND:
- `category`: a category slug
- `size`: a size code
- `color`: a color slug
- `availability=in-stock`

A size, color, or in-stock filter SHALL match only when one and the same `ACTIVE` variant satisfies every one of them that is given. A well-formed filter value that matches nothing (for example an unknown category slug) SHALL return an empty page, not an error.

#### Scenario: Filter the catalog by category
- **WHEN** a customer lists the catalog with `category=outerwear`
- **THEN** only active products in that category are returned

#### Scenario: Size and color match the same variant
- **WHEN** an active product has variants `M`/black and `L`/white, and a customer filters by `size=M&color=white`
- **THEN** that product is not returned, and `size=M&color=black` returns it

#### Scenario: In-stock filter
- **WHEN** a customer filters by `availability=in-stock`, or by `size=M&availability=in-stock` where the product's size `M` variant has stock 0 but another size is stocked
- **THEN** sold-out products are excluded, and the size-specific query excludes that product

#### Scenario: Unknown filter value
- **WHEN** a customer filters by a well-formed category slug that no active product uses
- **THEN** the API responds `200` with no products and totals of zero

### Requirement: Catalog sorting
`GET /products` SHALL accept `sort` with these values:
- `newest` (the default): by first activation, newest first
- `price-asc`: by `price.min`, ascending
- `price-desc`: by `price.min`, descending

Ties SHALL be broken by newest first, then by slug, so the order is stable across pages. No other sort SHALL be offered.

#### Scenario: Sort by newest
- **WHEN** a customer lists the catalog without a sort
- **THEN** the most recently activated product comes first

#### Scenario: Sort by price
- **WHEN** a customer lists the catalog with `sort=price-asc`, then with `sort=price-desc`
- **THEN** products are ordered by their lowest price ascending, then descending, and products with equal prices keep a stable order across pages

### Requirement: Catalog search
`GET /products` SHALL accept `q` (1–100 characters after trimming), matching products whose name contains it, ignoring case. Characters such as `%` and `_` SHALL be matched literally. Search SHALL combine with filters, sorting, and pagination.

#### Scenario: Search the catalog by name
- **WHEN** a customer searches for `hoodie`
- **THEN** only active products whose names contain "hoodie" in any case are returned

#### Scenario: Search treats wildcards literally
- **WHEN** a customer searches for `%` or `_`
- **THEN** only products whose names contain that character are returned

### Requirement: Numbered pagination
`GET /products` SHALL return `{ data, page, pageSize, totalItems, totalPages }`:
- **`page`:** defaults to 1.
- **`pageSize`:** fixed at 24.
- **Beyond the last page:** a `page` past the end SHALL return no products together with the real totals.

#### Scenario: Catalog page envelope
- **WHEN** 30 active products exist and a customer requests page 1, then page 2
- **THEN** page 1 has 24 products with `totalItems: 30` and `totalPages: 2`, and page 2 has the remaining 6, with no product on both pages

#### Scenario: Page beyond the last page
- **WHEN** a customer requests `page=5` of a two-page catalog
- **THEN** the API responds `200` with no products, `page: 5`, and `totalPages: 2`

### Requirement: Query validation
Catalog queries SHALL be strict. These SHALL be rejected with `400 VALIDATION_FAILED` and field errors:
- an unknown parameter
- an unknown `sort` or `availability` value
- a `page` that is not a positive whole number
- a category or color slug, or a size code, that is not well-formed
- a `q` that is empty or longer than 100 characters

#### Scenario: Invalid catalog query
- **WHEN** a customer requests `/api/v1/store/products?sort=popular`, `?page=0`, `?category=Not%20A%20Slug`, or `?debug=1`
- **THEN** the API responds `400` with code `VALIDATION_FAILED` and a field error for that parameter

### Requirement: Filter options
`GET /catalog/filters` SHALL return the values worth offering as filters:
- the categories of `ACTIVE` products (slug, name, and how many active products each has), by name
- the sizes used by `ACTIVE` variants of `ACTIVE` products (code and label), in display order
- the colors used by those variants (slug, name, hex), by name

Values used only by draft, inactive, or archived products, or by inactive variants, SHALL NOT appear.

#### Scenario: Filter options reflect active products
- **WHEN** a size is used only by a draft product's variant and a color only by an inactive variant
- **THEN** neither appears in the filter options, while every category, size, and color of active products and their active variants does
