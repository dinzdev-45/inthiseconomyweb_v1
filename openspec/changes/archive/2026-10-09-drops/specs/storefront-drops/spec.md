# Spec Delta

## Purpose

Gives customers the drop pages: what is coming next with a countdown, what is live now with its products, and the archive of earlier drops.

## ADDED Requirements

### Requirement: Drops page
`/drops` SHALL feature the next upcoming drop (collection, title, image, release time, and countdown) or, when none is upcoming, the current live drop ("Now live"). Each SHALL link to the drop's page. When there is an archive, the page SHALL link to `/drops/archive`. With no published drop, the page SHALL say that the first drop is coming and link to the shop. The page SHALL be rendered on the server from the API, at most 60 seconds stale, with a friendly "drops unavailable" state, with a retry link, when the API fails.

#### Scenario: Next drop on the drops page
- **WHEN** a drop releases next week and another went live last week
- **THEN** `/drops` features next week's drop with its release time and countdown, links to its page, and links to the archive

#### Scenario: No drops yet on the drops page
- **WHEN** no drop is published
- **THEN** `/drops` says the first drop is coming and links to the shop

#### Scenario: Drops unavailable
- **WHEN** the API is not reachable and a customer opens `/drops`
- **THEN** the page shows that drops are unavailable with a retry link, the header and footer are present, and no error details are shown

### Requirement: Drop page
`/drops/<slug>` SHALL show the drop's image (or placeholder), collection, title, description, and status:
- **"Upcoming":** with the release time and countdown
- **"Now live"**
- **"Past drop":** with its release date

Its products SHALL be shown as catalog cards, in the drop's order. On an upcoming drop, each card SHALL say "Releases <date>" in text. A draft or unknown drop SHALL show the storefront's "Page not found" page with status 404.

#### Scenario: Upcoming drop page
- **WHEN** a customer opens the page of a drop releasing tomorrow
- **THEN** it shows "Upcoming", the release time, the countdown, and the drop's products as cards, each saying when it releases

#### Scenario: Live drop page
- **WHEN** a customer opens the page of the current drop
- **THEN** it shows "Now live" and the drop's products as cards that link to their product pages

#### Scenario: Unknown drop page
- **WHEN** a customer opens `/drops/<slug>` for a draft or unknown drop
- **THEN** the storefront "Page not found" page is shown with status 404

### Requirement: Drop archive
`/drops/archive` SHALL list earlier drops, most recent first, each with its image or placeholder, collection, title, and release date, and a link to its page. With none, it SHALL say there are no earlier drops yet.

#### Scenario: Drop archive
- **WHEN** two earlier drops exist
- **THEN** `/drops/archive` lists both, most recent first, each linking to its page

### Requirement: Release countdown
An upcoming drop's release SHALL be shown as a date and time in Western Indonesian Time inside a `time` element with a machine-readable `datetime`, readable without JavaScript. With JavaScript, a countdown SHALL show the days, hours, minutes, and seconds left, updated every second. It SHALL be labelled, and SHALL NOT announce every tick to assistive technology. With a reduced-motion preference, digits SHALL change without animation. At zero, the countdown SHALL refresh the page so it shows the live state.

#### Scenario: Countdown to a release
- **WHEN** a customer opens an upcoming drop's page 2 days and 3 hours before its release
- **THEN** the countdown shows 2 days 3 hours and counts down each second, and the release time in WIB is also shown

#### Scenario: Release time without JavaScript
- **WHEN** an upcoming drop's page is opened without JavaScript
- **THEN** the release date and time in WIB are shown in a `time` element

#### Scenario: Countdown reaches zero
- **WHEN** the countdown reaches zero while the page is open
- **THEN** the page refreshes and shows the drop as "Now live"

### Requirement: Drop pages SEO, accessibility, and layout
- **Metadata:** drop pages and `/drops/archive` SHALL have titles and descriptions and canonical URLs, and SHALL be indexable.
- **Accessibility:** they SHALL have no serious or critical automated accessibility violations (WCAG 2.2 A and AA) and SHALL be usable with a keyboard.
- **Layout:** they SHALL lay out without horizontal scrolling or clipped text at 320, 375, 768, 1024, 1440, and 1920 px.

#### Scenario: Drop page metadata
- **WHEN** a drop's page is rendered
- **THEN** its title names the drop, it has a description, its canonical URL is `/drops/<slug>`, and it is indexable

#### Scenario: Drop pages accessibility scan
- **WHEN** `/drops`, an upcoming drop's page, a live drop's page, and `/drops/archive` are scanned with axe
- **THEN** there are zero serious or critical violations

#### Scenario: Drop pages without horizontal overflow
- **WHEN** `/drops` and a drop's page are loaded at 320, 375, 768, 1024, 1440, and 1920 px
- **THEN** no page scrolls horizontally and no text is clipped
