# Spec Delta

## Purpose

Gives staff admin screens to manage products end to end through the existing admin API: finding products, creating and editing them, moving them through their lifecycle, and managing their variants, stock, and image metadata. The API remains the source of truth for every rule.

## ADDED Requirements

### Requirement: Product list
The admin SHALL provide a product list at `/catalog/products`.
- **Columns:** the primary image as a thumbnail (or a placeholder when there is none), name, category, status, base price, variant count, and the stock summary from the API (total stock across active variants, the number of active variants, and how many of them are out of stock).
- **Search and filters:** a name search and filters for status and category. The search and filters SHALL be kept in the page URL, so a filtered view can be reloaded or shared.
- **Archived products:** without a status filter, the list SHALL show what the API returns by default, which excludes archived products. Archived products appear when the `ARCHIVED` status filter is chosen.
- **Pagination:** the list SHALL page with the API's opaque cursor. It offers a "Next page" control while the API returns a cursor, and a way back to the first page.
- **Invalid cursors:** an invalid cursor in the URL SHALL show an explanation and a link to the first page, not an error page.

#### Scenario: Product list columns
- **WHEN** a staff member opens the product list
- **THEN** each row shows the primary image thumbnail or a placeholder, the name linking to the product page, category, status, base price, variant count, and the stock summary

#### Scenario: Search and filter products in the admin
- **WHEN** a staff member searches for "hoodie" and filters by a category and the `DRAFT` status
- **THEN** only matching products are listed, the URL contains the search and filters, and reloading the page shows the same results

#### Scenario: Archived products only through the status filter
- **WHEN** a staff member opens the product list without a status filter, then chooses `ARCHIVED`
- **THEN** archived products are absent at first and listed after choosing the filter

#### Scenario: Paginate the product list in the admin
- **WHEN** more products match than fit on one page and the staff member chooses "Next page", then returns to the first page
- **THEN** the next page shows the following products with no duplicates, the filters are kept, and the first page is shown again

#### Scenario: Invalid list cursor in the URL
- **WHEN** a staff member opens the product list with a tampered `cursor` in the URL
- **THEN** a message explains the link is no longer valid, with a link to the first page, and no error page is shown

