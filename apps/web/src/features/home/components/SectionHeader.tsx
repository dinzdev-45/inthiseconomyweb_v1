import Link from 'next/link';

import type { Link as LinkData } from '../types.ts';

/** Section h2 with an optional trailing link, on a hairline rule. */
export function SectionHeader({ id, title, link }: { id: string; title: string; link?: LinkData }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-t border-brand pt-6 md:mb-12">
      <h2 id={id} className="text-title font-black uppercase font-stretch-expanded">
        {title}
      </h2>
      {link ? (
        <Link
          href={link.href}
          className="shrink-0 text-label uppercase underline decoration-brand decoration-2 underline-offset-[6px] hover:no-underline"
        >
          {link.label}
        </Link>
      ) : null}
    </div>
  );
}
