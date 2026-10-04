/**
 * Call-to-action styles (storefront-homepage design D3), shared by links and buttons.
 * - primary: Brand Brown with a warm white 19 px bold label. That is large text, so its
 *   4.20:1 contrast meets AA; hover deepens to Dark Brown (7.40:1).
 * - outline: secondary actions on light surfaces.
 * - inverse: cream with a Near Black label, for Brand Brown or Near Black surfaces.
 */
const base = 'inline-block uppercase transition-colors';

export const cta = {
  primary: `${base} bg-brand px-7 py-4 text-[1.1875rem] leading-none font-bold tracking-[0.04em] text-paper hover:bg-brand-dark`,
  outline: `${base} border border-ink px-6 py-4 text-label text-ink hover:bg-ink hover:text-paper`,
  inverse: `${base} bg-cream px-6 py-4 text-label font-semibold text-ink hover:bg-paper focus-visible:outline-cream`,
} as const;
