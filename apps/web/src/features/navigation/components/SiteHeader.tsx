import Link from 'next/link';
import { Suspense } from 'react';

import { Wordmark } from '@/components/Wordmark';

import { PRIMARY_LINKS, UTILITY_LINKS } from '../nav-links.ts';
import { CartLinkContent, CartLinkLabel } from './CartLinkLabel.tsx';
import { BagIcon, SearchIcon } from './icons.tsx';
import { MobileMenu } from './MobileMenu.tsx';

const UTILITY_ICONS: Record<string, () => React.JSX.Element> = {
  Search: SearchIcon,
  Cart: BagIcon,
};

const linkStyle =
  'text-label uppercase underline-offset-[6px] decoration-brand decoration-2 hover:underline focus-visible:underline aria-[current=page]:underline';

/**
 * Sticky, solid storefront header (design D4). Server Component; only the
 * mobile menu below 768 px is interactive.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 h-header border-b border-line bg-paper">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-4 px-4 md:px-8 lg:gap-6">
        {/* Narrower, smaller cut below 1024 px so the header fits from 320 px up. */}
        <Link href="/" className="min-w-0 text-[0.9375rem] leading-none md:text-base lg:text-xl">
          <Wordmark className="font-stretch-normal lg:font-stretch-expanded" />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-5 lg:gap-8">
            {PRIMARY_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkStyle}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-0 md:gap-5 lg:gap-8">
          <nav aria-label="Utility">
            <ul className="flex items-center gap-0 md:gap-5 lg:gap-8">
              {UTILITY_LINKS.map((link) => {
                const Icon = UTILITY_ICONS[link.label];
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={`${linkStyle} inline-flex min-h-11 min-w-11 items-center justify-center md:min-h-0 md:min-w-0`}
                    >
                      {link.href === '/cart' ? (
                        // The item count reads search params, which static pages provide on the
                        // client; until then (and without a count) it is the plain link.
                        <Suspense
                          fallback={
                            <CartLinkContent label={link.label} icon={Icon ? <Icon /> : null} />
                          }
                        >
                          <CartLinkLabel label={link.label} icon={Icon ? <Icon /> : null} />
                        </Suspense>
                      ) : (
                        <>
                          {Icon ? (
                            <span className="md:hidden">
                              <Icon />
                            </span>
                          ) : null}
                          <span className="sr-only md:not-sr-only">{link.label}</span>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
