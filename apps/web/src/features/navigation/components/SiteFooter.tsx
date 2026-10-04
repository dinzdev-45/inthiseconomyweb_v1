import Link from 'next/link';
import type { ReactNode } from 'react';

import { Wordmark } from '@/components/Wordmark';

import { FOOTER_GROUPS, SOCIAL_LINKS } from '../nav-links.ts';

const linkStyle =
  'underline-offset-4 decoration-brand decoration-2 hover:underline focus-visible:underline';

/**
 * Storefront footer (spec: Storefront footer) on Near Black: cream links (15.2:1),
 * Sand headings (9.47:1), and the Brand Brown wordmark. `newsletter` is a slot for the
 * frontend-only newsletter form (storefront-homepage task 5.3); nothing is
 * rendered there until that form exists.
 */
export function SiteFooter({ newsletter }: { newsletter?: ReactNode }) {
  return (
    <footer className="bg-ink text-cream">
      <div className="mx-auto grid max-w-[1600px] gap-12 px-4 py-16 md:grid-cols-12 md:px-8 md:py-24">
        {newsletter ? <div className="min-w-0 md:col-span-5">{newsletter}</div> : null}

        <nav
          aria-label="Footer"
          className={`grid grid-cols-2 gap-10 sm:grid-cols-4 ${newsletter ? 'md:col-span-7' : 'md:col-span-12'}`}
        >
          {FOOTER_GROUPS.map((group) => (
            <section key={group.heading} aria-labelledby={`footer-${group.heading}`}>
              <h2 id={`footer-${group.heading}`} className="mb-4 text-label text-sand uppercase">
                {group.heading}
              </h2>
              <ul className="space-y-2 text-sm">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className={linkStyle}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section aria-labelledby="footer-follow">
            <h2 id="footer-follow" className="mb-4 text-label text-sand uppercase">
              Follow
            </h2>
            <ul className="space-y-2 text-sm">
              {SOCIAL_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkStyle}
                  >
                    {link.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </nav>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-wrap items-end justify-between gap-6 border-t border-stone px-4 py-8 md:px-8">
        <p aria-hidden="true" className="text-[clamp(1.25rem,7.4vw,8rem)] leading-[0.85]">
          <Wordmark />
        </p>
        <p className="text-label text-sand uppercase">© {new Date().getFullYear()} InThisEconomy</p>
      </div>
    </footer>
  );
}
