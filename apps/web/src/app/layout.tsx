import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { NewsletterForm } from '@/features/home';
import { SiteFooter, SiteHeader, SkipLink } from '@/features/navigation';

import { archivo } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'InThisEconomy', template: '%s · InThisEconomy' },
  description: 'Fashion from InThisEconomy.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <SkipLink />
        <SiteHeader />
        {/* tabIndex -1 lets the skip link move focus here; main itself is not a tab stop. */}
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter
          newsletter={
            <>
              <p className="mb-4 text-label text-sand uppercase">Newsletter</p>
              <NewsletterForm label="Footer newsletter sign-up" tone="dark" />
            </>
          }
        />
      </body>
    </html>
  );
}
