# Spec Delta

## MODIFIED Requirements

### Requirement: Catalog navigation and page access
The admin SHALL show the catalog navigation entries **Products**, **Drops**, **Categories**, **Sizes**, and **Colors** to staff holding `catalog:read`, and hide them from staff without it. A staff member without `catalog:read` who opens a catalog page directly SHALL see the existing "not permitted" page, and no catalog data SHALL be requested for them.

#### Scenario: Catalog navigation entries
- **WHEN** a staff member with `catalog:read` signs in to the admin
- **THEN** the main navigation contains Products, Drops, Categories, Sizes, and Colors, each linking to its catalog page

#### Scenario: Catalog page without catalog read permission
- **WHEN** a staff member whose permissions lack `catalog:read` opens `/catalog/products` directly
- **THEN** the "not permitted" page is shown and no catalog request is made on their behalf
