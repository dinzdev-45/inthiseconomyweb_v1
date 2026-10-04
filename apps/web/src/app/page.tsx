import type { Metadata } from 'next';

import { getHomeContent, HomeSections } from '@/features/home';

export const metadata: Metadata = {
  title: { absolute: 'InThisEconomy — Collection 001: Cost of Living' },
  description: 'Clothing for the world we’re living in. Collection 001, Cost of Living.',
};

/**
 * Homepage. Statically rendered from getHomeContent(), the single data seam:
 * it makes no API calls, so the page renders even when the API is down.
 */
export default async function HomePage() {
  const content = await getHomeContent();
  return <HomeSections content={content} />;
}
