# Design

## Context

See `proposal.md` for motivation; requirements are in `specs/`.

**The admin today:**
- Next.js 16 App Router in `apps/admin`, with an authenticated `(app)` route group.
- Server pages read with `apiGetForPage` (`src/lib/api/server.ts`), which forwards the session cookie server to server and redirects on `401` or a temporary password.
- Client components mutate with `apiSend` (`src/lib/api/client.ts`) through the same-origin `/api/*` rewrite, so the API's Origin check applies.
- Failures become `ApiError` (`status`, `code`, `detail`, field `errors`, `requestId`).
- `StaffManager` is the reference pattern: a `run(action)` wrapper handles busy state and errors, then calls `router.refresh()`.
- Navigation is a permission-filtered `NAV_ITEMS` list.
- The visual language is minimal: `ink`, `paper`, `muted`, `line`, and `danger` tokens, bordered inputs, and plain tables, built from small primitives in `src/components/ui.tsx`.

**Constraints and test setup:**
- Apps never import each other (a lint rule).
- The admin's Vitest runs in a Node environment on `src/**/*.test.ts` only (no DOM).
- Playwright E2E runs the built admin against a real API and a fresh `ite_e2e` database.

**The product-domain API (archived, now main specs) already provides:**
- every catalog read and write the UI needs, with `catalog:read` / `catalog:manage`
- problem+json errors with stable codes
- an opaque cursor for the product list

**Gaps:**
- It doesn't expose the store currency.
- Its list items have no stock figures.

Both are resolved by D7.

**Permissions:** `OWNER` and `ADMIN` both hold `catalog:read` and `catalog:manage`, so no real account can be "read-only". The read-only UI path is real, but it can only be exercised through unit tests (D12).

## Goals / Non-Goals

**Goals:**
- Thin pages over the existing API: no business rule is re-implemented in the admin beyond UX conveniences (which actions to offer for a status, form input parsing).
- One shared way to run a catalog mutation, render its errors, and refresh data, used by every screen.
- Everything works with a keyboard and passes axe, with no drag-and-drop dependency.

**Non-Goals:**
- Client-side readiness checks or a "readiness checklist"; the API's `PRODUCT_NOT_READY` text is shown as is.
- Showing who last edited a record by email. `updatedBy` is an id, and resolving it needs `staff:read`, which `ADMIN` lacks. Times are shown instead.
- Bulk actions, CSV import, image upload, image cropping, `next/image` remote patterns.
- Client caching or optimistic UI, and new UI libraries (component kits, form, or data-fetching libraries).

## Decisions

### D1. Routes

All routes live inside the existing `(app)` group, so the shell, session checks, and forced password change apply unchanged:

| Route | Page |
|---|---|
| `/catalog/products` | Product list. Query: `q`, `status`, `categoryId`, `cursor` |
| `/catalog/products/new` | Create product (`catalog:manage`) |
| `/catalog/products/[id]` | Product page with sections: details, lifecycle, variants and stock, images |
| `/catalog/categories` | Categories. Query: `status` |
| `/catalog/sizes` | Sizes |
| `/catalog/colors` | Colors |

- Each route has a `loading.tsx` (a skeleton with `aria-busy`).
- `/catalog` has an `error.tsx` boundary showing a generic message, the request id when the error carries one, and a retry button.
- An unknown product id calls `notFound()` and shows a "Product not found" page.
- Navigation gains Products, Categories, Sizes, and Colors (`catalog:read`) between Dashboard and Staff.
- **Alternatives:**
  - One "Catalog" page with tabs. Rejected: separate URLs are linkable, and each page loads only its own data.
  - Variants and images on their own routes. Rejected: they make sense only in the context of a product, and readiness depends on all three.

### D2. Feature folder and boundaries

