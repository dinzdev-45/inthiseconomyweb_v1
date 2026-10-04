import { Archivo } from 'next/font/google';

/**
 * Storefront typeface (storefront-homepage design D3): Archivo as one variable
 * font with weight and width axes, so headlines can use the expanded width
 * (font-stretch up to 125%) without a second family. Loaded via
 * next/font/google with display: swap; next/font also generates a
 * metric-adjusted fallback face to limit layout shift while it loads.
 */
export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});