### Requirement: Product creation
Staff with `catalog:manage` SHALL be able to create a product from `/catalog/products/new`.
- **Fields:** name, optional slug, optional description, category (chosen from the API's categories), and base price.
- **Currency:** the store currency is shown and cannot be changed.
- **On success:** the admin SHALL open the new product's page, which shows the `DRAFT` status and the slug the API saved.
- **On failure:** API errors such as `SLUG_EXISTS` or a field error on `basePrice.amount` SHALL be shown at the related field, keeping the user's input.

#### Scenario: Create a draft product from the admin
- **WHEN** a staff member creates a product named "Rent Due Coach Jacket" in a category with base price 899000, without a slug
- **THEN** the product page opens showing status `DRAFT`, slug `rent-due-coach-jacket`, and the price Rp 899.000

#### Scenario: Create a product with a taken slug in the admin
- **WHEN** a staff member creates a product with a slug another product already uses
- **THEN** the API's `SLUG_EXISTS` message is shown at the slug field and the entered values remain

### Requirement: Product details editing
The product page SHALL show:
- the product's status as text
- its first activation time, when it has one
- its last update time

Staff with `catalog:manage` SHALL be able to edit the name, slug, description, category, and base price, sending only changed fields.
- **Slug lock:** once the product has been activated at least once, the slug SHALL be shown read-only with a short explanation, matching the API's slug lock.
- **Archived products:** archived products SHALL be shown read-only, offering only the restore action.
- **Other rules:** rules the admin does not mirror, such as `PRODUCT_NOT_READY` for an edit that would make an active product unready, SHALL be shown from the API's response.

#### Scenario: Edit product details from the admin
- **WHEN** a staff member changes a draft product's name and description and saves
- **THEN** the product page shows the new values and an updated "last updated" time

#### Scenario: Slug read-only after activation in the admin
- **WHEN** a staff member opens a product that has been activated before, even if it is now `INACTIVE`
- **THEN** the slug is shown read-only with an explanation that it is locked after activation, and the other details remain editable

#### Scenario: Archived product is read-only in the admin
- **WHEN** a staff member opens an `ARCHIVED` product
- **THEN** its details, variants, stock, and images are shown without edit controls, and a restore action is offered

### Requirement: Product lifecycle actions and readiness
The product page, and each product-list row, SHALL offer the lifecycle actions that apply to the product's current status:
- **activate:** for `DRAFT` or `INACTIVE`
- **deactivate:** for `ACTIVE`
- **archive:** for `DRAFT` or `INACTIVE`
- **restore:** for `ARCHIVED`

Deactivation and archiving SHALL require confirmation. The displayed status SHALL change only after the API confirms the action.
- **Activation refused:** when the API refuses activation with `PRODUCT_NOT_READY`, the admin SHALL show the API's explanation, which names every unmet condition, near the activate action, and the product stays in its status.
- **Other refusals:** any other refused transition SHALL show the API's explanation.

The admin SHALL NOT compute readiness itself.

#### Scenario: Activate a ready product from the admin
- **WHEN** a staff member activates a draft product with an active priced variant and a primary image
- **THEN** after the API confirms, the product page shows status `ACTIVE` and its first activation time

#### Scenario: Activation blocked shows every reason
- **WHEN** a staff member activates a draft product that has no variants and no images
- **THEN** the API's `PRODUCT_NOT_READY` explanation, naming the missing active variant and the missing image, is shown near the activate action, and the status remains `DRAFT`

#### Scenario: Deactivate, archive, and restore a product from the admin
- **WHEN** a staff member deactivates an active product and confirms, then archives it and confirms, then restores it
- **THEN** the status is shown as `INACTIVE`, then `ARCHIVED`, then `INACTIVE`, each after the API confirms

#### Scenario: Lifecycle actions in the product list
- **WHEN** a staff member views a list row for a `DRAFT` product and one for an `ACTIVE` product
- **THEN** the draft row offers activate and archive, the active row offers deactivate, and using a row action updates that row's status after the API confirms

### Requirement: Variant management
The product page SHALL list the product's variants, showing for each:
- size, color, and SKU
- price override, if any, and effective price
- current stock
- status

Staff with `catalog:manage` SHALL be able to:
- add a variant: size and color chosen from the reference data, SKU, an optional price override, and an optional initial stock
- edit a variant's size, color, SKU, and price override, including clearing the override
- activate and deactivate a variant

The variant edit form SHALL NOT offer a stock field.
- **SKU lock:** once the product has been activated before, the SKU SHALL be shown read-only.
- **Refusals:** the API's `VARIANT_EXISTS`, `SKU_EXISTS`, `SKU_LOCKED`, `UNKNOWN_REFERENCE`, `CURRENCY_MISMATCH`, and `LAST_ACTIVE_VARIANT` responses SHALL be shown at the related field or action.

#### Scenario: Add a variant from the admin
- **WHEN** a staff member adds a variant with size `M`, a color, SKU `ite-oh-wb-m`, and initial stock 12
- **THEN** the variant list shows SKU `ITE-OH-WB-M`, status `ACTIVE`, stock 12, and the product's base price as its effective price

#### Scenario: Set and clear a variant price override in the admin
- **WHEN** a staff member sets a variant's price override to 949000 and later clears it
- **THEN** its effective price is shown as Rp 949.000, and after clearing it shows the product's base price again

#### Scenario: Variant conflicts shown in the admin
- **WHEN** a staff member adds a variant whose size and color already exist on the product, or whose SKU another variant uses
- **THEN** the API's `VARIANT_EXISTS` or `SKU_EXISTS` message is shown and no variant is added

#### Scenario: SKU read-only after activation in the admin
- **WHEN** a staff member edits a variant of a product that has been activated before
- **THEN** the SKU is shown read-only, and size, color, and price override remain editable

#### Scenario: Deactivating the last active variant shows the reason
- **WHEN** a staff member deactivates the only active variant of an `ACTIVE` product
- **THEN** the API's `LAST_ACTIVE_VARIANT` explanation is shown and the variant remains `ACTIVE`

### Requirement: Stock adjustments
For each variant, the product page SHALL show the current stock. Staff with `catalog:manage` SHALL be able to apply a stock adjustment by entering a non-zero whole number: positive to add stock, negative to remove it. The admin SHALL NOT offer any way to set stock to an absolute value after a variant is created.
- **On success:** the displayed stock SHALL be the quantity returned by the API.
- **Insufficient stock:** an `INSUFFICIENT_STOCK` response SHALL show the API's explanation and leave the displayed stock unchanged.
- **Invalid input:** a zero, fractional, or non-numeric delta SHALL be rejected in the form.

#### Scenario: Adjust stock by a delta in the admin
- **WHEN** a staff member adjusts a variant with stock 12 by `+5` and then by `-3`
- **THEN** the displayed stock becomes 17 and then 14, the quantities returned by the API

#### Scenario: Insufficient stock shown in the admin
- **WHEN** a staff member adjusts a variant with stock 2 by `-3`
- **THEN** the API's `INSUFFICIENT_STOCK` explanation is shown and the displayed stock stays 2

#### Scenario: No absolute stock editing
- **WHEN** a staff member edits an existing variant
- **THEN** the form has no stock field, and stock can change only through an adjustment

### Requirement: Image metadata management
The product page SHALL list the product's images in display order, each with:
- a preview
- its URL or path
- its alt text
- its linked variant, if any

The primary image SHALL be identified by a visible "Primary" label, not only by styling. Staff with `catalog:manage` SHALL be able to:
- add an image by URL or root-relative path, with alt text and an optional variant chosen from this product's variants
- edit an image's URL, alt text, or variant
- make another image primary
- move an image up or down in the order, saving the full order
- delete an image, after confirmation

No file upload SHALL be offered.
- **Refusals:** the API's `IMAGE_LIMIT`, `LAST_IMAGE`, and field errors SHALL be shown.
- **After a change:** the list SHALL reflect the order and primary image returned by the API.

#### Scenario: Add image metadata from the admin
- **WHEN** a staff member adds the first image to a product with a root-relative path and alt text
- **THEN** it appears in the image list labelled "Primary", and a second image added afterwards is not labelled primary

#### Scenario: Make another image primary from the admin
- **WHEN** a staff member makes the second image primary
- **THEN** only that image is labelled "Primary"

#### Scenario: Reorder images from the admin
- **WHEN** a staff member moves the last image up to the first position
- **THEN** the image list shows the new order, and the order is unchanged after reloading the page

#### Scenario: Delete an image from the admin
- **WHEN** a staff member deletes the primary image of a product with two images and confirms
- **THEN** it disappears from the list and the remaining image is labelled "Primary"

#### Scenario: Deleting the last image of an active product shows the reason
- **WHEN** a staff member deletes the only image of an `ACTIVE` product and confirms
- **THEN** the API's `LAST_IMAGE` explanation is shown and the image remains

#### Scenario: Invalid image metadata shown in the admin
- **WHEN** a staff member adds an image with the URL `http://example.com/a.jpg` or with empty alt text
- **THEN** a field error is shown at the URL or alt text field and no image is added

### Requirement: Catalog end-to-end workflow
The admin SHALL support the complete path from empty reference data to an active product without using the API directly. The path covers:
- creating a category, a size, and a color
- creating a product
- adding a variant with stock
- adding a primary image
- activating the product

#### Scenario: Catalog workflow from setup to an active product
- **WHEN** a signed-in staff member creates a category, size, and color, then a product with one variant (initial stock 5) and one image, and activates it, all through the admin
- **THEN** the product list shows the product as `ACTIVE` with its category, base price, one variant, a stock summary of 5, and its primary image thumbnail
