/** "30 products", announced politely after filtering (a status live region). */
export function ResultCount({ count }: { count: number }) {
  return (
    <p role="status" className="text-sm text-stone tabular-nums" data-result-count>
      {count === 1 ? '1 product' : `${count} products`}
    </p>
  );
}
