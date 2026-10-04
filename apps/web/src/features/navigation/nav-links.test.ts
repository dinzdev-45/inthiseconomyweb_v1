import { describe, expect, it } from 'vitest';

import { FOOTER_GROUPS, PRIMARY_LINKS, SOCIAL_LINKS, UTILITY_LINKS } from './nav-links.ts';

const ACCOUNT_WORDS = /account|log ?in|sign ?in|register|wishlist|profile/i;
const all = [
  ...PRIMARY_LINKS,
  ...UTILITY_LINKS,
  ...FOOTER_GROUPS.flatMap((g) => g.links),
  ...SOCIAL_LINKS,
];

describe('navigation links', () => {
  it('lists the header links in spec order', () => {
    expect([...PRIMARY_LINKS, ...UTILITY_LINKS]).toEqual([
      { label: 'Shop', href: '/shop' },
      { label: 'New Drop', href: '/drops' },
      { label: 'Lookbook', href: '/lookbook' },
      { label: 'Story', href: '/story' },
      { label: 'Search', href: '/search' },
      { label: 'Cart', href: '/cart' },
    ]);
  });

  it('contains every footer destination from the spec', () => {
    const footer = Object.fromEntries(
      FOOTER_GROUPS.flatMap((g) => g.links).map((l) => [l.label, l.href]),
    );
    expect(footer).toEqual({
      Shop: '/shop',
      'New Drop': '/drops',
      Lookbook: '/lookbook',
      Archive: '/drops/archive',
      'Our Story': '/story',
      'Size Guide': '/size-guide',
      Shipping: '/shipping',
      Returns: '/returns',
      FAQ: '/faq',
      Contact: '/contact',
      'Order Tracking': '/track-order',
    });
  });

  it('links Instagram and TikTok externally over https', () => {
    expect(SOCIAL_LINKS.map((l) => l.label)).toEqual(['Instagram', 'TikTok']);
    for (const link of SOCIAL_LINKS) expect(link.href).toMatch(/^https:\/\//);
  });

  it('has no account, sign-in, register, or wishlist entries', () => {
    for (const link of all) {
      expect(link.label).not.toMatch(ACCOUNT_WORDS);
      expect(link.href).not.toMatch(ACCOUNT_WORDS);
    }
  });

  it('uses internal paths for everything except social links', () => {
    for (const link of [
      ...PRIMARY_LINKS,
      ...UTILITY_LINKS,
      ...FOOTER_GROUPS.flatMap((g) => g.links),
    ]) {
      expect(link.href).toMatch(/^\/[a-z0-9/-]*$/);
    }
  });
});
