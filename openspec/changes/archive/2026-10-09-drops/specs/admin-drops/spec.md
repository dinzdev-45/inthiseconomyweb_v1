# Spec Delta

## Purpose

Gives staff admin screens to plan and release drops through the drops API: list them, create and edit them, choose and order their products, and publish or unpublish them.

## ADDED Requirements

### Requirement: Drops list
The admin SHALL provide `/catalog/drops`, listing drops (newest release first) with collection, title, status, release time in WIB, product count, and a link to each drop. Staff with `catalog:manage` SHALL see a "New drop" action.

#### Scenario: Drops list
- **WHEN** a staff member with `catalog:read` opens `/catalog/drops`
- **THEN** each drop shows its collection, title, status, release time, and product count, and staff with `catalog:manage` also see "New drop"

### Requirement: Drop form
The admin SHALL provide forms to create and edit a drop's collection, title, slug, description, release date and time (entered in WIB), and image URL and alt text. API field errors SHALL be shown next to their fields, and entered values SHALL be kept.

#### Scenario: Create a drop in the admin
- **WHEN** a staff member fills in the collection, title, and a release time in WIB and saves
- **THEN** the drop is created as a draft with that release time, and its edit page opens

#### Scenario: Drop form errors
- **WHEN** a staff member saves a drop with a slug another drop uses
- **THEN** the form shows the slug conflict next to the slug field and keeps the values entered

### Requirement: Drop product picker
A drop's edit page SHALL let staff with `catalog:manage` search products by name, add them to the drop, remove them, and move them up or down, then save the order. A product in another drop SHALL be shown as unavailable for adding, with the other drop's name.

#### Scenario: Choose a drop's products
- **WHEN** a staff member adds three products, moves the last one to the top, removes one, and saves
- **THEN** the drop's products are the remaining two in the new order

#### Scenario: Product already in another drop
- **WHEN** a staff member searches for a product that belongs to another drop
- **THEN** it is shown as unavailable for adding, naming the other drop

### Requirement: Drop actions
A drop's edit page SHALL offer "Publish" for a draft, and "Unpublish" for a published drop, with confirmation. Delete SHALL be offered only for a draft, with confirmation. When publishing is refused, the page SHALL list what is missing.

#### Scenario: Publish from the admin
- **WHEN** a staff member publishes a ready draft and confirms
- **THEN** the drop shows as published

#### Scenario: Publish refused in the admin
- **WHEN** a staff member publishes a draft with no image
- **THEN** the page says publishing needs an image, and the drop stays a draft
