import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require-admin";
import { SuperActivity } from "@/components/super-activity";

export const metadata: Metadata = { title: "Actividad" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ antes?: string; id?: string; tipo?: string }> }) {
  await requirePermission("actividad.read");
  return <SuperActivity params={await searchParams} />;
}
