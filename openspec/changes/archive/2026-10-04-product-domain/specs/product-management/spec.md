# Spec Delta

## Purpose

Defines how InThisEconomy staff create and maintain products, covering identity, pricing, category, lifecycle, and images, so the storefront, collections, and commerce features can later rely on consistent, validated product data.

## ADDED Requirements

### Requirement: Catalog permissions
Product, variant, image, category, size, and color endpoints SHALL require `catalog:read` for reads and `catalog:manage` for changes. Both `OWNER` and `ADMIN` SHALL hold both permissions. Unauthenticated requests SHALL receive `401`, and requests whose role lacks a permission `403 FORBIDDEN`, under the existing admin session, origin-check, and authorization rules.

#### Scenario: Admin manages catalog
- **WHEN** a signed-in `ADMIN` creates a product
- **THEN** the request succeeds with `201`

#### Scenario: Catalog requires a session
- **WHEN** a request without a staff session calls any catalog endpoint
- **THEN** the API responds `401` and performs no action

### Requirement: Product identity and slug
A product SHALL have a name (1–120 characters), an optional description (at most 5000 characters), a category, and a slug. The slug SHALL be lowercase kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`, at most 80 characters) and unique among all products, including archived ones.
- **Generated slugs:** when no slug is given, one SHALL be generated from the name (accents removed, non-alphanumerics collapsed to `-`). If it is taken, the smallest free suffix `-2`, `-3`, … is appended.
- **Explicit slugs:** a slug given explicitly that is already taken SHALL be rejected.
- **Locking:** the slug MAY be changed only while the product has never been activated. Once a product has been `ACTIVE` at least once, its slug SHALL be immutable.

#### Scenario: Slug generated from name
- **WHEN** a staff member creates a product named "Rent Due Coach Jacket" without a slug
- **THEN** the product's slug is `rent-due-coach-jacket`

#### Scenario: Generated slug avoids collision
- **WHEN** a product with slug `inflation-tee` exists and another product named "Inflation Tee" is created without a slug
- **THEN** the new product's slug is `inflation-tee-2`

#### Scenario: Duplicate product slug
- **WHEN** a staff member creates or updates a product with an explicit slug used by another product, including an archived one
- **THEN** the API responds `409` with code `SLUG_EXISTS` and nothing changes

#### Scenario: Slug locked after activation
- **WHEN** a staff member changes the slug of a product that has been activated before, even if it is now `INACTIVE`
- **THEN** the API responds `409` with code `SLUG_LOCKED` and the slug is unchanged

#### Scenario: Concurrent creation with the same slug
- **WHEN** two requests create products with the same explicit slug at the same time
- **THEN** exactly one succeeds and the other receives `409 SLUG_EXISTS`

### Requirement: Product pricing and currency
A product SHALL have a `basePrice` expressed as `Money` (integer minor units and an ISO 4217 currency). Amounts SHALL be integers from 0 to 2,000,000,000 minor units inclusive. The upper bound is a deliberate business limit for this version: the maximum catalog price per item, Rp 20,000,000 in the store currency IDR. It exists to catch entry errors such as extra zeros, and applies equally to variant price overrides. Raising it is a spec change. Every price SHALL use the store currency configured for the API (`STORE_CURRENCY`). The database SHALL also reject negative amounts.

#### Scenario: Negative price rejected
- **WHEN** a staff member submits `basePrice` `{ amount: -1, currency: "IDR" }`
- **THEN** the API responds `400` with a field error for `basePrice.amount`

#### Scenario: Price above the catalog maximum rejected
- **WHEN** a staff member submits `basePrice.amount` `2000000001`
- **THEN** the API responds `400` with a field error for `basePrice.amount`, while `2000000000` is accepted

#### Scenario: Fractional amount rejected
- **WHEN** a staff member submits `basePrice.amount` `899.5`
- **THEN** the API responds `400` with a field error for `basePrice.amount`

#### Scenario: Foreign currency rejected
- **WHEN** the store currency is `IDR` and a staff member submits a price in `USD`
- **THEN** the API responds `422` with code `CURRENCY_MISMATCH` and nothing changes

### Requirement: Product lifecycle
A product SHALL have one of the statuses `DRAFT`, `ACTIVE`, `INACTIVE`, or `ARCHIVED`. A new product SHALL start as `DRAFT`. Transitions SHALL happen only through dedicated actions:
- **activate:** `DRAFT` or `INACTIVE` → `ACTIVE`
- **deactivate:** `ACTIVE` → `INACTIVE`
- **archive:** `DRAFT` or `INACTIVE` → `ARCHIVED`
- **restore:** `ARCHIVED` → `INACTIVE`

Any other transition SHALL be rejected with `409 INVALID_STATE_TRANSITION`. A product SHALL become `ACTIVE` only when all of these hold:
- its category is `ACTIVE`
- it has at least one `ACTIVE` variant
- at least one `ACTIVE` variant has an effective price greater than zero
- it has at least one image
- exactly one of its images is primary

Otherwise activation SHALL be rejected with `409 PRODUCT_NOT_READY`, and the detail SHALL list every unmet condition. An `ACTIVE` product SHALL keep satisfying these conditions: changes that would break them are rejected (see Variant status, and Product images). Products SHALL NOT be hard-deleted: archived and inactive products SHALL remain retrievable by id, with their variants and images.

#### Scenario: New product is draft
- **WHEN** a staff member creates a product
- **THEN** its status is `DRAFT`

#### Scenario: Activate ready product
- **WHEN** a staff member activates a `DRAFT` product with an `ACTIVE` category, an `ACTIVE` variant priced above zero, and one image that is primary
- **THEN** its status becomes `ACTIVE`, `activatedAt` is set if it was not set already, and `updatedBy` is that staff member

#### Scenario: Activate product without variants
- **WHEN** a staff member activates a product that has no `ACTIVE` variant
- **THEN** the API responds `409` with code `PRODUCT_NOT_READY`, the detail names the missing active variant, and the status is unchanged

#### Scenario: Activate product without an image
- **WHEN** a staff member activates a product that meets every other condition but has no images
- **THEN** the API responds `409` with code `PRODUCT_NOT_READY`, the detail names the missing image, and the status is unchanged

#### Scenario: Activate product without a primary image
- **WHEN** a product's images have no primary image (for example after data was written outside the API) and a staff member activates it
- **THEN** the API responds `409` with code `PRODUCT_NOT_READY`, the detail names the missing primary image, and the status is unchanged

#### Scenario: Activation reports every unmet condition
- **WHEN** a staff member activates a `DRAFT` product with no variants and no images in an `ARCHIVED` category
- **THEN** the `PRODUCT_NOT_READY` detail names the archived category, the missing active priced variant, and the missing image

#### Scenario: Activate product in archived category
- **WHEN** a staff member activates a product whose category is `ARCHIVED`
- **THEN** the API responds `409` with code `PRODUCT_NOT_READY`

#### Scenario: Deactivate and reactivate product
- **WHEN** a staff member deactivates an `ACTIVE` product and later activates it again
- **THEN** its status becomes `INACTIVE` and then `ACTIVE`, and `activatedAt` keeps its first value

#### Scenario: Archive active product rejected
- **WHEN** a staff member archives an `ACTIVE` product
- **THEN** the API responds `409` with code `INVALID_STATE_TRANSITION` (it must be deactivated first)

#### Scenario: Archived product stays addressable
- **WHEN** a staff member fetches an `ARCHIVED` product by id
- **THEN** the API responds `200` with the product, its variants, and its images, and no delete endpoint exists for products

### Requirement: Product listing and detail
Staff with `catalog:read` SHALL be able to list products using the `{ data, nextCursor }` envelope with opaque cursors. `limit` SHALL default to 20 and be at most 100. Results are ordered by creation, newest first. Optional filters SHALL be `status` (default: every status except `ARCHIVED`), `categoryId`, and `q` (case-insensitive name contains). List items SHALL include the base price, status, category, the variant count, and the primary image. The detail response SHALL include the product with its category, variants (each with its effective price and stock), images in display order, and attribution. Responses SHALL NOT include database-only fields.

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

### Requirement: Product updates and attribution
Staff with `catalog:manage` SHALL be able to update a product's name, description, category, base price, and slug (within the slug rules) with a partial update. Every change to a product, its variants, or its images SHALL set that record's `updatedBy` to the acting staff member and advance `updatedAt`. `createdBy` and `createdAt` SHALL never change. An `ARCHIVED` product SHALL reject edits until it is restored.

#### Scenario: Update product attribution
- **WHEN** a second staff member changes a product's name
- **THEN** `updatedBy` becomes that staff member, `updatedAt` advances, and `createdBy` and `createdAt` are unchanged

#### Scenario: Edit archived product rejected
- **WHEN** a staff member updates an `ARCHIVED` product
- **THEN** the API responds `409` with code `INVALID_STATE_TRANSITION` and nothing changes

### Requirement: Product images
Staff with `catalog:manage` SHALL be able to add, update, delete, and reorder image metadata for a product. Each image has:
- a `url`: an `https://` URL or a root-relative path
- `alt` text (1–300 characters)
- an optional `variantId`, which must belong to the same product
- a `sortOrder`
- an `isPrimary` flag

