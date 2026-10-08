import Link from 'next/link';

import type { ColorOption } from '../selection.ts';

/** The product's colors as links in a labelled group; the selection is announced (design D4). */
export function ColorOptions({
  colors,
  selected,
}: {
  colors: ColorOption[];
  selected: ColorOption;
}) {
  return (
    <section aria-labelledby="color-heading" className="mt-8">
      <h2 id="color-heading" className="text-label uppercase">
        Color: <span className="normal-case">{selected.name}</span>
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {colors.map((color) => (
          <li key={color.slug}>
            <Link
              href={color.href}
              scroll={false}
              aria-current={color.state === 'selected' ? 'true' : undefined}
              className={`inline-flex items-center gap-2 border px-3 py-2 text-sm ${
                color.state === 'selected'
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/30 hover:border-ink'
              }`}
            >
              <span
                aria-hidden="true"
                className="size-4 shrink-0 rounded-full border border-ink/20"
                style={{ backgroundColor: color.hex ?? 'transparent' }}
              />
              {color.name}
              {color.soldOut ? <span className="text-label uppercase">Sold out</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
