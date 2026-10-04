/**
 * The InThisEconomy wordmark: heavy, uppercase Archivo in Brand Brown, expanded
 * by default. It is a logotype, so it is exposed as an image of text named
 * "InThisEconomy" (WCAG exempts logotypes from text-contrast minimums); the
 * visible letters are hidden from assistive technology. `className` replaces the
 * width/size defaults (e.g. a narrower cut on small screens).
 */
export function Wordmark({ className = 'font-stretch-expanded' }: { className?: string }) {
  return (
    <span
      role="img"
      data-logotype
      aria-label="InThisEconomy"
      className={`font-black whitespace-nowrap text-brand uppercase tracking-tight ${className}`.trim()}
    >
      <span aria-hidden="true">InThisEconomy</span>
    </span>
  );
}
