'use client';

import { DropsUnavailable } from '@/features/drops';

/** The drops API failed or is unreachable: a friendly message, never error details. */
export default function DropsError() {
  return <DropsUnavailable />;
}
