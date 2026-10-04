/**
 * The storefront's only source of navigation links (storefront-homepage design D4).
 * Header, mobile menu, and footer all read from here, so they cannot drift apart.
 * There are deliberately no account, sign-in, register, or wishlist entries:
 * customers never have accounts.
 */

export type NavLink = { label: string; href: string };
export type ExternalLink = NavLink & { external: true };
export type FooterGroup = { heading: string; links: NavLink[] };

/** Header (≥ 768 px) and mobile menu, in display order. */
export const PRIMARY_LINKS: readonly NavLink[] = [
  { label: 'Shop', href: '/shop' },
  { label: 'New Drop', href: '/drops' },
  { label: 'Lookbook', href: '/lookbook' },
  { label: 'Story', href: '/story' },
];

/** Always visible in the header (icons below 768 px). Cart has no count until a cart exists. */
export const UTILITY_LINKS: readonly NavLink[] = [
  { label: 'Search', href: '/search' },
  { label: 'Cart', href: '/cart' },
];

export const FOOTER_GROUPS: readonly FooterGroup[] = [
  {
    heading: 'Shop',
    links: [
      { label: 'Shop', href: '/shop' },
      { label: 'New Drop', href: '/drops' },
      { label: 'Lookbook', href: '/lookbook' },
      { label: 'Archive', href: '/drops/archive' },
    ],
  },
  {
    heading: 'Help',
    links: [
      { label: 'Size Guide', href: '/size-guide' },
      { label: 'Shipping', href: '/shipping' },
      { label: 'Returns', href: '/returns' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Order Tracking', href: '/track-order' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Our Story', href: '/story' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

/** Placeholder profile URLs until the brand's handles are confirmed (design: Open Questions). */
export const SOCIAL_LINKS: readonly ExternalLink[] = [
  { label: 'Instagram', href: 'https://www.instagram.com/', external: true },
  { label: 'TikTok', href: 'https://www.tiktok.com/', external: true },
];