```
src/features/catalog/
  shared/        access.ts (catalogAccess), money-input.ts, problem.ts (ApiError → view state),
                 useCatalogAction.ts, ErrorSummary.tsx, ConfirmAction.tsx, StatusBadge.tsx,
                 PriceInput.tsx, EmptyState.tsx, SuccessMessage.tsx
  data.ts        server-only loaders (apiGetForPage + @ite/contracts schemas)
  products/      ProductList.tsx, ProductFilters.tsx, ProductForm.tsx, LifecycleActions.tsx,
                 VariantsSection.tsx, VariantForm.tsx, StockAdjuster.tsx, ImagesSection.tsx,
                 lifecycle.ts (actions offered per status), list-query.ts
  reference/     CategoriesManager.tsx, SizesManager.tsx, ColorsManager.tsx
```

- **Pages** under `src/app/(app)/catalog/**/page.tsx` stay thin. Each one:
  - checks `catalogAccess(staff.permissions).canRead` (otherwise `<NotPermitted />`, before any catalog request)
  - loads data through `data.ts`
  - passes `canManage` and the data to client components
- **The client/server boundary is explicit:** `data.ts` imports `server-only`; components that mutate are `'use client'` and use only `apiSend`.
- **Schemas:** every request and response is parsed with the existing `@ite/contracts` schemas; no local contract types.
- **Shared UI:** small primitives used more than once (`Textarea`, `Badge`, `Table` helpers) are added to `src/components/ui.tsx` in the same style.

### D3. Mutations: `useCatalogAction`

