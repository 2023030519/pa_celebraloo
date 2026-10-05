import { requirePermission } from "@/lib/auth/require-admin";
import { SuperActivity } from "@/components/super-activity";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ antes?: string; tipo?: string }> }) {
  await requirePermission("actividad.read");
  return <SuperActivity params={await searchParams} />;
}
