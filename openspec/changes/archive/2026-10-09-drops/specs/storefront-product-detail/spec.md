# Spec Delta

## MODIFIED Requirements

### Requirement: Price and availability
The page SHALL show:
- **With a size selected:** the selected variant's price and its availability ("In stock" or "Sold out").
- **Without a size selected:** the selected color's price, or "From" its lowest price when its variants' prices differ.
- **A sold-out product:** "Sold out" near the price when every variant is sold out.
- **An unreleased product:** "Releases <date and time in WIB>" near the price, with a link to its drop, instead of the availability.

Prices SHALL be formatted in their currency. Availability SHALL be stated in text, never by color alone, and stock quantities SHALL NOT be shown.

#### Scenario: Price of the selected variant
- **WHEN** a product's `M` costs Rp 799.000 and its `L` costs Rp 829.000, and a customer selects `L`
- **THEN** the page shows Rp 829.000 and "In stock"

#### Scenario: Price before choosing a size
- **WHEN** no size is selected and the selected color's variants cost Rp 799.000 and Rp 829.000
- **THEN** the page shows "From Rp 799.000"

#### Scenario: Sold-out product
- **WHEN** every variant of a product is sold out
- **THEN** the page says "Sold out" near the price, and every size option says "Sold out"

#### Scenario: Unreleased product page
- **WHEN** a customer opens the page of a product whose published drop releases tomorrow
- **THEN** the page shows its price and "Releases" with tomorrow's date and time in WIB, links to the drop, and shows no "In stock" or "Sold out"
