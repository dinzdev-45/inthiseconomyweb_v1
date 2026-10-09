import type { StoreOrder } from '@ite/contracts';
import Link from 'next/link';

import { formatMoney } from '@/lib/format-money';

/** The payment deadline in Western Indonesian Time, e.g. "9 October 2026 at 12:00 WIB". */
export function formatDeadline(iso: string): string {
  const text = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));
  return `${text} WIB`;
}

/** The guest order page (storefront-checkout spec): status, lines, totals, delivery details. */
export function OrderView({ order }: { order: StoreOrder }) {
  const { delivery, contact } = order;
  return (
    <section className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
      <p className="text-label text-stone uppercase">Order</p>
      <h1 className="mt-2 text-title font-black uppercase font-stretch-expanded break-words">
        {order.number}
      </h1>

      <div className="mt-6 border-l-2 border-brand pl-4" data-order-status={order.status}>
        {order.status === 'AWAITING_PAYMENT' ? (
          <>
            <p className="font-semibold">Awaiting payment</p>
            <p className="mt-1 text-sm">
              Pay by {formatDeadline(order.paymentDeadline)}, or the order will be cancelled. Online
              payment is coming next; keep this page’s link to come back to your order.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold">Expired</p>
            <p className="mt-1 text-sm">
              This order wasn’t paid in time, so it was cancelled and its items went back on sale.
            </p>
          </>
        )}
      </div>

      <h2 className="mt-10 text-label uppercase">Items</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {order.lines.map((line, index) => (
          <li key={index} className="flex justify-between gap-4 py-4 text-sm">
            <span className="min-w-0 break-words">
              <Link
                href={`/products/${line.productSlug}`}
                className="font-semibold hover:underline"
              >
                {line.productName}
              </Link>
              <span className="block text-ink/70">
                {line.colorName} · {line.sizeCode} · {line.quantity} × {formatMoney(line.unitPrice)}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatMoney(line.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 ml-auto max-w-xs space-y-2 text-sm tabular-nums">
        <div className="flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd>{formatMoney(order.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Shipping</dt>
          <dd>{order.shippingFee.amount === 0 ? 'Free' : formatMoney(order.shippingFee)}</dd>
        </div>
        <div className="flex justify-between gap-4 text-base font-semibold">
          <dt>Total</dt>
          <dd data-order-total>{formatMoney(order.total)}</dd>
        </div>
      </dl>

      <h2 className="mt-10 text-label uppercase">Delivery</h2>
      <address className="mt-3 text-sm not-italic break-words" data-delivery>
        {contact.name}
        <br />
        {delivery.line1}
        {delivery.line2 ? (
          <>
            <br />
            {delivery.line2}
          </>
        ) : null}
        <br />
        {delivery.city}, {delivery.province.name} {delivery.postalCode}
        <br />
        {contact.phone} · {contact.email}
      </address>
      {order.note ? <p className="mt-3 text-sm text-ink/70">Note: {order.note}</p> : null}
    </section>
  );
}
