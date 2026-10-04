# Design

## Context

`apps/web` today has a root layout with a text header, a "Coming soon" page that calls the API's `/health` on every request, `not-found` and `error` pages, a server-only store API client (`src/lib/api/store.ts`), and a feature-folder convention (`src/features/README.md`). Tailwind 4 uses the shared preset in `packages/config/tailwind/theme.css` (ink, paper, muted, line, danger; system fonts). Unit tests run in Vitest's node environment, and there is no storefront E2E yet. Requirements are in `specs/`; motivation and scope are in `proposal.md`.

No product, collection, drop, or lookbook data exists in the API or database. `@ite/contracts` has `Money` but no catalog schemas.

## Goals / Non-Goals

**Goals:**
- An editorial homepage whose layout, components, and data shapes survive the arrival of real catalog, drop, and lookbook data. Later changes replace one function's data source, not components.
- A small visual system (tokens, type scale, a handful of components) that later storefront pages reuse.
- Accessibility, responsiveness, and reduced motion enforced by automated tests, not just intended.

**Non-Goals:**
- A general component library or design-system package.
- Client-side state, data fetching libraries, or animation libraries.
- Any change to `apps/api`, `apps/admin`, `packages/db`, or `packages/contracts`.

## Decisions

### D1. Feature folders and component boundaries
```
src/app/
  layout.tsx                 html/body, fonts, SkipLink, SiteHeader, <main id="main">, SiteFooter
  page.tsx                   HomePage: await getHomeContent(), render sections in order
  not-found.tsx, error.tsx   kept; restyled to the new system
src/features/
  navigation/                site chrome shared by every page
    nav-links.ts             single source for header, mobile-menu, and footer links
    components/SiteHeader.tsx       (server)  wordmark + inline links ≥ md + MobileMenu
    components/MobileMenu.tsx       (client)  <dialog>-based modal menu
    components/SiteFooter.tsx       (server)  link groups, socials, NewsletterForm
  home/
    content.ts               typed placeholder content (the only place copy and placeholder items live)
    server/get-home-content.ts      async getHomeContent(): HomeContent  ← the data seam
    components/Hero.tsx, CampaignBanner.tsx, ShopTheLookPreview.tsx,
               LookbookPreview.tsx, Manifesto.tsx, NewsletterSection.tsx, SectionHeading.tsx
    components/NewsletterForm.tsx   (client) also used by the footer
    types.ts                 HomeContent and section view models
  catalog/
    types.ts                 ProductSummary view model
    components/ProductCard.tsx, ProductGrid.tsx, ProductRail.tsx
  drops/
    types.ts                 DropSummary view model (status 'live' | 'upcoming', startsAt)
    components/DropFeature.tsx
src/components/              only truly shared, domain-free UI
  MediaFrame.tsx             aspect-ratio box: next/image when src exists, placeholder otherwise
  Wordmark.tsx
src/lib/
  format-money.ts            Money → localized string (Intl.NumberFormat)
  api/store.ts               unchanged; used by future real-data loaders
```
- **Why:** follows `src/features/README.md`. Catalog and drop components live in their future-owning features, so the product listing page and drop pages reuse them. Homepage-only sections stay in `home/`. Only `MediaFrame` and `Wordmark` are generic. `NewsletterForm` lives in `home/` and the footer imports it through `home`'s public `index.ts`; it moves to its own feature when sign-up persistence exists.
- **Server/client split:** everything is a Server Component except `MobileMenu`, `NewsletterForm`, and nothing else. Product hover is pure CSS. The homepage ships almost no JavaScript.
- **Alternative:** one `home/` folder holding everything. Rejected because product cards and the drop feature are catalog and drop concerns that later pages need.

