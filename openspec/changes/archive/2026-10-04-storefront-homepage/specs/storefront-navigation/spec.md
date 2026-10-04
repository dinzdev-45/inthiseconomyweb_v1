# Spec Delta

## Purpose

Provides the storefront's site-wide header, mobile menu, and footer: how customers move between InThisEconomy pages, on every screen size and with any input method, without any customer-account entry points.

## ADDED Requirements

### Requirement: Storefront header
Every storefront page SHALL show a header containing the InThisEconomy wordmark (linking to `/`) and, in this order, links to Shop (`/shop`), New Drop (`/drops`), Lookbook (`/lookbook`), Story (`/story`), Search (`/search`), and Cart (`/cart`). The header SHALL remain at the top of the viewport while the page scrolls, and SHALL NOT cover content that receives keyboard focus.

#### Scenario: Header links
- **WHEN** a customer opens any storefront page on a desktop-width screen (≥ 1024 px)
- **THEN** the header shows the wordmark linking to `/` and the Shop, New Drop, Lookbook, Story, Search, and Cart links with those destinations

#### Scenario: Header stays available
- **WHEN** a customer scrolls down the homepage
- **THEN** the header remains visible at the top of the viewport, and an element focused by keyboard below it is scrolled into view without being hidden under the header

### Requirement: No customer account entry points
The storefront header, mobile menu, and footer SHALL NOT contain any account, sign-in, register, or wishlist link, button, or icon. Cart SHALL be a plain link with no item count until cart functionality exists.

#### Scenario: No account or wishlist controls
- **WHEN** the header, mobile menu, and footer are inspected on any screen size
- **THEN** none contains an element whose accessible name or destination refers to account, login, sign in, register, or wishlist

### Requirement: Accessible mobile menu
Below 768 px wide, the primary links (Shop, New Drop, Lookbook, Story) SHALL collapse behind a menu button whose accessible name is "Menu" and which reports its expanded state. The wordmark, Search, and Cart SHALL stay directly visible. The open menu SHALL be modal: it lists all primary links plus Search and Cart, moves focus into the menu, keeps keyboard focus inside it, makes the page behind it inert, closes on Escape or on its close button, and returns focus to the menu button when closed. Selecting a link SHALL close the menu.

#### Scenario: Open mobile menu
- **WHEN** a customer on a 375 px wide screen activates the "Menu" button
- **THEN** a menu opens listing Shop, New Drop, Lookbook, Story, Search, and Cart, the button reports expanded, and keyboard focus is inside the menu

#### Scenario: Close mobile menu with Escape
- **WHEN** the mobile menu is open and the customer presses Escape
- **THEN** the menu closes and focus returns to the "Menu" button

#### Scenario: Focus stays in open menu
- **WHEN** the mobile menu is open and the customer presses Tab repeatedly
- **THEN** focus cycles only through the menu's controls and never reaches the page behind it

#### Scenario: Desktop navigation
- **WHEN** the screen is 768 px wide or wider
- **THEN** the primary links are shown inline in the header and no "Menu" button is present

### Requirement: Skip link
The first focusable element on every storefront page SHALL be a "Skip to content" link that is visually hidden until focused and moves focus to the page's main content.

#### Scenario: Skip to main content
- **WHEN** a keyboard user loads a storefront page and presses Tab once, then Enter
- **THEN** a visible "Skip to content" link was focused, and focus moves to the `main` landmark

### Requirement: Storefront footer
Every storefront page SHALL end with a footer containing links to Shop (`/shop`), New Drop (`/drops`), Lookbook (`/lookbook`), Archive (`/drops/archive`), Our Story (`/story`), Size Guide (`/size-guide`), Shipping (`/shipping`), Returns (`/returns`), FAQ (`/faq`), Contact (`/contact`), and Order Tracking (`/track-order`), grouped under labelled headings. It SHALL also contain Instagram and TikTok links that open the brand's external profiles in a new tab with `rel="noopener noreferrer"`, and the newsletter form defined by `storefront-homepage`.

#### Scenario: Footer links
- **WHEN** a customer reaches the bottom of any storefront page
- **THEN** the footer shows every listed internal link with its destination, grouped under headings, plus Instagram and TikTok links that open in a new tab with `rel="noopener noreferrer"`

### Requirement: Links to pages not built yet
Navigation links whose pages do not exist yet SHALL point to their planned routes, and visiting such a route SHALL show the storefront's "Page not found" page with the header and footer intact, never an unstyled or broken page.

#### Scenario: Planned route not yet built
- **WHEN** a customer follows the Lookbook link before the lookbook page exists
- **THEN** the storefront "Page not found" page is shown with status 404 and the header and footer are present
