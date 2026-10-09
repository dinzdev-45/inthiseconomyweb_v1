import type { CheckoutSummary } from '@ite/contracts';

import { formatMoney } from '@/lib/format-money';

/** The order summary next to the checkout form: lines, subtotal, shipping fee, and total. */
export function OrderSummary({ summary }: { summary: CheckoutSummary }) {
  return (
    <aside aria-labelledby="summary-heading" className="border border-line p-5" data-summary>
      <h2 id="summary-heading" className="text-label uppercase">
        Order summary
      </h2>
      <ul className="mt-4 divide-y divide-line">
        {summary.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-4 py-3 text-sm">
            <span className="min-w-0 break-words">
              <span className="font-semibold">{line.product.name}</span>
              <span className="block text-ink/70">
                {line.color.name} · {line.size.code} · Qty {line.quantity}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatMoney(line.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm tabular-nums">
        <div className="flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd>{formatMoney(summary.subtotal)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Shipping</dt>
          <dd data-shipping>
            {summary.shippingFee.amount === 0 ? 'Free' : formatMoney(summary.shippingFee)}
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-base font-semibold">
          <dt>Total</dt>
          <dd data-total>{formatMoney(summary.total)}</dd>
        </div>
      </dl>
    </aside>
  );
}