Rules:
- A product SHALL have at most 20 images.
- A product MAY have zero images while it is `DRAFT`, `INACTIVE`, or `ARCHIVED`. An `ACTIVE` product SHALL always have at least one image.
- When a product has one or more images, exactly one SHALL be primary. The first image added SHALL become primary.
- Marking an image primary SHALL unmark the previous primary atomically, in the same transaction, so no reader ever sees zero or two primary images.
- Deleting the primary image SHALL promote the next image by `sortOrder` (the lowest remaining).
- Deleting the last image of an `ACTIVE` product SHALL be rejected with `409 LAST_IMAGE`.
- Reordering SHALL take the complete list of the product's image ids and assign consecutive sort orders from 0.
- Image files are not uploaded or stored by this capability.

#### Scenario: First image becomes primary
- **WHEN** a staff member adds the first image to a product
- **THEN** that image has `isPrimary: true` and `sortOrder: 0`

#### Scenario: Switch primary image
- **WHEN** a staff member marks a second image as primary
- **THEN** it becomes the only primary image of that product

#### Scenario: Delete primary image promotes next
- **WHEN** a staff member deletes the primary image of a product with three images
- **THEN** the remaining image with the lowest `sortOrder` becomes primary

#### Scenario: Draft product without images
- **WHEN** a staff member creates a product and fetches it before adding images
- **THEN** the product is `DRAFT` with an empty image list

#### Scenario: Delete last image of active product rejected
- **WHEN** a staff member deletes the only image of an `ACTIVE` product
- **THEN** the API responds `409` with code `LAST_IMAGE` and the image remains, and the same deletion succeeds once the product is `INACTIVE`

#### Scenario: Reorder images
- **WHEN** a staff member submits the product's image ids in a new order
- **THEN** the images take sort orders 0, 1, 2… in that order, and a list that omits, repeats, or adds ids is rejected with `400`

#### Scenario: Image for another product's variant
- **WHEN** a staff member adds an image with a `variantId` from a different product
- **THEN** the API responds `422` with code `VARIANT_MISMATCH`

#### Scenario: Image limit
- **WHEN** a staff member adds a 21st image to a product
- **THEN** the API responds `409` with code `IMAGE_LIMIT`
