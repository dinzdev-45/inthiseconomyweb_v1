# Spec Delta

## Purpose

Lets staff manage the reference data every product depends on: categories, sizes, and colors. It keeps these consistent and protects them from changes that would break products using them.

## ADDED Requirements

### Requirement: Categories
Staff with `catalog:manage` SHALL be able to create categories with a name and a slug, rename them, change their slug, and archive or restore them. Category slugs SHALL be lowercase kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`, at most 80 characters) and unique among all categories, including archived ones. When no slug is given, one SHALL be generated from the name. Categories SHALL be listable by staff with `catalog:read`, optionally filtered by status. Categories SHALL NOT be hard-deleted.

#### Scenario: Create category
- **WHEN** a staff member creates a category named "Outerwear" without a slug
- **THEN** the API responds `201` with an `ACTIVE` category whose slug is `outerwear`, with `createdBy` and `updatedBy` set to that staff member

#### Scenario: Duplicate category slug
- **WHEN** a staff member creates or renames a category with a slug already used by another category, including an archived one
- **THEN** the API responds `409` with code `SLUG_EXISTS` and nothing changes

#### Scenario: Archive category in use
- **WHEN** a staff member archives a category that has at least one `ACTIVE` product
- **THEN** the API responds `409` with code `IN_USE` and the category stays `ACTIVE`

#### Scenario: Archive and restore unused category
- **WHEN** a staff member archives a category with no `ACTIVE` products and later restores it
- **THEN** its status becomes `ARCHIVED` and then `ACTIVE`, and it remains retrievable by id throughout

### Requirement: Sizes
Staff with `catalog:manage` SHALL be able to create, update, and delete sizes. Sizes SHALL be master data, not a fixed list: any garment or numeric sizing (for example `S`, `M`, `L`, `XL`, `XXL`, `OS` for one size, or waist sizes `28`, `30`, `32`) is a size row created by staff. A size has:
- a `code`, normalized by trimming and uppercasing, then matching `^[A-Z0-9]+([-/.][A-Z0-9]+)*$` (letters and digits, optionally joined by single `-`, `/`, or `.`, such as `30/32` or `EU-42`), at most 12 characters, and unique among all sizes
- a human-readable `label` (1–40 characters, e.g. "Medium" or "Waist 30")
- an explicit integer `sortOrder` that sets display order, independent of the code's alphabetical or numeric value

A size SHALL NOT be deleted while any variant references it. Garment measurements are not part of sizes in this capability.

#### Scenario: Sizes listed in display order
- **WHEN** staff list sizes
- **THEN** sizes are returned ordered by `sortOrder`, then by `code`

#### Scenario: Numeric and letter size codes
- **WHEN** a staff member creates sizes `28` ("Waist 28", sortOrder 10), `30/32` ("Waist 30 / Leg 32", sortOrder 20), and `xl` ("Extra Large", sortOrder 5)
- **THEN** all are accepted, `xl` is stored as `XL`, and the list returns `XL`, `28`, `30/32` in `sortOrder` order

#### Scenario: Invalid size code
- **WHEN** a staff member submits size code `M L`, `--`, or a code longer than 12 characters
- **THEN** the API responds `400` with a field error for `code`

#### Scenario: Duplicate size code
- **WHEN** a staff member creates a size with code `m` while `M` exists
- **THEN** the code is normalized to uppercase and the API responds `409` with code `CODE_EXISTS`

#### Scenario: Delete size in use
- **WHEN** a staff member deletes a size that a variant uses
- **THEN** the API responds `409` with code `IN_USE` and the size remains

### Requirement: Colors
Staff with `catalog:manage` SHALL be able to create, update, and delete colors. A color has a display `name`, a unique kebab-case `slug` (generated from the name when not given), and an optional `hex` value (`#RRGGBB`, stored uppercase) for swatches. A color SHALL NOT be deleted while any variant references it.

#### Scenario: Create color with hex
- **WHEN** a staff member creates a color named "Washed Black" with hex `#2b2a28`
- **THEN** the API responds `201` with slug `washed-black` and hex `#2B2A28`

#### Scenario: Invalid hex
- **WHEN** a staff member submits hex `#12345` or `red`
- **THEN** the API responds `400` with a field error for `hex`

#### Scenario: Delete unused color
- **WHEN** a staff member deletes a color no variant uses
- **THEN** the API responds `204` and the color no longer appears in the list
