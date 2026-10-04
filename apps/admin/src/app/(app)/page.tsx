import { getCurrentStaff } from '@/lib/session';

export default async function DashboardPage() {
  const staff = await getCurrentStaff();
  return (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="text-muted">Signed in as {staff.email}.</p>
    </section>
  );
}
