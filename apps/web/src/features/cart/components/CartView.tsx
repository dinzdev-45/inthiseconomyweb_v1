import { CART_QUANTITY_MAX } from '@ite/contracts';
import Link from 'next/link';

import { cta } from '@/components/cta';
import { FallbackImage } from '@/components/FallbackImage';
import { formatMoney } from '@/lib/format-money';

import { removeLine, updateLine } from '../actions.ts';
import { CART_STATUS_MESSAGES, type CartStatus } from '../outcome.ts';
import type { CartLineView, CartViewModel } from '../types.ts';

const QUANTITIES = Array.from({ length: CART_QUANTITY_MAX }, (_, i) => i + 1);
const LINE_NOTES: Record<Exclude<CartLineView['status'], 'AVAILABLE'>, string> = {
  UNAVAILABLE: 'No longer available. Remove it to continue.',
  INSUFFICIENT_STOCK: 'Not enough stock for this quantity. Lower it to continue.',
};

type CartViewProps = {
  /** null when there is no cart. */
  cart: CartViewModel | null;
  /** The line just added (from `added`), for the confirmation. */
  addedLineId?: string;
  /** The outcome of the last change (from `status`). */
  status?: CartStatus;
};

/** The cart page (storefront-cart spec). Every control is a plain form posting to a Server Action. */
export function CartView({ cart, addedLineId, status }: CartViewProps) {
  const lines = cart?.lines ?? [];
  const added = lines.find((line) => line.id === addedLineId);
  const message = added
    ? `Added ${added.name} (${added.colorName}, ${added.sizeCode}) to your cart.`
    : status
      ? CART_STATUS_MESSAGES[status]
      : null;

  return (
    <section className="mx-auto max-w-[1100px] px-4 py-10 md:px-8 md:py-16">
      <h1 className="text-title font-black uppercase font-stretch-expanded">Cart</h1>
      {/* Always present, so changes are announced politely. */}
      <p role="status" className="mt-4 min-h-6 text-sm" data-cart-message>
        {message}
      </p>

      {lines.length === 0 ? (
        <div className="mt-6" data-state="empty">
          <p className="text-stone">Your cart is empty.</p>
          <Link href="/shop" className={`mt-8 ${cta.outline}`}>
            Browse the shop
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-line border-y border-line">
            {lines.map((line) => (
              <CartLine key={line.id} line={line} />
            ))}
          </ul>
          <div className="mt-8 flex flex-col items-end gap-2">
            <p className="flex gap-6 text-lg font-semibold tabular-nums" data-subtotal>
              <span>Subtotal</span>
              <span>{formatMoney(cart!.subtotal)}</span>
            </p>
            <p className="text-sm text-stone">Checkout is coming soon.</p>
          </div>
        </>
      )}
    </section>
  );
}

function CartLine({ line }: { line: CartLineView }) {
  const what = `${line.name}, ${line.colorName}, ${line.sizeCode}`;
  return (
    <li
      className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 py-6 sm:grid-cols-[8rem_minmax(0,1fr)]"
      data-line-status={line.status}
    >
      <Link href={line.href} tabIndex={-1} aria-hidden="true">
        <FallbackImage image={line.image} ratio={4 / 5} sizes="8rem" />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h2 className="min-w-0 text-sm font-semibold uppercase break-words">
            <Link href={line.href} className="hover:underline">
              {line.name}
            </Link>
          </h2>
          <p className="text-sm font-semibold tabular-nums" data-line-total>
            {formatMoney(line.lineTotal)}
          </p>
        </div>
        <p className="mt-1 text-sm text-ink/70">
          {line.colorName} · {line.sizeCode} · {formatMoney(line.unitPrice)} each
        </p>
        {line.status !== 'AVAILABLE' ? (
          <p className="mt-2 text-sm font-semibold text-danger" data-line-note>
            {LINE_NOTES[line.status]}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={updateLine} className="flex items-end gap-2">
            <input type="hidden" name="lineId" value={line.id} />
            <div>
              <label htmlFor={`quantity-${line.id}`} className="block text-label uppercase">
                <span className="sr-only">Quantity for {what}</span>
                <span aria-hidden="true">Qty</span>
              </label>
              <select
                id={`quantity-${line.id}`}
                name="quantity"
                defaultValue={line.quantity}
                className="mt-1 block border border-ink/40 bg-paper px-3 py-2 text-sm"
              >
                {QUANTITIES.map((quantity) => (
                  <option key={quantity} value={quantity}>
                    {quantity}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              aria-label={`Update quantity for ${what}`}
              className="border border-ink px-4 py-2 text-label uppercase hover:bg-ink hover:text-paper"
            >
              Update
            </button>
          </form>
          <form action={removeLine}>
            <input type="hidden" name="lineId" value={line.id} />
            <button
              type="submit"
              aria-label={`Remove ${what}`}
              className="px-2 py-2 text-sm underline underline-offset-4"
            >
              Remove
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}
