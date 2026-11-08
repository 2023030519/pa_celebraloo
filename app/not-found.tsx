import type { Metadata } from "next";
import Link from "next/link";
import { cn, ui } from "@/components/ui";

export const metadata: Metadata = { title: "No disponible" };

/** 404 propio: también lo usa el proxy cuando el rol no tiene acceso a una sección. */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-4">
      <div className="max-w-sm rounded-lg border border-ink-150 bg-surface p-6">
        <h1 className="text-xl font-semibold text-ink-950">Página no disponible</h1>
        <p className="mt-2 text-sm text-ink-600">Esta página no existe o tu rol no tiene acceso a ella.</p>
        <Link href="/" className={cn(ui.buttonPrimary, "mt-4")}>
          Ir a Inicio
        </Link>
      </div>
    </main>
  );
}
