# store-drops-api Specification

## Purpose

Gives the storefront a public, read-only view of published drops: what is coming, what is live, and what came before, with each drop's products, so drop pages and the homepage need no admin data or drop rules of their own.

## Requirements

### Requirement: Drops overview
`GET /api/v1/store/drops` SHALL return only `PUBLISHED` drops, as:
- `upcoming`: drops whose release is still ahead, soonest first
- `current`: the most recently released drop, or null
- `archive`: every other released drop, most recent first

Each drop SHALL be summarized by `slug`, `collection`, `title`, `releaseAt`, `status` (`UPCOMING`, `LIVE` for the current drop, `PAST` for the archive), `image`, and the number of its products that customers can see. Draft drops SHALL never appear. Responses SHALL carry `Cache-Control: public, max-age=60`, need no credentials, and accept only `GET` and `HEAD`.

#### Scenario: Drops overview
- **WHEN** published drops released last month, released last week, and releasing next week exist, and a draft drop releases tomorrow
- **THEN** `upcoming` holds next week's drop, `current` last week's (`LIVE`), `archive` last month's (`PAST`), and the draft appears nowhere

#### Scenario: No drops yet
- **WHEN** no drop is published
- **THEN** the overview has empty `upcoming` and `archive` lists and a null `current`

### Requirement: Drop detail
`GET /api/v1/store/drops/{slug}` SHALL return a published drop's summary plus its `description` and `products`, as store product summaries in the drop's order. Products that are not `ACTIVE` SHALL be left out. For an upcoming drop, each product SHALL carry its `releaseAt`. A draft or unknown drop SHALL get `404 NOT_FOUND`, the same in every case.

#### Scenario: Upcoming drop detail
- **WHEN** a customer requests a published drop releasing tomorrow with three active products and one draft product
- **THEN** the response has the drop's description and the three active products in the drop's order, each with tomorrow's release time

#### Scenario: Draft drop is not found
- **WHEN** a customer requests a draft drop's slug, or an unknown slug
- **THEN** the API responds `404` with code `NOT_FOUND` and the same detail
