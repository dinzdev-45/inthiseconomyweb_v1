/** Minimal stroke icons for the header. Decorative: links carry text labels. */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  'aria-hidden': true,
  focusable: false,
} as const;

export function SearchIcon() {
  return (
    <svg {...base}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" strokeLinecap="square" />
    </svg>
  );
}

export function BagIcon() {
  return (
    <svg {...base}>
      <path d="M4.5 8h15l-1.2 12.5H5.7L4.5 8Z" />
      <path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg {...base}>
      <path d="M3 8h18M3 16h18" strokeLinecap="square" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...base}>
      <path d="m5 5 14 14M19 5 5 19" strokeLinecap="square" />
    </svg>
  );
}