### D2. View models and the data seam
- `ProductSummary = { slug, name, color, price: Money, image: Media | null, hoverImage: Media | null }`, where `Media = { src, alt, width, height }`. `DropSummary = { slug, collection: 'COLLECTION 001', title: 'COST OF LIVING', status: 'live' | 'upcoming', startsAt: string /* ISO */, image: Media | null }`. `HomeContent` aggregates hero, drop (nullable), featured, campaign, look (image plus 2–3 `LookItem`s, each with a product and optional `{ x, y }` percentage position), newArrivals, lookbook images, and manifesto.
- `Money` is imported from `@ite/contracts`; nothing from contracts is redefined. The view models are presentation types local to `apps/web`, because catalog contracts do not exist yet. When they do, a mapper converts contract responses to these view models inside each feature's `server/` folder, so components keep their props.
- `getHomeContent()` is `async` and returns the static `content.ts` object today. It is the single seam: a later change makes it call `storeGet(...)` for featured products, the current drop, and the lookbook, while copy such as the hero and manifesto may stay static.
- **No API calls** for placeholder data. The `/health` call is removed from the home page, which makes `/` static (D7). `store.ts` and its tests remain unchanged.
- Placeholder prices use `IDR` as a stand-in currency. The formatter handles any ISO 4217 currency, so switching markets later is a data change.

### D3. Visual system
- **Palette:** the official InThisEconomy brand palette. It extends the shared preset in `apps/web/src/app/globals.css` via `@theme` (the admin is unaffected), and replaces the earlier monochrome proposal and any bright orange.

  | Token | Hex | Role |
  |---|---|---|
  | `brand` | `#B1641E` | Brand Brown ("Dirty Brown", RGB 177 100 30, CMYK 24 66 100 11): the primary accent |
  | `brand-dark` | `#7C4318` | Dark Brown: small accent text on light surfaces, primary CTA hover |
  | `cream` | `#F2EBDD` | Warm Cream: featured surfaces, hero and campaign copy plates |
  | `ink` | `#171615` | Near Black: text, dark sections, footer |
  | `stone` | `#756F67` | Warm Grey: secondary text on warm white only |
  | `sand` | `#CCB99F` | Sand: hairlines, placeholder panels, small text on near black |
  | `soft` | `#D9B48C` | Soft Brown: small accent text on near black (e.g. drop labels) |
  | `paper` | `#FAF8F3` | Warm White: the page background |

  - **Feel:** earthy, warm, understated, vintage-modern editorial streetwear. Not luxury-formal, not colourful e-commerce, not orange-heavy. No red or blue accents (form errors use Dark Brown on light and Soft Brown on dark), no gradients, no shadows, no rounded corners.
  - **Contrast rules** (WCAG 2.2 AA; ratios measured):
    - Near Black on cream is 15.2:1, and on warm white 17.0:1.
    - Brand Brown is 3.76:1 on cream, 4.20:1 on warm white, and 4.05:1 on near black. So it is used only for large text (at least 24 px, or 18.66 px bold), the wordmark (logos are exempt), non-text UI (focus outlines, underlines, borders, markers), and backgrounds behind large text.
    - Small brown text uses Dark Brown on light surfaces (6.62:1 on cream) and Soft Brown on near black (9.34:1).
    - Secondary text on cream uses Near Black at 70% (6.16:1), because Warm Grey on cream is only 4.19:1.
  - **Where Brand Brown appears:**
    - wordmark (header in Brand Brown, footer in Brand Brown on near black)
    - primary CTAs: Brand Brown background with warm white label at 19 px bold (large text, 4.20:1), Dark Brown on hover (7.40:1)
    - drop label markers and borders
    - price emphasis via the Dark Brown shade
    - navigation hover and active underlines
    - small editorial details (section rules, look-item numbers in Dark Brown)
    - focus outlines (Brand Brown on light and dark; cream on Brand Brown)
    - the manifesto background
    - Headings are not coloured brown, apart from the large campaign line in the hero.
  - **Section rhythm:**
    - Header: warm white, Brand Brown wordmark.
    - Hero: imagery with a cream copy plate; Dark Brown collection label, Brand Brown campaign line, Near Black headline.
    - Drop: full-bleed near black; cream title, Soft Brown labels, Brand Brown marker and CTA.
    - Featured: full-bleed cream band; Near Black names, 70% Near Black colours, Dark Brown prices.
    - Campaign: full visual with a warm white plate.
    - Shop the look: warm white.
    - New arrivals: warm white.
    - Lookbook: warm white (light neutral).
    - Manifesto: Brand Brown background with cream large type, and a cream button with Near Black label.
    - Newsletter: warm white.
    - Footer: near black; Brand Brown wordmark, cream links, Sand group headings, and a cream newsletter button.
  - **Placeholders:** sand panels with 70% Near Black captions (4.81:1).
