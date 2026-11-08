import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/require-admin";
import { Dashboard, type DashboardParams } from "@/components/dashboard";

export const metadata: Metadata = { title: "Inicio" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<DashboardParams> }) {
  const admin = await requirePermission("inicio.read");
  return <Dashboard admin={admin} params={await searchParams} />;
}
