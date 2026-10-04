# Proposal

## Why

The storefront (`apps/web`) is still a "Coming soon" shell. InThisEconomy needs a homepage that establishes the brand: minimalist editorial streetwear, premium but not luxury, reading like a fashion editorial rather than a marketplace. Building it now, with static placeholder content shaped like the real catalog, drop, and lookbook data, lets the visual identity and page architecture settle before the product domain exists. Those later changes then only swap data sources instead of redesigning pages.

## What Changes

- Replace the placeholder home page with the full editorial homepage. In order:
  1. Hero (IN THIS ECONOMY / COLLECTION 001 / COST OF LIVING / SHOP THE DROP)
  2. Current/Next Drop (live and upcoming states, countdown-ready)
  3. Featured Products grid
  4. Campaign/Editorial banner
  5. Shop The Look preview (hotspot-ready structure, no hotspot logic)
  6. New Arrivals
  7. Lookbook preview
  8. Brand Manifesto (OUR ECONOMY.)
  9. Newsletter (frontend-only)
- Add site-wide storefront navigation:
  - **Header:** wordmark, Shop, New Drop, Lookbook, Story, Search, Cart.
  - **Mobile menu:** accessible.
  - **Footer:** shop, help, and social links, plus the newsletter field.
- Establish the storefront visual system in Tailwind: monochrome palette (black, off-white, greys), a bold display typeface, sharp un-rounded composition, generous whitespace, and subtle motion that respects `prefers-reduced-motion`.
- Introduce presentation-level view models and reusable components where real data will plug in later:
  - product card
  - price formatting from the shared `Money` contract
  - media frame (placeholder now, `next/image` when real images exist)
  - drop feature
- Serve placeholder content from a single typed content module behind an async `getHomeContent()` seam. No API calls are made for placeholder data. The homepage becomes statically renderable.
- **BREAKING (storefront behavior only):** the home page no longer calls the API's `/health` on each request. With the API down, the homepage still renders (it previously showed the error page). The error page and the store API client remain for future real data.
- Add component tests and a Playwright suite for the storefront: structure, responsiveness, keyboard navigation, automated accessibility checks, and reduced motion. Run it in CI.

**Out of scope:**
- customer accounts, login/register, wishlist (permanently excluded)
- cart and checkout logic
- search functionality
- product, collection, drop, or lookbook database models and API endpoints
- newsletter persistence
- hotspot interaction logic
- the countdown timer itself
- real photography
- pages other than the homepage (links point to their planned routes)

## Capabilities

### New Capabilities

- `storefront-navigation`: Site-wide header (wordmark, primary links, Search, Cart), accessible responsive mobile menu, and footer link groups with social links, shared by every storefront page.
- `storefront-homepage`: The homepage's sections, content, and states. Covers placeholder data and the data seam, the frontend-only newsletter form, responsive layout, accessibility, motion, and performance requirements.

### Modified Capabilities

_None. No main specs exist yet; `initial-platform` is not archived, and its specs do not cover storefront page content._

## Impact

- **Code:** `apps/web` only.
  - New feature folders: `src/features/home`, `src/features/navigation`, `src/features/catalog` (product card and view model), `src/features/drops` (drop feature and view model).
  - Shared UI kept small: `src/components/` for `MediaFrame` and `Wordmark`.
  - Replaced files: `src/app/page.tsx`, `src/app/layout.tsx`, and `globals.css`.
- **Not affected:** `apps/api`, `apps/admin`, `packages/db`. `packages/contracts` is reused (`Money`), not changed.
- **Dependencies (apps/web, dev only):**
  - `@testing-library/react`, `@testing-library/user-event`, `jsdom` for component tests
  - `@playwright/test` and `@axe-core/playwright` for E2E and accessibility checks
  - The display font, Archivo, is loaded with `next/font/google`.
- **CI:** an additional storefront E2E step in `.github/workflows/ci.yml`.
- **Behavior:** the home route becomes static instead of per-request (see BREAKING above).
