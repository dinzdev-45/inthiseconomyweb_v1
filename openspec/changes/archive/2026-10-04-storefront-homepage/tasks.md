# Tasks

## 1. Foundations

- [x] 1.1 Add the storefront visual tokens (ink, paper, bone, stone, line), fluid type scale, global `focus-visible` outline, `scroll-padding-top`, and the reduced-motion backstop rule to `apps/web/src/app/globals.css` via `@theme`, leaving the shared preset and the admin unchanged; verify `pnpm --filter web build` succeeds and the admin build is unchanged
- [x] 1.2 Load Archivo (variable width and weight) with `next/font/google` (`display: swap`, fallback metrics) and expose it as the storefront font variable; verify the build succeeds and the homepage renders text in Archivo with `font-display: swap`
- [x] 1.3 Add component-test tooling to `apps/web` (`jsdom`, `@testing-library/react`, `@testing-library/user-event`) for `*.test.tsx`, keeping existing node-environment tests unchanged; verify a trivial component test and the existing store/env tests pass
- [x] 1.4 Add a storefront Playwright setup (`apps/web/playwright.config.ts`, `e2e/`, `@axe-core/playwright`; `next build && next start` on port 3100; installed Chrome locally, bundled Chromium in CI; no API started) and a `pnpm --filter @ite/web e2e` script; verify a smoke test loads `/`
- [x] 1.5 Extend `scripts/spec-coverage.ts` to accept several change names (default: all active changes) and add `storefront-homepage`; verify it reports the new scenarios as missing before tests exist

## 2. Data seam and shared building blocks

- [x] 2.1 Define view models (`ProductSummary` and `Media` in `features/catalog/types.ts`, `DropSummary` in `features/drops/types.ts`, `HomeContent` and `LookItem` in `features/home/types.ts`), reusing `Money` from `@ite/contracts`; verify typecheck passes and no contract type is redefined
- [x] 2.2 Write `features/home/content.ts` placeholder content (hero copy, live drop COLLECTION 001 / COST OF LIVING, four featured products, campaign, a look with three items and positions, new arrivals, lookbook images, manifesto) and the async `getHomeContent()` seam; verify with a unit test that it returns four featured products and two to three look items
- [x] 2.3 Implement `formatMoney(Money)` in `src/lib/format-money.ts`; verify the "Price formatting" scenario test (IDR without decimals, USD with two) and other currencies
- [x] 2.4 Implement `MediaFrame` (`next/image` with `fill` and `sizes` when `src` exists; `aria-hidden` bone placeholder with grain and caption otherwise; fixed aspect ratio; optional `priority`) and `Wordmark`; verify component tests for both branches and that the aspect ratio is set before load

## 3. Storefront navigation

- [x] 3.1 Create `features/navigation/nav-links.ts` (primary, utility, footer groups, social links); verify a unit test that the lists contain every spec'd destination and no account, login, register, or wishlist entry
- [x] 3.2 Build `SiteHeader` (sticky, solid, hairline; inline links ≥ 768 px; Search/Cart links with accessible names) and the "Skip to content" link, and wire them into `layout.tsx` with `<main id="main">`; verify the "Header links", "Header stays available", and "Skip to main content" scenario tests in Playwright
- [x] 3.3 Build `MobileMenu` as a `<dialog>` opened with `showModal()` (trigger with `aria-expanded`/`aria-controls`, close button, Escape, focus return, close on link click, motion-safe transition); verify "Open mobile menu", "Close mobile menu with Escape", "Focus stays in open menu", and "Desktop navigation" scenario tests
- [x] 3.4 Build `SiteFooter` (labelled link groups, Instagram/TikTok with `target="_blank"` and `rel="noopener noreferrer"`, newsletter form slot) and restyle `not-found.tsx` and `error.tsx` to the new system; verify "Footer links", "Planned route not yet built", and "No account or wishlist controls" scenario tests

## 4. Product and drop components

- [x] 4.1 Build `ProductCard` (single link to `/products/<slug>`, image, name, color, formatted price, CSS-only hover image gated on fine pointer and motion-safe, no other controls); verify "Product card content", "No shopping controls on cards" (component tests), and "Hover image on desktop" (Playwright, including touch and reduced-motion emulation)
- [x] 4.2 Build `ProductGrid` (2 columns < 1024 px, 4 at ≥ 1024 px) and `ProductRail` (contained horizontal scroll with snap < 1024 px, grid at ≥ 1024 px); verify the "Featured products grid" and "New arrivals layout" scenario tests
- [x] 4.3 Build `DropFeature` with live and upcoming states (`time` element with `datetime`, labelled countdown slot without a timer); verify "Live drop" and "Upcoming drop" component tests

## 5. Homepage sections and page

