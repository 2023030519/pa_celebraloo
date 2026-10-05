import { LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { NavLinks } from "@/components/nav-links";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[210px_1fr] lg:grid-cols-[230px_1fr]">
      <aside className="flex flex-col gap-3 border-b border-ink-150 bg-surface p-3 md:sticky md:top-0 md:h-dvh md:gap-4 md:overflow-y-auto md:border-r md:border-b-0 md:p-4">
        <div className="flex items-center justify-between gap-3 md:block">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-800">Celebraloo</p>
            <p className="text-base font-semibold">{admin.isSuperAdmin ? "Administración" : "Admin"}</p>
          </div>
          {/* En móvil, salir queda arriba a la derecha; en computadora, al pie. */}
          <form action="/auth/signout" method="post" className="md:hidden">
            <button className="flex items-center gap-1.5 text-xs font-semibold text-ink-800 hover:text-danger-700">
              <LogOut size={14} aria-hidden="true" />
              Salir
            </button>
          </form>
        </div>
        <NavLinks isSuperAdmin={admin.isSuperAdmin} />
        <div className="hidden border-t border-ink-150 pt-3 md:mt-auto md:block">
          <p className="truncate text-xs text-ink-600" title={admin.email}>
            {admin.email}
          </p>
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="flex items-center gap-2 text-xs font-semibold text-ink-800 hover:text-danger-700">
              <LogOut size={14} aria-hidden="true" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}
