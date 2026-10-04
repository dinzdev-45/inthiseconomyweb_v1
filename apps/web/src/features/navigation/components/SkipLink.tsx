/** First focusable element on every page; visible only while focused. Targets <main id="main">. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:text-label focus:text-paper focus:uppercase"
    >
      Skip to content
    </a>
  );
}
