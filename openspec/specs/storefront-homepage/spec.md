# storefront-homepage Specification

## Purpose

Defines the InThisEconomy storefront homepage: an editorial, photography-led introduction to the brand, its current drop, and its products. It renders from placeholder content until the catalog, drop, and lookbook capabilities supply real data.

## Requirements

### Requirement: Homepage structure
The homepage at `/` SHALL render, inside the `main` landmark and in this order: Hero, Drop feature, Featured Products, Campaign banner, Shop The Look preview, New Arrivals, Lookbook preview, Brand Manifesto, and Newsletter. Each section SHALL be a `section` element labelled by its own heading. The page SHALL have exactly one `h1` (the hero headline), and every other section heading SHALL be an `h2`.

#### Scenario: Homepage section order
- **WHEN** a customer opens `/`
- **THEN** the main content contains, in order, sections labelled by the hero headline, the drop feature, Featured Products, the campaign banner, Shop The Look, New Arrivals, Lookbook, the manifesto, and the newsletter

#### Scenario: Heading structure
- **WHEN** the homepage's headings are listed
- **THEN** there is exactly one `h1`, reading "IN THIS ECONOMY", and each other section is labelled by an `h2`

### Requirement: Hero
The hero SHALL fill at least the visible viewport height below the header on every screen size. It SHALL show the headline "IN THIS ECONOMY", the campaign lines "COLLECTION 001" and "COST OF LIVING", the supporting line "Clothing for the world we're living in.", and a "SHOP THE DROP" link to `/drops`, over a campaign visual. The visual SHALL be replaceable by a campaign photograph or video without changing the section's structure. Hero text SHALL meet WCAG AA contrast against the visual.

#### Scenario: Hero content
- **WHEN** the homepage loads
- **THEN** the hero shows "IN THIS ECONOMY", "COLLECTION 001", "COST OF LIVING", "Clothing for the world we're living in.", and a "SHOP THE DROP" link to `/drops`

#### Scenario: Hero fills the first screen
- **WHEN** the homepage loads at 375 × 812 and at 1440 × 900
- **THEN** the hero's height is at least the viewport height minus the header height

### Requirement: Drop feature
The drop feature SHALL present one drop in one of two states:
- **Live:** shows a "Now live" label, the collection name and title, and an "EXPLORE THE COLLECTION" link to the drop's page (`/drops/<slug>`).
- **Upcoming:** shows an "Upcoming" label, the collection name and title, the release date, and a reserved, labelled area where a countdown will later appear, with no live timer in this change.

When there is no drop to feature, the section SHALL be omitted entirely.

#### Scenario: Live drop
- **WHEN** the featured drop's status is live
- **THEN** the section shows "Now live", the drop's collection name and title, and an "EXPLORE THE COLLECTION" link to `/drops/<slug>`

#### Scenario: Upcoming drop
- **WHEN** the featured drop's status is upcoming with a release date
- **THEN** the section shows "Upcoming", the release date in a human-readable form inside a `time` element with a machine-readable `datetime`, and the reserved countdown area, and no explore link

#### Scenario: No drop to feature
- **WHEN** there is no drop in the homepage content
- **THEN** the drop section is not rendered and the remaining sections keep their order

### Requirement: Product cards
Products on the homepage SHALL be shown as product cards with a primary image, name, color, and price. Each whole card SHALL link to `/products/<slug>`, and its accessible name SHALL include the product name. Prices SHALL come from the shared `Money` shape (integer minor units plus an ISO 4217 currency) and be formatted with the currency's symbol and minor-unit rules. When a product provides a second image, a device with a fine pointer and no reduced-motion preference SHALL show it on hover or focus. Cards SHALL NOT contain wishlist, quick-add, or account controls.

#### Scenario: Product card content
- **WHEN** a product card is rendered for a product with name, color, price, and slug
- **THEN** it shows the image, name, color, and formatted price, and the whole card is one link to `/products/<slug>` whose accessible name includes the product name

#### Scenario: Price formatting
- **WHEN** a product's price is `{ amount: 129900000, currency: "IDR" }` or `{ amount: 8900, currency: "USD" }`
- **THEN** the card shows the amount formatted for that currency (IDR with no decimal places, USD with two), never the raw minor-unit integer

