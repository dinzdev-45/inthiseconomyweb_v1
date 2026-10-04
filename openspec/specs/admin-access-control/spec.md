# admin-access-control Specification

## Purpose

Controls what each InThisEconomy staff member may do in the admin through roles and server-enforced permissions, lets Owners manage staff accounts, and records who created and last changed admin-managed records.

## Requirements

### Requirement: Staff roles
The system SHALL support two staff roles:
- **OWNER**: all permissions, including staff account management.
- **ADMIN**: all permissions except staff account management.

Each staff account SHALL have exactly one role. Authorization decisions SHALL be made on named permissions derived from the role, not on role names directly, so roles can be added later without changing endpoint code.

#### Scenario: Role permissions are resolvable
- **WHEN** an authenticated staff member requests their own profile
- **THEN** the response includes their role and the list of permissions it grants, so the admin UI can hide unavailable actions

### Requirement: Server-side permission enforcement
Every admin endpoint SHALL declare the permission it requires (or explicitly declare that any authenticated staff member may call it), and the API SHALL enforce it on every request regardless of what the admin UI shows.

#### Scenario: Insufficient role
- **WHEN** a staff member with the `ADMIN` role calls a staff-management endpoint
- **THEN** the API responds `403` with code `FORBIDDEN` and performs no action

#### Scenario: Sufficient role
- **WHEN** an `OWNER` calls the same endpoint
- **THEN** the request proceeds

#### Scenario: Undeclared permission
- **WHEN** an admin endpoint is registered without a permission declaration
- **THEN** the API refuses to start

### Requirement: Staff account management
Owners SHALL be able to list staff accounts, create a staff account with an email, role, and temporary password, change a staff account's role, and deactivate or reactivate a staff account. Email addresses SHALL be unique across staff accounts, compared case-insensitively. The system SHALL always retain at least one active `OWNER`.

#### Scenario: Create staff account
- **WHEN** an Owner creates an account for `new@example.com` with role `ADMIN` and a valid temporary password
- **THEN** an active account is created that must change its password at first sign-in

#### Scenario: Duplicate email
- **WHEN** an Owner creates an account with an email already used by another staff account (in any letter case)
- **THEN** the API responds `409` with code `STAFF_EMAIL_EXISTS`

#### Scenario: Change role
- **WHEN** an Owner changes an `ADMIN` to `OWNER`
- **THEN** the new permissions take effect on that staff member's next request

#### Scenario: Deactivate staff
- **WHEN** an Owner deactivates a staff account
- **THEN** that account can no longer sign in and any existing session stops working

#### Scenario: Last owner protected
- **WHEN** an Owner attempts to deactivate or demote the only remaining active `OWNER` (including themselves)
- **THEN** the API responds `409` with code `LAST_OWNER` and nothing changes

### Requirement: Change attribution
Records managed through the admin SHALL store `created_at`, `updated_at`, `created_by`, and `updated_by`. `created_by` and `updated_by` SHALL reference the acting staff account, or be empty when the change was made by a system process or the bootstrap command. Admin API responses for such records SHALL include these fields.

#### Scenario: Attribution on create
- **WHEN** an Owner creates a staff account
- **THEN** the new record's `created_by` and `updated_by` are that Owner and `created_at` equals `updated_at`

#### Scenario: Attribution on update
- **WHEN** a different Owner later changes that account's role
- **THEN** `updated_by` becomes the second Owner, `updated_at` advances, and `created_by` and `created_at` are unchanged

#### Scenario: Bootstrap attribution
- **WHEN** the first Owner is created by the bootstrap command
- **THEN** its `created_by` and `updated_by` are empty

### Requirement: Admin UI respects permissions
The admin app SHALL hide navigation entries and actions the current staff member lacks permission for, and SHALL show a "not permitted" page if a staff member navigates directly to such a page.

#### Scenario: Direct navigation without permission
- **WHEN** an `ADMIN` opens the staff management URL directly
- **THEN** the admin shows a "not permitted" page and makes no successful staff-data request
