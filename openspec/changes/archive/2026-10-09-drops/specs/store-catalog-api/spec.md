# Spec Delta

## MODIFIED Requirements

### Requirement: Active products only
Store catalog endpoints SHALL include only products whose status is `ACTIVE`. Draft, inactive, and archived products SHALL NOT appear in lists, filter options, or by slug. Only `ACTIVE` variants SHALL count toward prices, availability, sizes, and colors. A product that is not `ACTIVE` SHALL be indistinguishable from one that does not exist.

Unreleased products (in a drop whose release time is still ahead; see `drops-management`) SHALL NOT appear in lists, search, filter options, or category counts. By slug, an unreleased product of a `PUBLISHED` drop SHALL be returned with its release time, and one of a `DRAFT` drop SHALL be not found.

#### Scenario: Only active products are listed
- **WHEN** draft, active, inactive, and archived products exist and a customer lists the catalog
- **THEN** only the active products are returned, and the totals count only them

#### Scenario: Non-active product is not found
- **WHEN** a customer requests `/api/v1/store/products/{slug}` for a draft, inactive, or archived product, or an unknown slug
- **THEN** the API responds `404` with code `NOT_FOUND` and the same detail in every case

#### Scenario: Active product by slug
- **WHEN** a customer requests an active product by its slug
- **THEN** the API responds `200` with that product's detail

#### Scenario: Unreleased products stay out of the shop
- **WHEN** an active product belongs to a published drop releasing tomorrow, and another to a draft drop releasing tomorrow
- **THEN** neither appears in the catalog list, search, or filter options; by slug the first is returned with tomorrow's release time and the second responds `404 NOT_FOUND`, and after the release time both are listed

### Requirement: Product detail
`GET /products/{slug}` SHALL return a product detail. It contains every summary field (`slug`, `name`, `category`, `price`, `availability`, `colors`, `image`, `secondaryImage`) and adds:
- `description`: the product's description, or null
- `images`: every image to show, in display order, each with `url`, `alt`, and `color` (the slug of the color it shows, or null when it shows no particular color)
- `variants`: the product's `ACTIVE` variants, ordered by size display order and then color name, each with:
  - `size`: `code` and `label`
  - `color`: `slug`, `name`, and `hex`
  - `price`: its effective price as `Money`, in the store currency
  - `availability`: `IN_STOCK` when its stock is above zero, otherwise `SOLD_OUT`
- `releaseAt`: the release time while the product is unreleased, otherwise null
- `drop`: the `slug` and `title` of the published drop the product belongs to, or null

An image linked to a variant SHALL be tagged with that variant's color. Images whose color no `ACTIVE` variant uses SHALL be left out. Like the summary, the detail SHALL NOT include stock quantities, SKUs, internal ids, staff attribution, timestamps, inactive variants, or any other admin-only field.

#### Scenario: Product detail fields
- **WHEN** a customer requests an active product by its slug
- **THEN** the response matches the published store product detail schema exactly, with its description, images, and variants, and no stock quantity, SKU, id, attribution, or timestamp field anywhere

#### Scenario: Variants in the detail
- **WHEN** an active product has active variants `M`/black (stock 3, Rp 899.000), `L`/black (stock 0, Rp 949.000), and `M`/white (stock 2), and an inactive variant `S`/black
- **THEN** the detail lists the three active variants in size order (`M` black, `M` white, `L` black), with `L`/black `SOLD_OUT` at Rp 949.000, the others `IN_STOCK`, and no `S` variant

#### Scenario: Gallery images tagged by color
- **WHEN** an active product has an image linked to its black variant, an image linked to no variant, and an image linked only to an inactive variant whose color no active variant uses
- **THEN** the detail's images are the first tagged `black` and the second tagged null, in display order, and the third is not included

#### Scenario: Release time in the detail
- **WHEN** a customer requests a product of a published drop releasing tomorrow, and a product in no drop
- **THEN** the first detail has `releaseAt` set to tomorrow's release time and its drop's slug and title, and the second has `releaseAt: null` and `drop: null`
