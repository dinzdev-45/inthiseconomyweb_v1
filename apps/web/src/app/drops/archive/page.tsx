import type { Metadata } from 'next';
import { connection } from 'next/server';

import { ArchiveView } from '@/features/drops';
import { getDropsOverview } from '@/features/drops/server/drops';

export const metadata: Metadata = {
  title: 'Drop archive',
  description: 'Earlier InThisEconomy drops.',
  alternates: { canonical: '/drops/archive' },
};

export default async function DropArchivePage() {
  // Rendered per request (data cached for 60 s), so builds never call the API.
  await connection();
  return <ArchiveView drops={(await getDropsOverview()).archive} />;
}
