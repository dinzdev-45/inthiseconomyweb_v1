# Spec Delta

## Purpose

Defines the purchasable variants of a product (size × color, each with its own SKU, optional price, and stock) and guarantees stock can never become negative, even under concurrent updates. This is the foundation for future inventory, cart, and checkout.

## ADDED Requirements

### Requirement: Variants
Staff with `catalog:manage` SHALL be able to add variants to a product that is not `ARCHIVED`. Each variant has:
- a size and a color, both required (one-size items use a size such as `OS`)
- a SKU
- an optional `priceOverride` (`Money`, same rules as product prices)
- an initial `stockQuantity` (integer, 0 or more, default 0)
- a status `ACTIVE` or `INACTIVE` (new variants are `ACTIVE`)

Rules:
- Each size and color combination SHALL be unique within a product.
- A variant's `effectivePrice` SHALL be its `priceOverride` when set, otherwise the product's `basePrice`.
- Variants SHALL NOT be hard-deleted. They are deactivated instead, and remain addressable.

#### Scenario: Add variant
- **WHEN** a staff member adds size `M`, color `washed-black`, SKU `ITE-OH-WB-M`, and stock 12 to a product
- **THEN** the API responds `201` with an `ACTIVE` variant whose `effectivePrice` equals the product's base price and `stockQuantity` is 12

#### Scenario: Duplicate size and color
- **WHEN** a staff member adds a variant whose size and color already exist on the same product (active or inactive)
- **THEN** the API responds `409` with code `VARIANT_EXISTS`

#### Scenario: Same size and color on different products
- **WHEN** two different products each get a variant with size `M` and color `black`
- **THEN** both succeed

#### Scenario: Price override
- **WHEN** a variant has `priceOverride` of 949,000 rupiah and the product's base price is 899,000 rupiah
- **THEN** the variant's `effectivePrice` is 949,000 rupiah, and clearing the override makes it 899,000 rupiah again

#### Scenario: Unknown size or color
- **WHEN** a staff member adds a variant with a size or color id that does not exist
- **THEN** the API responds `422` with code `UNKNOWN_REFERENCE`

### Requirement: SKUs
A SKU SHALL be normalized to uppercase and match `^[A-Z0-9][A-Z0-9-]{1,63}$`. SKUs SHALL be unique across all variants of all products, regardless of status. A variant's SKU MAY be changed while its product has never been activated, and SHALL be immutable afterwards.

#### Scenario: Duplicate SKU
- **WHEN** a staff member creates a variant with SKU `ite-oh-wb-m` while `ITE-OH-WB-M` exists on any product
- **THEN** the API responds `409` with code `SKU_EXISTS`

#### Scenario: Invalid SKU
- **WHEN** a staff member submits SKU `ite oh/wb`
- **THEN** the API responds `400` with a field error for `sku`

#### Scenario: SKU locked after activation
- **WHEN** a staff member changes the SKU of a variant whose product has been activated before
- **THEN** the API responds `409` with code `SKU_LOCKED`

### Requirement: Variant status
Staff SHALL be able to deactivate and activate variants. An `ACTIVE` product SHALL always keep at least one `ACTIVE` variant with a positive effective price. Deactivating that last qualifying variant, or making its price zero, SHALL be rejected. This check and product activation SHALL be serialized, so concurrent requests cannot leave an `ACTIVE` product without an active variant.

#### Scenario: Deactivate last active variant rejected
- **WHEN** a staff member deactivates the only `ACTIVE` variant of an `ACTIVE` product
- **THEN** the API responds `409` with code `LAST_ACTIVE_VARIANT` and the variant stays `ACTIVE`

#### Scenario: Deactivate variant of inactive product
- **WHEN** a staff member deactivates the only variant of an `INACTIVE` or `DRAFT` product
- **THEN** the variant becomes `INACTIVE`

#### Scenario: Concurrent activation and last-variant deactivation
- **WHEN** one request activates a `DRAFT` product while another deactivates its only `ACTIVE` variant, at the same time
- **THEN** the outcome is never an `ACTIVE` product with no `ACTIVE` variant

### Requirement: Non-negative stock
A variant's `stockQuantity` SHALL never be negative, enforced both by the API and by a database constraint. After creation, stock SHALL change only through stock adjustments. An adjustment carries a non-zero integer `delta` (−100,000 to 100,000) and is applied atomically. An adjustment that would make stock negative SHALL be rejected without any change. Concurrent adjustments SHALL never lose updates. The response SHALL return the resulting quantity. Adjustments SHALL update the variant's `updatedBy` and `updatedAt`.

#### Scenario: Adjust stock
- **WHEN** a variant has stock 12 and a staff member adjusts it by `-3`, then by `+5`
- **THEN** the responses report 9 and then 14

#### Scenario: Stock cannot go negative
- **WHEN** a variant has stock 2 and a staff member adjusts it by `-3`
- **THEN** the API responds `409` with code `INSUFFICIENT_STOCK` and the stock stays 2

#### Scenario: Negative initial stock rejected
- **WHEN** a staff member creates a variant with `stockQuantity: -1`
- **THEN** the API responds `400` with a field error for `stockQuantity`

#### Scenario: Concurrent stock adjustments
- **WHEN** a variant has stock 10 and 15 adjustments of `-1` arrive at the same time
- **THEN** exactly 10 succeed, 5 receive `409 INSUFFICIENT_STOCK`, and the final stock is 0

#### Scenario: Database rejects negative stock
- **WHEN** any code path attempts to write a negative `stock_quantity` directly to the database
- **THEN** the database rejects the write with a check-constraint violation