#### Scenario: Hover image on desktop
- **WHEN** a customer using a mouse hovers over, or focuses, a card whose product has a second image
- **THEN** the second image is shown in place of the first, and on touch devices or with reduced motion the primary image stays

#### Scenario: No shopping controls on cards
- **WHEN** a product card is rendered
- **THEN** it contains no wishlist, quick-add, or add-to-cart control, and exactly one link

### Requirement: Featured Products and New Arrivals
Featured Products SHALL show four product cards in a grid: two columns below 1024 px wide and four at 1024 px or wider. It SHALL have a "SHOP ALL" link to `/shop`. New Arrivals SHALL show its products in a horizontally scrollable row with scroll snapping below 1024 px, and as a grid at 1024 px or wider. Horizontal scrolling SHALL stay inside the section and never widen the page.

#### Scenario: Featured products grid
- **WHEN** the homepage is viewed at 375 px and at 1440 px wide
- **THEN** Featured Products shows four product cards in two columns at 375 px and four columns at 1440 px, plus a "SHOP ALL" link to `/shop`

#### Scenario: New arrivals layout
- **WHEN** the homepage is viewed at 375 px wide
- **THEN** New Arrivals scrolls horizontally within its own section and the document does not scroll horizontally

### Requirement: Editorial sections
- **Campaign banner:** a full-width visual with a campaign title and short copy.
- **Shop The Look preview:** a campaign image beside a list of two or three items from that look, each linking to its product, and a "SHOP THE LOOK" link to `/lookbook`. Each look item MAY carry a position on the image for future interactive hotspots. In this change, positions SHALL NOT render interactive controls on the image.
- **Lookbook preview:** a photography-led layout of at least two images and a "VIEW LOOKBOOK" link to `/lookbook`.
- **Brand Manifesto:** the headline "OUR ECONOMY.", the copy "Clothing for the world we're living in.", and a link to `/story`.

#### Scenario: Campaign banner
- **WHEN** the homepage loads
- **THEN** a full-width campaign section shows its title and copy over or beside a campaign visual spanning the viewport width

#### Scenario: Shop the look preview
- **WHEN** the homepage loads
- **THEN** the Shop The Look section shows a look image, between two and three item links to `/products/<slug>`, and a "SHOP THE LOOK" link to `/lookbook`, and the image contains no interactive hotspot controls

#### Scenario: Lookbook preview
- **WHEN** the homepage loads
- **THEN** the Lookbook section shows at least two images and a "VIEW LOOKBOOK" link to `/lookbook`

#### Scenario: Brand manifesto
- **WHEN** the homepage loads
- **THEN** the manifesto shows "OUR ECONOMY.", "Clothing for the world we're living in.", and a link to `/story`

### Requirement: Frontend-only newsletter form
The newsletter section and the footer SHALL each offer an email field with a visible label and a submit button. Submission SHALL be validated in the browser: an empty or malformed email shows an inline error linked to the field and keeps focus on it. A valid email SHALL show a confirmation that newsletter sign-up is not open yet and that the email was not saved. In this change the form SHALL NOT send the email to any server or store it in the browser.

#### Scenario: Invalid newsletter email
- **WHEN** a customer submits the newsletter form with "not-an-email"
- **THEN** an inline error message is shown, associated with the email field, and focus stays on the field

#### Scenario: Newsletter submission stays local
- **WHEN** a customer submits the newsletter form with a valid email
- **THEN** a message says sign-up is not open yet and the email was not saved, no network request is made, and nothing is written to cookies or browser storage

### Requirement: Placeholder content and data seam
All homepage content SHALL come from one typed placeholder content module, read through a single asynchronous homepage-content function. That function is the only thing a later change replaces to supply real products, drops, and lookbook data. Rendering the homepage SHALL NOT call the API. Media without a real image SHALL render as a decorative placeholder at the same aspect ratio, never as a broken image.

#### Scenario: Homepage does not depend on the API
- **WHEN** the homepage is requested while the API is not running
- **THEN** it renders with status 200 and all sections, and the storefront makes no request to the API

