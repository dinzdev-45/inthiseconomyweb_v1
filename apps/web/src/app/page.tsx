import type { Metadata } from 'next';

import { getHomeContent, HomeSections } from '@/features/home';

/** Regenerated at most every 5 minutes, so drop changes appear without a deploy. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: 'InThisEconomy — Collection 001: Cost of Living' },
  description: 'Clothing for the world we’re living in. Collection 001, Cost of Living.',
};

/**
 * Homepage. Statically rendered from getHomeContent(), the single data seam: only generating
 * the page reads the API (for the featured drop), so visits never wait on it, and the page
 * renders without the drop section when the API is down.
 */
export default async function HomePage() {
  const content = await getHomeContent();
  return <HomeSections content={content} />;
}