- **Typography:** one variable display-and-text family, **Archivo** (width and weight axes), loaded with `next/font/google` using `display: swap` and a metric-matched fallback.
  - Moving to `next/font/local` with committed font files is a possible future branding or deployment optimization, for example a licensed brand typeface or builds without network access. It is not part of this change; the font API and the requirements stay the same.
  - Headlines use the expanded width, weight 800–900, uppercase, tight leading and tracking.
  - Body uses normal width at 400–500.
  - Fluid type scale with `clamp()`. The hero headline goes up to about 12vw on large screens.
  - Prices and labels use small caps-style uppercase at wide tracking.
  - **Alternative:** two families (a display face plus a sans). Rejected: one variable family keeps font bytes and CLS risk low.
- **Composition:**
  - Full-bleed media, a 12-column grid at ≥ 1024 px, generous vertical rhythm (sections separated by about 96–160 px on desktop, about 64 px on mobile), and hairline dividers.
  - Asymmetric editorial layouts for the campaign, Shop The Look, and lookbook sections (for example, a 7/5 split and offset image stacks), not uniform card grids.
  - Product cards are borderless: image, then a quiet text block. No card chrome.
- **Placeholders:** `MediaFrame` without `src` renders a sand-toned panel at the requested aspect ratio, with a faint inline-SVG grain texture (CSS background, no network) and a small uppercase caption such as "CAMPAIGN IMAGE". It is `aria-hidden`, so the surrounding headings and product names carry meaning.

### D4. Header and mobile menu
- **Sticky solid header:** `position: sticky`, `paper` background, and a hairline bottom border. A transparent-over-hero header was rejected: it needs scroll listeners to keep contrast, which adds JavaScript and accessibility risk for little gain. The `html` element gets `scroll-padding-top` equal to the header height, so focused or anchored content is never hidden behind it.
- **≥ 768 px:** wordmark on the left, and primary links plus Search and Cart as text links.
- **< 768 px:** wordmark, Search and Cart icon links (with text labels for screen readers), and a "Menu" button.
- **The mobile menu is a native `<dialog>` opened with `showModal()`.** This gives built-in focus containment, an inert background, and Escape handling.
  - The trigger has `aria-expanded` and `aria-controls`.
  - On close, focus returns to the trigger.
  - Link clicks close it.
  - Opening uses a short opacity and translate transition (disabled under reduced motion).
  - A custom div overlay was rejected: it would need hand-rolled focus trapping.
- **One link list for all three:** `nav-links.ts` exports `PRIMARY_LINKS`, `UTILITY_LINKS` (Search, Cart), `FOOTER_GROUPS`, and `SOCIAL_LINKS`, so the header, menu, and footer cannot drift apart. The account and wishlist exclusion is enforced by a test on these lists and on the rendered output.

### D5. Interaction and motion
- Product hover swap: both images are stacked, and the second fades in on `group-hover`/`group-focus-visible`, gated with Tailwind's `[@media(hover:hover)_and_(pointer:fine)]` and `motion-safe:` variants. Without a fine pointer, or with reduced motion, the primary image stays.
- Links get an animated underline on hover and focus (`motion-safe`). There are no scroll-triggered animations, autoplay, parallax, or carousels with timers.
- A global reduced-motion rule in `globals.css` sets all transition and animation durations to 0 under `prefers-reduced-motion: reduce`, as a backstop beyond the per-class `motion-safe:` variants.
- **Focus:** a visible 2 px Brand Brown outline with offset (at least 3:1 against warm white, cream, and near black), and a cream outline on the Brand Brown manifesto, via `focus-visible`, applied globally and never removed.

### D6. Drop states and countdown readiness
- `DropFeature` takes `{ drop: DropSummary; now?: Date }`. If `status === 'upcoming'`, it renders the release date in `<time dateTime>` and a labelled empty `<div data-countdown aria-label="Countdown to release">` placeholder. A later change mounts a small client `Countdown` there. Live state renders the explore link.
- The homepage passes `content.drop`, and when it is `null` the section is not rendered.

### D7. Rendering and performance
- With the API call removed, `/` is prerendered statically (no `dynamic` export). When `getHomeContent()` later fetches real data, it will use `storeGet(..., { revalidate })` (already supported) so the page stays statically generated with periodic revalidation rather than per-request.
- **Images:** `MediaFrame` uses `next/image` with explicit `sizes` per layout. Only the hero sets `priority`. `fill` is used inside an aspect-ratio box. `images.remotePatterns` is left empty until a media host is chosen.
- **LCP** today is the hero headline text (placeholders are CSS). `next/font` with `display: swap` and fallback metrics keeps CLS near zero.
- **Error and fallback:** the existing `error.tsx` stays for future data failures and is restyled. Sections whose data is missing are omitted (drop), or render without the missing optional parts (hover image). The newsletter form never depends on a server. `not-found.tsx` is restyled and rendered inside the layout, so planned-but-unbuilt routes show header and footer.