#### Scenario: Placeholder media
- **WHEN** a product, look, or campaign item has no image
- **THEN** a decorative placeholder (hidden from assistive technology) is shown in the same aspect ratio, and the item's text still identifies it

### Requirement: Responsive layout
The homepage and storefront navigation SHALL lay out without horizontal page scrolling and without overlapping or clipped text at viewport widths of 320, 375, 768, 1024, 1440, and 1920 px.

#### Scenario: No horizontal overflow
- **WHEN** the homepage is loaded at each of 320, 375, 768, 1024, 1440, and 1920 px wide
- **THEN** the document's scroll width equals the viewport width

### Requirement: Accessibility
The homepage SHALL use semantic landmarks (`header`, `nav`, `main`, `footer`). Every interactive element SHALL be reachable and operable by keyboard and SHALL show a clearly visible focus indicator. Text SHALL meet WCAG 2.2 AA contrast. Informative images SHALL have text alternatives, and decorative ones SHALL be hidden from assistive technology. An automated scan SHALL report no serious or critical violations.

#### Scenario: Automated accessibility scan
- **WHEN** an automated WCAG 2.2 A/AA scan runs on the homepage at mobile and desktop widths, including with the mobile menu open
- **THEN** it reports no serious or critical violations

#### Scenario: Visible focus
- **WHEN** a keyboard user tabs through every interactive element on the homepage
- **THEN** each focused element shows a visible focus outline distinct from its unfocused state

### Requirement: Brand palette
The storefront SHALL use the InThisEconomy brand palette:
- Brand Brown `#B1641E`
- Dark Brown `#7C4318`
- Warm Cream `#F2EBDD`
- Near Black `#171615`
- Warm Grey `#756F67`
- Sand `#CCB99F`
- Soft Brown `#D9B48C`
- Warm White `#FAF8F3`

Brand Brown SHALL be the primary accent, used for the wordmark, the primary call-to-action, and the manifesto background. Most surfaces SHALL be warm white, warm cream, or near black. Text in Brand Brown SHALL only be large text (at least 24 px, or 18.66 px bold), because it does not reach 4.5:1 against the palette's surfaces. The storefront SHALL NOT use colours outside the palette (other than tints of Near Black), and SHALL NOT use gradients.

#### Scenario: Brand accent usage
- **WHEN** the homepage loads
- **THEN** the header wordmark and the hero's primary call-to-action use Brand Brown, the manifesto section has a Brand Brown background, the drop section and footer have a Near Black background, and the page background is Warm White

#### Scenario: Brand Brown only on large text
- **WHEN** every text element on the homepage is inspected, at mobile and desktop widths
- **THEN** each element whose text color or background is Brand Brown is either the wordmark or large text (at least 24 px, or at least 18.66 px at weight 700 or more), and no element uses a colour outside the palette or a gradient

### Requirement: Motion
Motion SHALL be limited to short, subtle transitions such as image crossfades, link underlines, and the mobile menu opening. Nothing SHALL autoplay, loop, or animate on scroll. When the user prefers reduced motion, transitions and animations SHALL be disabled.

#### Scenario: Reduced motion
- **WHEN** the homepage is viewed with `prefers-reduced-motion: reduce`
- **THEN** no element has a running CSS animation or a non-zero transition duration, and opening the mobile menu happens without animation

### Requirement: Performance
The homepage SHALL be statically rendered at build time. Media SHALL reserve its aspect ratio before loading so layout does not shift. Real images SHALL be served through Next.js image optimization, with only the hero image loaded eagerly and the rest lazily. Fonts SHALL be loaded through `next/font` (in this change, Archivo via `next/font/google`) with `display: swap`, so a fallback is shown while they load.

#### Scenario: Static homepage
- **WHEN** the storefront is built for production
- **THEN** the build output marks `/` as statically prerendered

#### Scenario: Reserved media space
- **WHEN** the homepage renders, before any image has loaded
- **THEN** every media frame already has its final aspect ratio, so the measured cumulative layout shift during load is below 0.1
