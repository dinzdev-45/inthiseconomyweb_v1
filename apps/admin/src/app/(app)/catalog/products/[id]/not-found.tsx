import Link from 'next/link';

export default function ProductNotFound() {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Product not found</h1>
      <p className="text-muted">No product exists at this address. It may have been mistyped.</p>
      <Link href="/catalog/products" className="text-sm underline">
        Back to products
      </Link>
    </section>
  );
}
