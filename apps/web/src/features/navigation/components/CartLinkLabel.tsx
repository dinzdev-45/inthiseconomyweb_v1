'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/** The storefront route that reports the cart's item count (never the API itself). */
export const CART_COUNT_PATH = '/cart/count';

/** The Cart link's contents without a count: the static fallback, and the empty-cart state. */
export function CartLinkContent({
  label,
  icon,
  count = null,
}: {
  label: string;
  icon?: ReactNode;
  count?: number | null;
}) {
  return (
    <>
      {icon ? <span className="md:hidden">{icon}</span> : null}
      {/* The suffix sits inside the label's span, so the link is named "Cart, 2 items". */}
      <span className="sr-only md:not-sr-only">
        {label}
        {count ? (
          <span className="sr-only">, {count === 1 ? '1 item' : `${count} items`}</span>
        ) : null}
      </span>
      {count ? (
        <span
          aria-hidden="true"
          data-cart-count
          className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-ink px-1.5 text-[0.6875rem] leading-5 font-semibold text-paper tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </>
  );
}

/**
 * The Cart link's contents with the cart's item count (storefront-cart spec, guest-cart design
 * D6). The count loads in the browser so pages stay statically rendered, and is refetched on every
 * navigation (cart actions end in one). With an empty cart, or when the count cannot be loaded,
 * it is a plain link.
 */
export function CartLinkLabel({ label, icon }: { label: string; icon?: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch(CART_COUNT_PATH, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { count?: unknown } | null) => {
        if (active) setCount(typeof body?.count === 'number' ? body.count : null);
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, [pathname, search]);

  return <CartLinkContent label={label} icon={icon} count={count} />;
}
