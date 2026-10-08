# Spec Delta

## MODIFIED Requirements

### Requirement: Product listing and detail
Staff with `catalog:read` SHALL be able to list products using the `{ data, nextCursor }` envelope with opaque cursors. `limit` SHALL default to 20 and be at most 100. Results are ordered by creation, newest first. Optional filters SHALL be `status` (default: every status except `ARCHIVED`), `categoryId`, and `q` (case-insensitive name contains). List items SHALL include the base price, status, category, the variant count, the primary image, and a stock summary: the total `stockQuantity` across the product's `ACTIVE` variants, the number of `ACTIVE` variants, and how many of those have a `stockQuantity` of 0. The detail response SHALL include the product with its category, variants (each with its effective price and stock), images in display order, and attribution. Responses SHALL NOT include database-only fields.

#### Scenario: Paginate products
- **WHEN** 25 products exist and staff request the list with `limit=20`, then request again with the returned `nextCursor`
- **THEN** the first page has 20 products and a cursor, the second has the remaining 5 and `nextCursor: null`, with no duplicates or gaps

#### Scenario: Archived products hidden by default
- **WHEN** staff list products without a status filter
- **THEN** `ARCHIVED` products are excluded, and they are included when `status=ARCHIVED` is requested

#### Scenario: Product detail shape
- **WHEN** staff fetch a product by id
- **THEN** the response matches the published `ProductDetail` schema, including category, variants with `effectivePrice` and `stockQuantity`, ordered images, `createdBy`, and `updatedBy`

#### Scenario: Unknown product
- **WHEN** staff fetch a product id that does not exist
- **THEN** the API responds `404` with code `NOT_FOUND`

#### Scenario: Stock summary in the product list
- **WHEN** a product has `ACTIVE` variants with stock 5, 7, and 0 and an `INACTIVE` variant with stock 100, and staff list products
- **THEN** its list item reports a total stock of 12 across 3 active variants, 1 of them out of stock, and a product without variants reports 0, 0, and 0

## ADDED Requirements

### Requirement: Store currency setting
Staff with `catalog:read` SHALL be able to read the catalog settings, which contain the store currency (the `STORE_CURRENCY` the API enforces for every price), so admin clients can show it and build prices in it. The setting SHALL be read-only: no endpoint SHALL change the store currency. Unauthenticated requests SHALL receive `401`.

#### Scenario: Read the store currency
- **WHEN** staff with `catalog:read` request the catalog settings on an API configured with `STORE_CURRENCY=IDR`
- **THEN** the response is `200` with `storeCurrency: "IDR"`, and with `STORE_CURRENCY=USD` it reports `USD`

#### Scenario: Store currency cannot be changed through the API
- **WHEN** a staff member sends a `PUT`, `PATCH`, or `POST` to the catalog settings
- **THEN** the API does not change the store currency, responding as for an unknown route, and the setting still reports the configured value
