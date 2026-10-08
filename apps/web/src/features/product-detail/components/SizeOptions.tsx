import Link from 'next/link';

import type { SizeOption } from '../selection.ts';

const box = 'inline-flex min-w-14 flex-col items-center justify-center border px-3 py-2 text-sm';

/**
 * The product's sizes for the selected color (design D4): links for sizes that exist (sold-out
 * ones say so in text and stay selectable), plain text for sizes that do not exist in the color.
 */
export function SizeOptions({
  sizes,
  selected,
  colorName,
}: {
  sizes: SizeOption[];
  selected: SizeOption | null;
  colorName: string;
}) {
  return (
    <section aria-labelledby="size-heading" className="mt-8">
      <h2 id="size-heading" className="text-label uppercase">
        Size
        {selected ? (
          <>
            : <span>{selected.code}</span>
          </>
        ) : null}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {sizes.map((size) =>
          size.href === null ? (
            <li key={size.code} data-size={size.code} data-state="unavailable">
              <span className={`${box} border-ink/15 text-stone line-through`}>
                {size.code}
                <span className="sr-only">, not available in {colorName}</span>
              </span>
            </li>
          ) : (
            <li key={size.code} data-size={size.code} data-state={size.state}>
              <Link
                href={size.href}
                scroll={false}
                aria-current={size.state === 'selected' ? 'true' : undefined}
                className={`${box} ${
                  size.state === 'selected'
                    ? 'border-ink bg-ink text-paper'
                    : 'border-ink/30 hover:border-ink'
                }`}
              >
                <span>{size.code}</span>
                {size.soldOut ? <span className="text-[0.625rem] uppercase">Sold out</span> : null}
              </Link>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
