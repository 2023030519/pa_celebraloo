import { requirePermission } from "@/lib/auth/require-admin";
import { SuperEventsList } from "@/components/super-events-list";

type Search = { q?: string; estado?: string; staff?: string; pagina?: string };

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("eventos.read");
  return <SuperEventsList params={await searchParams} />;
}
