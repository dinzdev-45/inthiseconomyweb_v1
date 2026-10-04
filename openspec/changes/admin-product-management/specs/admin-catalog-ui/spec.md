# Spec Delta

## Purpose

Defines the behaviour shared by every admin catalog screen: where the catalog appears in the admin, who can see and change it, how API errors and progress are shown, how prices are displayed and entered, and the accessibility bar these screens meet.

## ADDED Requirements

### Requirement: Catalog navigation and page access
The admin SHALL show the catalog navigation entries **Products**, **Categories**, **Sizes**, and **Colors** to staff holding `catalog:read`, and hide them from staff without it. A staff member without `catalog:read` who opens a catalog page directly SHALL see the existing "not permitted" page, and no catalog data SHALL be requested for them.

#### Scenario: Catalog navigation entries
- **WHEN** a staff member with `catalog:read` signs in to the admin
- **THEN** the main navigation contains Products, Categories, Sizes, and Colors, each linking to its catalog page

#### Scenario: Catalog page without catalog read permission
- **WHEN** a staff member whose permissions lack `catalog:read` opens `/catalog/products` directly
- **THEN** the "not permitted" page is shown and no catalog request is made on their behalf

### Requirement: Permission-aware catalog controls
Controls that change catalog data SHALL be shown only to staff holding `catalog:manage`. These include create, edit, delete, archive, restore, activate, deactivate, stock adjustment, and image changes. Staff with only `catalog:read` SHALL see the same data without those controls. The API SHALL remain the authority: when it refuses an action with `403`, the admin SHALL show that the action is not permitted and SHALL NOT show the change as applied.

#### Scenario: Read-only catalog view
- **WHEN** a staff member has `catalog:read` but not `catalog:manage`
- **THEN** catalog pages show their data and no control that would change it

#### Scenario: API refusal is authoritative
- **WHEN** a staff member submits a catalog change and the API responds `403 FORBIDDEN`
- **THEN** the admin shows a "not permitted" message, and the data on screen is unchanged

### Requirement: API error rendering
Catalog screens SHALL render problem+json errors from the API as follows:
- **Validation errors (`400` with field errors):** each message appears next to its field, and a summary appears at the top of the form.
- **Business-rule errors (`409` or `422` with a code):** the API's `detail` text appears in an alert, and the user's input is kept.
- **Unexpected errors (`5xx` or a non-problem response):** a generic message appears with the response's request id as a reference, and nothing internal (stack traces, SQL) is shown.
- **Expired session (`401`):** the user is sent to the sign-in page.
- **Temporary password (`403 PASSWORD_CHANGE_REQUIRED`):** the user is sent to the change-password page.

Alerts SHALL be announced to assistive technology, and focus SHALL move to the error summary after a failed submission.

#### Scenario: Field errors from the API
- **WHEN** a catalog form is submitted and the API responds `400` with field errors
- **THEN** each error appears next to its field, a summary appears at the top of the form, and focus moves to the summary

#### Scenario: Business rule error keeps input
- **WHEN** a catalog form is submitted and the API responds `409` with a catalog error code
- **THEN** the API's detail text is shown in an alert and the values the user entered remain in the form

#### Scenario: Unexpected server error
- **WHEN** a catalog action fails with a `500` problem response
- **THEN** a generic error message is shown with the request id as a reference, and no internal details are displayed

#### Scenario: Session expired during a catalog action
- **WHEN** a catalog action is submitted after the staff session has ended
- **THEN** the admin navigates to the sign-in page

### Requirement: Progress, empty, and success states
- **In progress:** while a catalog action runs, the control that started it SHALL be disabled and marked busy, so the action cannot be submitted twice. Lifecycle changes and stock adjustments SHALL NOT be shown as done before the API confirms them.
- **Success:** after a successful change, the screen SHALL show the data as returned by the API, and announce a short success message to assistive technology.
- **Empty:** a list with no items SHALL show an empty-state message. For staff with `catalog:manage`, it SHALL also offer a way to create the first item.

#### Scenario: Action in progress
- **WHEN** a catalog action has been submitted and the API has not responded yet
- **THEN** the control that started it is disabled and marked busy, and the displayed status or stock has not changed

#### Scenario: Success message after a change
- **WHEN** a catalog change succeeds
- **THEN** the screen shows the updated data from the API and a success message is announced in a polite live region

#### Scenario: Empty catalog list
- **WHEN** a staff member with `catalog:manage` opens a catalog list that has no items, or no items matching its filters
- **THEN** an empty-state message is shown, with a link to create an item when the list itself is empty

### Requirement: Confirmation for disruptive actions
Archiving a product or category, deactivating a product, and deleting a size, color, or image SHALL require an explicit confirmation step before the request is sent. Cancelling SHALL send nothing. Confirmation SHALL be inline next to the action rather than a blocking modal, and SHALL be operable by keyboard.

#### Scenario: Confirm before a disruptive action
- **WHEN** a staff member chooses to archive a product
- **THEN** the admin asks for confirmation first, and the product is archived only after they confirm

#### Scenario: Cancel a disruptive action
- **WHEN** a staff member starts deleting an image and then cancels the confirmation
- **THEN** no request is sent and the image remains

### Requirement: Money display and entry
Prices SHALL be displayed with the currency symbol and grouping for their currency. The store currency SHALL be read from the API's catalog settings, not configured separately in the admin. Price inputs SHALL:
- accept amounts in major units (for example `899000` for Rp 899,000)
- show the store currency next to the field
- send integer minor units in the store currency

An amount with more decimal places than the currency allows, or one that is not a number, SHALL be rejected in the form before any request is sent. Range limits SHALL be left to the API.

#### Scenario: Prices shown in the store currency
- **WHEN** a staff member views products whose base price is `{ amount: 89900000, currency: "IDR" }`
- **THEN** the price is displayed as Rp 899.000, and price inputs are labelled with IDR, the currency from the catalog settings

#### Scenario: Price entry in major units
- **WHEN** a staff member enters `899000` as a base price in an IDR store
- **THEN** the API receives `{ amount: 89900000, currency: "IDR" }`, and an entry of `12.345` or `abc` is rejected in the form without a request

### Requirement: Catalog accessibility
Catalog pages SHALL:
- have no serious or critical automated accessibility violations (WCAG 2.2 A and AA rules)
- label every form control
- convey status and primary-image state in text, not by colour alone
- be fully operable by keyboard with a visible focus indicator, including image reordering (which SHALL NOT require drag and drop)

#### Scenario: Catalog pages pass an automated accessibility scan
- **WHEN** the product list, a product page, and each reference-data page are scanned with axe
- **THEN** there are zero serious or critical violations

#### Scenario: Catalog keyboard operation
- **WHEN** a staff member uses only the keyboard on a product page
- **THEN** they can reach and operate every control, including moving an image up or down in the order, with a visible focus indicator
