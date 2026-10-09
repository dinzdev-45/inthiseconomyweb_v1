import type { Metadata } from 'next';
import { connection } from 'next/server';

import { DropsView } from '@/features/drops';
import { getDropsOverview } from '@/features/drops/server/drops';

export const metadata: Metadata = {
  title: 'Drops',
  description: 'InThisEconomy drops: what’s next, what’s live, and what came before.',
  alternates: { canonical: '/drops' },
};

/** The next drop with its countdown, or the current one; at most 60 seconds stale. */
export default async function DropsPage() {
  // Rendered per request (data cached for 60 s), so builds never call the API.
  await connection();
  return <DropsView overview={await getDropsOverview()} />;
}
