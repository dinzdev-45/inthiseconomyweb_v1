# Spec Delta

## Purpose

Gives staff admin pages to manage the catalog's reference data (categories, sizes, and colors) through the existing admin API, so products can be built from them without calling the API by hand.

## ADDED Requirements

### Requirement: Categories page
The admin SHALL provide a categories page that lists categories with their name, slug, and status. It SHALL offer a status filter (all, `ACTIVE`, or `ARCHIVED`). Staff with `catalog:manage` SHALL be able to:
- create a category with a name and an optional slug; the page shows the slug the API generated when none is given
- edit a category's name and slug
- archive an active category, and restore an archived one

There SHALL be no delete control for categories. When the API refuses an archive because active products use the category, its explanation SHALL be shown and the category stays active.

#### Scenario: List categories with a status filter
- **WHEN** a staff member opens the categories page and chooses the `ARCHIVED` filter
- **THEN** only archived categories are listed, and choosing "All" lists both active and archived ones

#### Scenario: Create a category from the admin
- **WHEN** a staff member creates a category named "Outerwear" without a slug
- **THEN** it appears in the list as active with the slug `outerwear`

#### Scenario: Edit a category from the admin
- **WHEN** a staff member renames a category and changes its slug to one that is free
- **THEN** the list shows the new name and slug, and a slug already used by another category shows the API's `SLUG_EXISTS` message at the slug field

#### Scenario: Archive and restore a category from the admin
- **WHEN** a staff member archives a category with no active products, confirms, and later restores it
- **THEN** it is shown as archived and then active again

#### Scenario: Archiving a category in use shows the reason
- **WHEN** a staff member archives a category that has an active product
- **THEN** the API's `IN_USE` explanation is shown and the category remains active

### Requirement: Sizes page
The admin SHALL provide a sizes page listing sizes in display order (`sortOrder`, then code), with code, label, and sort order. Staff with `catalog:manage` SHALL be able to:
- create a size with a code, label, and sort order; the code is shown as normalized by the API
- edit a size
- delete a size, after confirmation

When the API refuses a delete because variants use the size, or refuses a duplicate code, its explanation SHALL be shown.

#### Scenario: Sizes listed in display order in the admin
- **WHEN** sizes `XL` (sort order 5), `28` (10), and `30/32` (20) exist
- **THEN** the sizes page lists them as `XL`, `28`, `30/32`

#### Scenario: Create and edit a size from the admin
- **WHEN** a staff member creates size code `xs` with label "Extra Small" and sort order 1, then changes its label
- **THEN** the list shows code `XS` with the new label, and creating another `xs` shows the API's `CODE_EXISTS` message

#### Scenario: Delete a size from the admin
- **WHEN** a staff member deletes an unused size and confirms, and then tries to delete a size a variant uses
- **THEN** the unused size disappears from the list, and for the used size the API's `IN_USE` explanation is shown and it remains

### Requirement: Colors page
The admin SHALL provide a colors page listing colors with name, slug, and hex value. A swatch SHALL appear next to colors that have a hex value, and the hex SHALL also be shown as text. Staff with `catalog:manage` SHALL be able to:
- create a color with a name, an optional slug, and an optional `#RRGGBB` hex value
- edit a color, including clearing its hex value
- delete a color, after confirmation

When the API refuses a delete because variants use the color, or rejects a hex value, its explanation SHALL be shown.

#### Scenario: Colors shown with swatches
- **WHEN** colors "Washed Black" (`#2B2A28`) and "Undyed" (no hex) exist
- **THEN** "Washed Black" shows a swatch and the text `#2B2A28`, and "Undyed" shows no swatch and no hex value

#### Scenario: Create and edit a color from the admin
- **WHEN** a staff member creates a color named "Dirty Brown" with hex `#b1641e`, then clears its hex value
- **THEN** it is first listed with slug `dirty-brown` and hex `#B1641E`, then without a hex value, and an invalid hex such as `#12345` shows a field error at the hex field

#### Scenario: Delete a color from the admin
- **WHEN** a staff member deletes an unused color and confirms, and then tries to delete a color a variant uses
- **THEN** the unused color disappears from the list, and for the used color the API's `IN_USE` explanation is shown and it remains
