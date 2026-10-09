import type { Media } from '../catalog/types.ts';

/** A drop as presented on the storefront (view model; see catalog/types.ts). */
export type DropSummary = {
  slug: string;
  /** e.g. "COLLECTION 001" */
  collection: string;
  /** e.g. "COST OF LIVING" */
  title: string;
  /** `past`: released before the current drop (the archive). */
  status: 'live' | 'upcoming' | 'past';
  /** Release time as an ISO 8601 UTC timestamp; drives the upcoming state and a future countdown. */
  startsAt: string;
  image: Media | null;
};
