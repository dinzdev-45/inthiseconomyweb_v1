'use client';

import { CatalogUnavailable } from '@/features/catalog';

/** The catalog API failed or is unreachable: a friendly message, never error details. */
export default function SearchError() {
  return <CatalogUnavailable />;
}
