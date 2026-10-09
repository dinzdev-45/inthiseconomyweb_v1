import Link from 'next/link';

export default function DropNotFound() {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Drop not found</h1>
      <p className="text-muted">No drop exists at this address. It may have been deleted.</p>
      <Link href="/catalog/drops" className="text-sm underline">
        Back to drops
      </Link>
    </section>
  );
}