- [x] 5.1 Build `Hero` (min height of viewport minus header, the exact copy, "SHOP THE DROP" → `/drops`, `MediaFrame` with `priority`, AA-contrast text treatment); verify the "Hero content" and "Hero fills the first screen" scenario tests
- [x] 5.2 Build `CampaignBanner`, `ShopTheLookPreview` (look image, two to three item links, "SHOP THE LOOK" → `/lookbook`, positions kept as data attributes without interactive markers), `LookbookPreview` (at least two images, "VIEW LOOKBOOK"), and `Manifesto` ("OUR ECONOMY.", copy, link to `/story`); verify the "Campaign banner", "Shop the look preview", "Lookbook preview", and "Brand manifesto" scenario tests
- [x] 5.3 Build `NewsletterForm` (labelled email, inline error with `aria-invalid`/`aria-describedby`, focus kept on invalid input, honest "not open yet, not saved" live message, no `fetch`, cookies, or storage) and `NewsletterSection`; use it in the footer too; verify "Invalid newsletter email" (component test) and "Newsletter submission stays local" (Playwright, asserting no requests and empty storage)
- [x] 5.4 Compose `src/app/page.tsx` from `getHomeContent()` in spec order, with each section an `aria-labelledby` section, one `h1`, and the drop section omitted when null; remove the `/health` call and the `dynamic` export; set homepage metadata; verify "Homepage section order", "Heading structure", and "No drop to feature" scenario tests

## 6. Quality verification

- [x] 6.1 Add Playwright checks for "No horizontal overflow" (320, 375, 768, 1024, 1440, 1920), "Visible focus" (tab through all interactive elements and compare outlines), and "Reduced motion" (emulated, no running animations or non-zero transitions, menu opens instantly); verify they pass
- [x] 6.2 Add `@axe-core/playwright` scans for "Automated accessibility scan" (mobile, desktop, and mobile menu open; WCAG 2.2 A/AA; fail on serious or critical) and fix any findings; verify zero serious or critical violations
- [x] 6.3 Add "Placeholder media" (no `img` without `src`, placeholders `aria-hidden`, text still identifies items) and "Reserved media space" (CLS below 0.1 via `PerformanceObserver`) checks; verify they pass
- [x] 6.4 Add "Homepage does not depend on the API" (the suite runs with no API; assert status 200, all sections, and no requests to `API_URL`) and "Static homepage" (assert `/` is in the build's prerender manifest) checks; verify they pass

## 7. CI and wrap-up

- [x] 7.1 Add the storefront E2E step to `.github/workflows/ci.yml` (after the admin E2E, reusing the installed Chromium); verify `actionlint` passes and the full CI command sequence passes locally from a clean copy
- [x] 7.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, both E2E suites, and `pnpm spec:coverage` (zero missing for `storefront-homepage`); verify all pass, and record a manual keyboard, VoiceOver, and Safari/Firefox spot-check of the homepage and mobile menu
  - Recorded 2026-10-03: lint, typecheck, test, build, admin E2E (8/8), storefront E2E (37/37; local Chrome and CI Chromium), and spec coverage (initial-platform 47/47, storefront-homepage 37/37) all pass.
  - Keyboard spot-check (automated): Tab reaches every interactive element with a visible outline; skip link, menu focus containment, and Escape all pass.
  - Firefox (Playwright, Firefox 155): all storefront tests pass. WebKit (Playwright, Safari engine): all pass except four Tab-key tests, because Safari's default Tab skips links; with Option+Tab the skip link, menu focus containment, and focus outlines were verified working.
  - Found and fixed in WebKit/Firefox: 320 px horizontal overflow from the newsletter email input's intrinsic width.
  - Re-run 2026-10-04 (after the brand palette, section 8): lint, typecheck, test, build, admin E2E (8/8), storefront E2E (39/39), and spec coverage (storefront-homepage 39/39) all pass.
  - VoiceOver (manual, recorded 2026-10-04): homepage reading order is logical; headings and links are announced correctly; the mobile menu is understandable and usable, and focus does not escape to background content while it is open; newsletter controls have meaningful accessible names; decorative media causes no unnecessary announcements; the skip link works. No blocking issues found.

## 8. Brand palette

- [x] 8.1 Replace the storefront tokens with the brand palette (brand, brand-dark, cream, ink, stone, sand, soft, paper), move focus outlines to Brand Brown, and replace the red error colour; verify the build and that the admin's CSS is unchanged
- [x] 8.2 Apply the section rhythm and accent roles from design D3 (header and footer wordmark, primary CTA style, drop band, featured cream band, product prices, manifesto, footer, newsletter tones, placeholders, 404 and error pages) without changing structure or behaviour; verify every existing storefront test still passes
- [x] 8.3 Add the "Brand accent usage" and "Brand Brown only on large text" scenario tests, and rerun the accessibility scans, the six-width overflow check, and spec coverage; verify zero serious or critical violations and full coverage

