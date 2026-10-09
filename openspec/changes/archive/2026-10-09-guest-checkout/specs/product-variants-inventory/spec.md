# Spec Delta

## MODIFIED Requirements

### Requirement: Non-negative stock
A variant's `stockQuantity` SHALL never be negative, enforced both by the API and by a database constraint. After creation, stock SHALL change only through:
- staff stock adjustments
- placed orders, which decrement it by the ordered quantities
- expired orders, which return those quantities

An adjustment carries a non-zero integer `delta` (−100,000 to 100,000) and is applied atomically. An adjustment that would make stock negative SHALL be rejected without any change. Concurrent changes of any kind SHALL never lose updates. The response SHALL return the resulting quantity. Adjustments SHALL update the variant's `updatedBy` and `updatedAt`. Order changes SHALL NOT change the variant's attribution.

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

#### Scenario: Orders and adjustments together
- **WHEN** a variant has stock 5, an order for 3 is placed while a staff member adjusts the stock by `-2`, and the order later expires
- **THEN** stock never goes below 0, no change is lost, and the final stock is 3, with the variant's attribution set only by the adjustment
