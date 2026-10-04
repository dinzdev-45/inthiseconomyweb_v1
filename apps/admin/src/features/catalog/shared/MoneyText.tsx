import { formatMoney, type Money } from '@ite/contracts';

/** A price for display, in its own currency (e.g. Rp 899.000). */
export function MoneyText({ value }: { value: Money }) {
  return <span className="tabular-nums">{formatMoney(value)}</span>;
}
