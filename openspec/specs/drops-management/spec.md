# drops-management Specification

## Purpose

Lets staff plan and release drops (a named collection of products with a release time) through the admin API, so products can be grouped, announced ahead, and held back until they release.

## Requirements

### Requirement: Drops
Staff with `catalog:manage` SHALL be able to create and update drops under `/api/v1/admin/drops`. Staff with `catalog:read` SHALL be able to list drops (newest release first) and read one. A drop has:
- `slug`: unique among drops, generated from the title when omitted, using the catalog slug rules
- `collection`: a label, 1–60 characters
- `title`: 1–120 characters
- `description`: optional, at most 2000 characters
- `releaseAt`: an ISO 8601 UTC timestamp
- `image`: `url` (an image URL by the catalog rules) and `alt` (1–300 characters), or null
- `status`: `DRAFT` when created
- `products`: an ordered list of products

Every change SHALL set the drop's `updatedBy` and `updatedAt`. Bodies SHALL be strict.

#### Scenario: Create a drop
- **WHEN** a staff member with `catalog:manage` creates a drop with collection "COLLECTION 002", title "Overtime", and a release time
- **THEN** the API responds `201` with a `DRAFT` drop with slug `overtime`, no products, and the staff member as creator

#### Scenario: Drop slug conflict
- **WHEN** a staff member creates or renames a drop to a slug another drop uses
- **THEN** the API responds `409` with code `SLUG_EXISTS`

#### Scenario: Drops need catalog permissions
- **WHEN** a staff member without `catalog:manage` creates or edits a drop, or one without `catalog:read` lists drops
- **THEN** the API responds `403` with code `FORBIDDEN` and nothing changes

### Requirement: Drop products
`PUT /api/v1/admin/drops/{id}/products` SHALL replace a drop's products with an ordered list of up to 100 product ids. A product SHALL belong to at most one drop. A product already in another drop SHALL be refused with `409 PRODUCT_IN_OTHER_DROP`, naming no other drop's data beyond its id. Unknown products SHALL be refused with `422 UNKNOWN_REFERENCE`. Products of any status MAY be added. The order given SHALL be the order shown to customers.

`GET /api/v1/admin/drops/{id}/candidates?q=` SHALL list up to 20 products whose name contains `q` (ignoring case), each with its id, name, status, primary image, and the drop it already belongs to (`id` and `title`) or null, so staff can see which products are free to add.

#### Scenario: Find products for a drop
- **WHEN** a staff member searches candidates for "tee" while one matching product is in another drop
- **THEN** the matching products are listed, and that one shows the other drop's title

#### Scenario: Set a drop's products
- **WHEN** a staff member sets a drop's products to three products in a given order
- **THEN** the drop lists exactly those three in that order, and setting it again to two of them removes the third

#### Scenario: Product in another drop
- **WHEN** a staff member adds to one drop a product that already belongs to another drop
- **THEN** the API responds `409` with code `PRODUCT_IN_OTHER_DROP` and neither drop changes

### Requirement: Drop publishing
`POST /api/v1/admin/drops/{id}/publish` SHALL make a `DRAFT` drop `PUBLISHED` when it has a title, a release time, an image, and at least one product. Otherwise it SHALL respond `409 DROP_NOT_READY`, listing what is missing. `POST /api/v1/admin/drops/{id}/unpublish` SHALL make a `PUBLISHED` drop `DRAFT`. A `DRAFT` drop MAY be deleted, and its products leave it. A `PUBLISHED` drop SHALL NOT be deleted (`409 INVALID_STATE_TRANSITION`). Drops can be edited in either status.

#### Scenario: Publish a ready drop
- **WHEN** a staff member publishes a draft drop with a title, release time, image, and two products
- **THEN** the drop is `PUBLISHED`

#### Scenario: Drop not ready to publish
- **WHEN** a staff member publishes a draft drop without an image and without products
- **THEN** the API responds `409` with code `DROP_NOT_READY` naming the image and products as missing, and the drop stays `DRAFT`

#### Scenario: Unpublish and delete
- **WHEN** a staff member unpublishes a published drop and then deletes it
- **THEN** the drop is `DRAFT` and then gone, its products are in no drop, and deleting a published drop instead responds `409 INVALID_STATE_TRANSITION`

### Requirement: Release gating
A product SHALL be **unreleased** while it belongs to a drop, in any status, whose `releaseAt` is after the current time. Unreleased products SHALL NOT be sold (see `store-catalog-api` and `store-cart-api`). They become sellable at `releaseAt` without any staff action, subject to the usual product and variant rules.

#### Scenario: Release at the release time
- **WHEN** an active product belongs to a published drop releasing at 10:00, and the time passes 10:00
- **THEN** before 10:00 the product cannot be added to a cart, and from 10:00 it can, with no change made by staff
