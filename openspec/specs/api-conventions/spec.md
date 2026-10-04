# api-conventions Specification

## Purpose

Defines the platform-wide REST API contract that every InThisEconomy endpoint follows, so that storefront, admin, and webhook consumers get consistent routing, errors, validation, configuration, and security behavior.

## Requirements

### Requirement: Versioned API zones
The API SHALL serve all business endpoints under the `/api/v1` prefix, divided into three zones with distinct trust levels: `/api/v1/store/*` (public storefront, no authentication), `/api/v1/admin/*` (staff only, authenticated), and `/api/v1/webhooks/*` (reserved for third-party callbacks authenticated by signature in later changes). The store zone SHALL NOT expose any customer account, login, registration, or wishlist endpoint.

#### Scenario: Unknown route
- **WHEN** a client requests a path under `/api/v1` that does not match any endpoint
- **THEN** the API responds `404` with an error body following the error format requirement

#### Scenario: Admin zone without session
- **WHEN** a client calls any `/api/v1/admin/*` endpoint other than the login endpoint without a valid staff session
- **THEN** the API responds `401` and performs no action

#### Scenario: Store zone is public
- **WHEN** a client calls a `/api/v1/store/*` endpoint without any credentials
- **THEN** the API processes the request without requiring authentication

### Requirement: Uniform error format
Every error response SHALL be produced centrally and use the `application/problem+json` media type with the fields `type`, `title`, `status`, `detail`, and `requestId`, and MAY include `errors` (field-level validation issues) and `code` (a stable machine-readable error code). Error responses SHALL NOT include stack traces, SQL, or internal details.

#### Scenario: Unhandled server error
- **WHEN** an endpoint fails with an unexpected internal error
- **THEN** the API responds `500` with a problem body whose `detail` is generic, and the full error is recorded in server logs under the same `requestId`

#### Scenario: Domain error
- **WHEN** an endpoint rejects a request for a business reason (for example a conflicting state)
- **THEN** the API responds with the appropriate 4xx status and a problem body containing a stable `code`

### Requirement: Request validation
The API SHALL validate path parameters, query parameters, and request bodies against shared schemas before any business logic runs, and SHALL reject unknown body properties.

#### Scenario: Invalid body
- **WHEN** a request body is missing a required field or contains a field of the wrong type
- **THEN** the API responds `400` with a problem body whose `errors` array lists each offending field path and message, and no state is changed

#### Scenario: Unknown property
- **WHEN** a request body contains a property not defined by the endpoint's schema
- **THEN** the API responds `400` identifying the unknown property

### Requirement: Validated environment configuration
Each application SHALL read its configuration from environment variables and validate it at startup. An application with missing or invalid required configuration SHALL refuse to start and SHALL report which variables are wrong without printing secret values.

#### Scenario: Missing required variable
- **WHEN** the API starts without its database connection string or session secret
- **THEN** it exits with a non-zero status and an error naming the missing variable

#### Scenario: Secret not echoed
- **WHEN** a secret variable is present but invalid (for example too short)
- **THEN** the startup error names the variable and the rule it failed, but not its value

### Requirement: Request correlation
Every API response SHALL carry an `X-Request-Id` header. If the client supplies a well-formed `X-Request-Id`, the API SHALL reuse it; otherwise it SHALL generate one. All log entries produced while handling the request SHALL include that ID.

#### Scenario: Generated request id
- **WHEN** a request arrives without `X-Request-Id`
- **THEN** the response includes a newly generated `X-Request-Id` that also appears in any error body's `requestId`

### Requirement: Health and readiness
The API SHALL expose `GET /health` (process is alive, no dependency checks) and `GET /ready` (database reachable). Neither endpoint SHALL reveal version numbers, configuration, or dependency hostnames.

#### Scenario: Database unavailable
- **WHEN** the database cannot be reached
- **THEN** `/health` responds `200` and `/ready` responds `503`

### Requirement: Security headers and CORS
All API and web responses SHALL include `Strict-Transport-Security` (in production), `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`. Admin app pages SHALL forbid being framed by other sites. The API SHALL allow credentialed cross-origin requests to the admin zone only from the configured admin origin.

#### Scenario: Foreign origin calls admin zone
- **WHEN** a browser on an origin other than the configured admin origin sends a credentialed request to `/api/v1/admin/*`
- **THEN** the response carries no CORS allowance for that origin and the browser blocks it

#### Scenario: Admin page framed
- **WHEN** another site attempts to load an admin page in an iframe
- **THEN** the browser refuses due to the frame-ancestors policy

### Requirement: Money and identifier representation
All monetary amounts in API payloads SHALL be integers in the currency's minor unit accompanied by an ISO 4217 currency code. Resource identifiers exposed in the API SHALL be non-sequential. Timestamps SHALL be ISO 8601 strings in UTC.

#### Scenario: Money in a response
- **WHEN** any endpoint returns a monetary value
- **THEN** it is represented as `{ "amount": <integer>, "currency": "<ISO 4217>" }`

#### Scenario: Non-sequential identifiers
- **WHEN** two resources of the same type are created one after another
- **THEN** their exposed identifiers are not consecutive integers
