import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require-admin";
import { SuperEventsList } from "@/components/super-events-list";

export const metadata: Metadata = { title: "Eventos" };

type Search = { q?: string; estado?: string; staff?: string; pagina?: string; borrado?: string };

export default async function EventsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("eventos.read");
  return <SuperEventsList params={await searchParams} />;
}
