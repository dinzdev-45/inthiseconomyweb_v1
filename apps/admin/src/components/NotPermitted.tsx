import Link from 'next/link';

/** Shown when a staff member opens a page their role does not allow. No protected data is loaded. */
export function NotPermitted() {
  return (
    <section className="space-y-3">
      <h1 className="text-xl font-semibold">Not permitted</h1>
      <p className="text-muted">Your role does not have access to this page.</p>
      <Link href="/" className="text-sm underline">
        Back to dashboard
      </Link>
    </section>
  );
}
