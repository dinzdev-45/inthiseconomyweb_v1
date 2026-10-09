# Spec Delta

## MODIFIED Requirements

### Requirement: Drop feature
The drop feature SHALL present one drop in one of two states:
- **Live:** shows a "Now live" label, the collection name and title, and an "EXPLORE THE COLLECTION" link to the drop's page (`/drops/<slug>`).
- **Upcoming:** shows an "Upcoming" label, the collection name and title, the release date, and the release countdown (see `storefront-drops`) in the reserved, labelled countdown area.

The featured drop SHALL be the next upcoming published drop, or else the current live drop. When there is no drop to feature, or the drop data could not be loaded, the section SHALL be omitted entirely.

#### Scenario: Live drop
- **WHEN** the featured drop's status is live
- **THEN** the section shows "Now live", the drop's collection name and title, and an "EXPLORE THE COLLECTION" link to `/drops/<slug>`

#### Scenario: Upcoming drop
- **WHEN** the featured drop's status is upcoming with a release date
- **THEN** the section shows "Upcoming", the release date in a human-readable form inside a `time` element with a machine-readable `datetime`, and the countdown in the reserved countdown area, and no explore link

#### Scenario: No drop to feature
- **WHEN** no drop is published, or the drop data could not be loaded
- **THEN** the drop section is not rendered and the remaining sections keep their order

### Requirement: Placeholder content and data seam
All homepage content SHALL come from one typed content module, read through a single asynchronous homepage-content function. That function is the only thing a later change replaces to supply real products and lookbook data. The featured drop SHALL come from the store drops API when the homepage is rendered or revalidated (see "Performance"), never per visit. Serving the homepage to a visitor SHALL NOT call the API, and the homepage SHALL still render, without the drop section, when the API is unavailable. Media without a real image SHALL render as a decorative placeholder at the same aspect ratio, never as a broken image.

#### Scenario: Homepage does not depend on the API
- **WHEN** the homepage is built and requested while the API is not running
- **THEN** it renders with status 200 and every section except the drop section, and the browser makes no request to the API

#### Scenario: Placeholder media
- **WHEN** a product, look, or campaign item has no image
- **THEN** a decorative placeholder (hidden from assistive technology) is shown in the same aspect ratio, and the item's text still identifies it

### Requirement: Performance
The homepage SHALL be statically prerendered and revalidated at most every 5 minutes, so drop changes appear without a deploy and no visit waits on the API. Media SHALL reserve its aspect ratio before loading so layout does not shift. Real images SHALL be served through Next.js image optimization, with only the hero image loaded eagerly and the rest lazily. Fonts SHALL be loaded through `next/font` (in this change, Archivo via `next/font/google`) with `display: swap`, so a fallback is shown while they load.

#### Scenario: Static homepage
- **WHEN** the storefront is built for production
- **THEN** the build output marks `/` as statically prerendered, revalidated at most every 300 seconds

#### Scenario: Reserved media space
- **WHEN** the homepage renders, before any image has loaded
- **THEN** every media frame already has its final aspect ratio, so the measured cumulative layout shift during load is below 0.1