A hook generalizing `StaffManager.run`:
- **State:** `busy`, the error view state, and the last success message.
- **On run:** it calls the action, then on success calls `router.refresh()` and sets a success message.
- **Auth errors** use the existing `authRedirectFor`: `401` goes to `/login`, and `PASSWORD_CHANGE_REQUIRED` to the change-password page.
- **Other failures** go through `problem.ts`:
  - **`400` with field errors:** a summary plus per-field messages (paths such as `basePrice.amount` map to the form's field names).
  - **`403 FORBIDDEN`:** a "not permitted" message.
  - **`409` or `422` with a code:** the API `detail`, plus a field when the code maps to one (`SLUG_EXISTS` → slug, `SKU_EXISTS`/`SKU_LOCKED` → SKU, `CODE_EXISTS` → code, `VARIANT_EXISTS` → size/color).
  - **Anything else:** "Something went wrong" plus `Reference: <requestId>`.
- **Focus:** after a failed submission, focus moves to the `ErrorSummary` (`role="alert"`, `tabIndex={-1}`). Success messages use a polite live region.
- **No optimistic updates:** every action waits for the API, then re-renders from refreshed server data. Lifecycle and stock never change on screen before the API answers.
- **Alternatives:**
  - Next.js Server Actions. Rejected: mutations must go browser → API so the API's Origin check applies (initial-platform D8), and the existing helpers already do this.
  - A data library (SWR or React Query). Rejected: server components plus `router.refresh()` already cover this, with no new dependency.

### D4. Permissions in the UI

- `catalogAccess(permissions)` returns `{ canRead, canManage }` (a pure function, unit tested).
- Pages decide `NotPermitted` from `canRead`. Components render manage controls only when `canManage` is true.
- The API stays authoritative, and a `403` from it renders as "not permitted" (D3).
- Navigation entries use the existing `visibleNav` mechanism with `catalog:read`.

### D5. Lifecycle and readiness

- `lifecycle.ts` maps a status to the actions offered, mirroring the published transition table:
  - activate for `DRAFT`/`INACTIVE`
  - deactivate for `ACTIVE`
  - archive for `DRAFT`/`INACTIVE`
  - restore for `ARCHIVED`
  
  This is a convenience, not enforcement: whatever the API says (including `INVALID_STATE_TRANSITION` after a concurrent change) is shown.
- **Activation refused:** `PRODUCT_NOT_READY` shows the API's detail in an alert next to the activate button, with links to the variants and images sections. When the detail has the API's "…: a; b; c." form, the admin lays the same words out as a list; otherwise it shows the text verbatim. This is formatting only: the admin never recomputes readiness, so the reasons always match the server.
- **Confirmation:** deactivate and archive go through `ConfirmAction`, an inline two-step control. The button turns into "Confirm archive" and "Cancel", focus moves to Confirm, and Escape cancels.
- **Archived products:** the product page is read-only apart from Restore.

### D6. Money

- **Shared helpers:** `minorUnitDigits` and `formatMoney` move from `apps/web/src/lib/format-money.ts` into `packages/contracts/src/money.ts`, with the same behaviour and the same `id-ID` locale for IDR. `apps/web/src/lib/format-money.ts` re-exports them, so storefront imports and tests are unchanged. A new `parseMajorAmount(input, currency)` returns either `{ amount }` (integer minor units) or an error for:
  - non-numeric input
  - negative input
  - too many decimals for the currency
  
  Range checks stay with the API (its `0..2,000,000,000` limit returns a field error at `basePrice.amount`).
- **`PriceInput`:** labels the field with the store currency code and sends `{ amount, currency: storeCurrency }`.
- **The store currency** comes from `GET /api/v1/admin/catalog/settings`, loaded by the pages that show price inputs. Displayed prices always use each `Money` value's own currency.
- **Alternative:** a copy of `STORE_CURRENCY` in the admin env. Rejected (decided with the user): it can drift from the API and fail with `CURRENCY_MISMATCH`.

### D7. API additions (additive, product-domain module)

- **Catalog settings:**
  - `GET /api/v1/admin/catalog/settings` with permission `catalog:read`.
  - Returns `CatalogSettings = { storeCurrency }` (new strict contract) from the validated env.
  - Only `GET` (and `HEAD`) are registered, so other methods are unknown routes.
  - Added to the route-coverage table.
- **List stock summary:**
  - `ProductListItem` gains `stock: { totalQuantity, activeVariantCount, outOfStockVariantCount }`, all counted over `ACTIVE` variants (`outOfStockVariantCount`: active variants with stock 0).
  - All three come from one aggregate query over the page's product ids (`SUM`, `COUNT`, and a filtered `COUNT`, grouped by product), run after the page query. That's one extra query per page, not per row.
  - Products without active variants report `0`, `0`, and `0`.
  - The existing `variantCount` (all variants) is unchanged.
- **Alternative:** a separate stock endpoint. Rejected: it would mean one request per row or a new batch API for a single field.
- No other product-domain behaviour changes.

### D8. Product list

- **Filters:** `ProductFilters` is a plain `<form method="get">` (search, status, category), so the URL is the state, and back/forward and reload work without client state.
- **Pagination:**
  - "Next page" is a link that adds `cursor=<nextCursor>` while keeping the filters.
  - "First page" drops `cursor`.
  - No "previous page": the API cursor is forward-only, and keeping a cursor stack would add hidden state for little value.
- **Invalid cursor:** an `ApiError` with status `400` from the list request is caught in the page, which renders the invalid-link message and a first-page link.
- **Thumbnails** are plain `<img>` tags (48 px, `loading="lazy"`, the image's alt text), with a neutral placeholder when there's no primary image. `next/image` remote patterns stay deferred.
- **Row actions:** row lifecycle actions use `LifecycleActions` (D5) in a compact form.

### D9. Product page

- **Sections:** Details, Lifecycle, Variants and stock, Images.
- **Details:**
  - The form sends only changed fields, since `PATCH` is partial.
  - The slug input is read-only with a note when `activatedAt` is set; the API still enforces `SLUG_LOCKED`.
- **Variants:**
  - A table, with an inline add/edit form under it.
  - Size and color selects come from the reference data loaded server-side.
  - The edit form has no stock field.
  - The SKU is read-only after activation.
- **`StockAdjuster`:** per variant, it shows the current stock and a delta input (a whole number other than 0; the sign gives the direction) with an "Apply" button. The result shown is the API's returned quantity, after a refresh.
- **Images:**
  - A list in API order, each item with:
    - a preview `<img>`
    - its URL
    - its alt text
    - its variant
    - a "Primary" text label
    - "Make primary", "Move up", "Move down", "Edit" and "Delete" controls
  - Move up and move down send the full reordered id list (`PUT …/images/order`), and focus stays on the moved item's control.
  - The variant select lists only this product's variants.
  - There's no file input.

### D10. Reference-data pages

One client manager per page, following `StaffManager`: a table plus an inline create form, and an inline edit row.
- **Categories:** a status filter (query param) and archive/restore (archive is confirmed).
- **Sizes:** listed in API order; delete is confirmed.
- **Colors:** a swatch (`<span>` with an inline background colour and `aria-hidden`) next to the hex text; the hex can be cleared; delete is confirmed.
- **Refusals:** `IN_USE`, `CODE_EXISTS`, and `SLUG_EXISTS` are rendered through D3.

### D11. Accessibility details

- Every control gets a `<label>` (the existing `Field`).
- Tables have captions or `aria-label`s, and row action buttons carry the item name in their accessible name (e.g. "Archive Overdraft Hoodie").
- Status is text (`StatusBadge` shows the word, with colour only as an extra).
- Focus outlines stay visible.
- There's no drag and drop, and confirmations are keyboard-operable (D5).

### D12. Testing

- **Admin unit tests** (Vitest, Node): `catalogAccess`, `visibleNav` (with the catalog entries), `lifecycle.ts`, `list-query.ts`, `problem.ts` (each status and code mapping), and the money helpers (`parseMajorAmount`, `formatMoney`, both in contracts).
  - The two permission scenarios that no real role can reach ("Read-only catalog view", "Catalog page without catalog read permission") are tested here, against the access helper and the page-guard decision.
- **API integration tests:** for the new `product-management` scenarios (the stock summary and the store currency setting) and the route-coverage table.
- **Admin Playwright E2E** (the existing stack: built admin, real API, fresh `ite_e2e`), with one test per UI scenario, titled after it:
  - Test data is set up through the API using the signed-in owner's session (Playwright `request`), except the end-to-end workflow scenario, which uses only the UI.
  - Progress, `403`, `500`, and expired-session scenarios use `page.route` to delay or fulfill the browser's mutation request to `/api/v1/admin/...`. Server-side reads aren't affected.
  - Axe scans use `@axe-core/playwright`, the version the storefront already uses, added to the admin's dev dependencies.
- **Spec coverage:** while active, CI's coverage step names `admin-product-management`. After archive, it names the new main specs (`specs/admin-catalog-ui`, `specs/admin-catalog-reference-data`, `specs/admin-products`); `specs/product-management` is already listed.

## Risks / Trade-offs

- [The read-only path can't be exercised end to end, because every real role has `catalog:manage`] → Unit tests on the access helper and the page guard. The API independently refuses unauthorized writes, and that's already covered by product-domain tests.
- [`ProductListItem` is a strict schema; adding `stock` changes its shape] → It's additive, and both producer and consumer are in this repo and change together. The storefront doesn't consume admin list items.
- [E2E runtime grows with about 40 UI scenarios] → Data is set up through the API, not the UI. Tests stay serial, as today, on one database with unique names per test. Only the workflow scenario drives everything through the UI.
- [Plain `<img>` previews load arbitrary admin-entered URLs in staff browsers] → Only staff can add them, the URLs are restricted to `https://` or root-relative paths by the contract, and `next/image` optimization stays deferred. Images are displayed only, never fetched by the server.
- [Moving money helpers into contracts touches the storefront] → It re-exports the same functions, and its existing unit and E2E tests must stay green unchanged.
- [`router.refresh()` re-renders the whole product page after each change] → Acceptable for staff-scale data. It's the same pattern as the staff page, and keeps the screen consistent with the API.

## Migration Plan

- **No database changes.**
- **Deploy order:**
  1. The API: the settings route and list stock summary are additive, so older admin builds keep working.
  2. The admin.
- **Rollback:** revert the admin first, then the API if needed.
- **After archive:** CI's spec-coverage targets switch from the change name to its main specs.