### D8. Newsletter (frontend-only)
- A client component with a labelled `type="email"` input and `noValidate`. Validation runs on submit with a simple RFC-shaped pattern. An error shows inline, linked with `aria-describedby`/`aria-invalid`, and focus returns to the input.
- A valid submit replaces the form with a polite live-region message: "Newsletter sign-up isn't open yet — we haven't saved your email." No `fetch`, no Server Action, no cookies or storage.
- **Alternative:** a "Thanks, you're subscribed!" message. Rejected because it would be untrue while nothing is persisted.

### D9. Testing
- **Component tests** (Vitest with `jsdom` and Testing Library, configured per file or by a `*.test.tsx` environment override; node-env tests stay as they are):
  - `ProductCard` (content, link, accessible name, no extra controls, price formatting)
  - `formatMoney`
  - `DropFeature` (live, upcoming, `time` element, countdown slot)
  - `NewsletterForm` (invalid email keeps focus; valid email shows the message and calls no `fetch`)
  - `nav-links` (no account/wishlist entries; footer contains every required link)
  - `getHomeContent` (returns 2–3 look items, 4 featured products)
- **Storefront Playwright suite** (`apps/web/e2e`, run against `next build && next start` on port 3100, needs no API):
  - section order and headings
  - hero first-screen height
  - grid columns at 375 and 1440
  - New Arrivals contained scroll
  - no horizontal overflow at the six widths
  - mobile menu (open, Tab containment, Escape returns focus)
  - skip link
  - visible focus while tabbing
  - reduced-motion emulation
  - `@axe-core/playwright` scans (mobile, desktop, menu open; WCAG 2.2 A/AA tags; fail on serious or critical)
  - a CLS measurement via `PerformanceObserver`
  - the newsletter making no request
  - a 404 route showing header and footer
  - homepage rendering with no API running (the suite never starts one)
- Test titles equal the spec scenario names, so `pnpm spec:coverage` covers this change. The script is extended to accept several change names.
- **"Static homepage"** is verified by asserting the build's prerender manifest contains `/`.
- **CI** adds `pnpm --filter @ite/web e2e` after the admin E2E. Locally, both suites use the installed Chrome (`channel: 'chrome'` unless `CI`).

## Risks / Trade-offs

- [Placeholder visuals can make the editorial direction hard to judge] → Placeholders follow the real aspect ratios and art direction (crops, captions), and swapping in photography is a data change (`Media` objects). Real campaign assets should be supplied before launch.
- [Links point to routes that do not exist yet] → They render the styled 404 with full navigation. Each later page change makes its link live without touching navigation.
- [`next/font/google` needs network access to Google Fonts when the storefront is built] → CI and typical hosting builds have it. If that ever stops being true, or the brand adopts its own typeface, switch to `next/font/local` (see D3); that is a future optimization, not part of this change.
- [Stand-in currency (IDR) may not match the eventual market] → Prices are `Money` values in placeholder data, and the formatter is currency-agnostic.
- [`<dialog>` behaviour differences across browsers] → Supported by all evergreen browsers. Playwright covers Chromium, and manual spot-checks cover Safari and Firefox before release.
- [Axe cannot catch every accessibility problem] → It is combined with the scripted keyboard, focus, and reduced-motion tests, and a manual screen-reader pass is listed as a release check.
- [More E2E time in CI] → The storefront suite needs no API or database and runs against a static build, so it adds about 1–2 minutes.

## Migration Plan

Frontend-only and additive, apart from removing the home page's `/health` call. Deploy by rebuilding `apps/web`. Rollback is redeploying the previous build. No data or API changes.

## Open Questions

- Brand social profile URLs for Instagram and TikTok. Placeholders (`https://www.instagram.com/`, `https://www.tiktok.com/`) live in `nav-links.ts` until provided.
- Final campaign photography and video, and whether the hero will use video (the structure supports both via `MediaFrame`).
