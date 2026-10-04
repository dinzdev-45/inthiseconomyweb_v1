# admin-authentication Specification

## Purpose

Lets InThisEconomy staff sign in to the admin with email and password and governs the lifecycle of their server-side sessions. Customers never authenticate; this capability applies to staff only.

## Requirements

### Requirement: Email and password login
Staff SHALL sign in with email and password. A failed login SHALL NOT reveal whether the email exists, whether the account is deactivated, or whether the password was wrong.

#### Scenario: Successful login
- **WHEN** an active staff member submits a correct email and password
- **THEN** the system establishes a server-side session, sets the session cookie, and returns the staff member's profile, role, and permissions

#### Scenario: Wrong password
- **WHEN** a staff member submits an incorrect password
- **THEN** the system responds `401` with a generic "invalid credentials" error and no session is created

#### Scenario: Unknown email
- **WHEN** someone submits an email that belongs to no staff member
- **THEN** the system responds exactly as for a wrong password, with comparable response time

#### Scenario: Deactivated account
- **WHEN** a deactivated staff member submits correct credentials
- **THEN** the system responds exactly as for a wrong password and no session is created

### Requirement: Login rate limiting
The login endpoint SHALL limit attempts to 10 per 15 minutes per combination of client IP and submitted email, and 50 per 15 minutes per client IP overall. Requests over the limit SHALL be rejected without checking credentials.

#### Scenario: Too many attempts
- **WHEN** a client makes an 11th login attempt for the same email from the same IP within 15 minutes
- **THEN** the API responds `429` with a `Retry-After` header and code `RATE_LIMITED`, even if the credentials are correct

#### Scenario: Limit window passes
- **WHEN** the 15-minute window has elapsed
- **THEN** the client can attempt to log in again

### Requirement: Password storage and policy
Staff passwords SHALL be at least 12 characters and SHALL be stored only as a salted, memory-hard hash. Plaintext passwords SHALL never be logged or returned by any endpoint.

#### Scenario: Weak password rejected
- **WHEN** a password shorter than 12 characters is set for a staff account
- **THEN** the system responds `400` with a field error and the password is not stored

#### Scenario: Hash only
- **WHEN** a staff account's stored credentials are inspected in the database
- **THEN** only a password hash is present, never the plaintext

### Requirement: Secure server-side sessions
Staff sessions SHALL be stored server-side and referenced by a random, unguessable token in a cookie that is httpOnly, Secure (outside local development), and SameSite=Strict. Only a hash of the token SHALL be stored. Sessions SHALL expire after 30 minutes of inactivity or 12 hours after creation, whichever comes first. A session SHALL stop working as soon as its staff account is deactivated.

#### Scenario: Cookie attributes
- **WHEN** a session is established
- **THEN** the session cookie is httpOnly, SameSite=Strict, and Secure in non-development environments

#### Scenario: Idle timeout
- **WHEN** a staff member makes no request for 30 minutes
- **THEN** their next admin request responds `401` and they must sign in again

#### Scenario: Absolute timeout
- **WHEN** a session reaches 12 hours since creation, even if continuously active
- **THEN** it is invalid and the staff member must sign in again

#### Scenario: Deactivated during session
- **WHEN** an Owner deactivates a staff account that has an active session
- **THEN** that staff member's next admin request responds `401`

### Requirement: Cross-site request protection
State-changing admin requests (`POST`, `PUT`, `PATCH`, `DELETE`) SHALL be rejected unless their `Origin` header matches the configured admin origin.

#### Scenario: Cross-site mutation
- **WHEN** an authenticated admin mutation arrives with a missing or foreign `Origin` header
- **THEN** the API responds `403` and performs no action

### Requirement: Logout
Staff SHALL be able to log out, which immediately invalidates the current session server-side and clears the cookie.

#### Scenario: Logout
- **WHEN** a staff member logs out
- **THEN** reusing the old session cookie responds `401`

### Requirement: Change own password
Staff SHALL be able to change their own password by supplying the current password. Staff whose account was created with a temporary password SHALL be required to change it before using any other admin function.

#### Scenario: Change password
- **WHEN** a staff member submits the correct current password and a valid new password
- **THEN** the new password takes effect for subsequent logins

#### Scenario: Wrong current password
- **WHEN** a password change request has an incorrect current password
- **THEN** the system responds `401` and the password is not changed

#### Scenario: Temporary password must be changed
- **WHEN** a staff member signs in with a temporary password and calls any admin endpoint other than change-password, logout, or get-profile
- **THEN** the API responds `403` with code `PASSWORD_CHANGE_REQUIRED`

### Requirement: Initial owner bootstrap
The system SHALL provide an operator-run command (not an HTTP endpoint) to create the first `OWNER` account when no staff accounts exist. The command SHALL refuse to run when any staff account already exists.

#### Scenario: Bootstrap on empty system
- **WHEN** an operator runs the bootstrap command with an email and password on a system with zero staff accounts
- **THEN** an active `OWNER` account is created with that email and password

#### Scenario: Bootstrap after setup
- **WHEN** an operator runs the bootstrap command while staff accounts exist
- **THEN** the command exits with an error and creates nothing
