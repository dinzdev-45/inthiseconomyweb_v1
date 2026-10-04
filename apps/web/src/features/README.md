# Storefront features

Each customer-facing capability gets its own folder here, named after its
OpenSpec capability (for example `catalog/`, `drops/`, `lookbook/`, `cart/`,
`checkout/`). Routes in `src/app/` stay thin and compose features.

```
src/features/<feature>/
  components/   React components for this feature (Server Components by default;
                add 'use client' only where interactivity needs it)
  server/       data loading for this feature, built on src/lib/api/store.ts
                (server-only: imports 'server-only', never imported by client code)
  actions.ts    Server Actions for this feature's mutations (e.g. cart), if any
  index.ts      the feature's public exports used by src/app/
```

Rules:

- Request and response shapes come from `@ite/contracts`; do not redefine them.
- All API access goes through `storeGet` (and future helpers) in
  `src/lib/api/store.ts`. The browser never calls the API directly.
- Features do not import from each other's internals. Share code through
  `src/lib/` or a workspace package.
- There are no customer accounts: nothing here may require sign-in, and guest
  checkout carries its own state.
