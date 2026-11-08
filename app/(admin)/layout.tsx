import { LogOut } from "lucide-react";
import { can, requireAdmin } from "@/lib/auth/require-admin";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getAlertCounts } from "@/lib/data/admin";
import { AreaName, BottomTabs, NavLinks } from "@/components/nav-links";
import { BrandMark } from "@/components/ui";

function Brand({ role }: { role: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark />
      <div className="min-w-0">
        <p className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-white">Celebraloo</p>
        <p className="text-xs text-nav-muted">{role}</p>
      </div>
    </div>
  );
}

function SignOut({ label }: { label: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button className="flex h-8 items-center gap-2 rounded-md px-2 text-xs font-medium text-nav-fg hover:bg-nav-hover hover:text-white">
        <LogOut size={14} aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const role = ROLE_LABELS[admin.role];
  const permissions = [...admin.permissions];
  // Conteo de la pestaña Alertas (M1); si la consulta falla, la pestaña va sin conteo.
  const alertCount = can(admin, "alertas.read")
    ? await getAlertCounts().then(
        (counts) => counts.reduce((sum, count) => sum + count.total, 0),
        () => undefined
      )
    : undefined;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ink-950"
      >
        Saltar al contenido
      </a>
      {/* Escritorio: barra lateral oscura fija (decisión del usuario). */}
      <aside className="hidden bg-nav-bg md:block">
        <div className="flex flex-col md:sticky md:top-0 md:h-dvh">
        <div className="px-5 pt-5 pb-4">
          <Brand role={role} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <NavLinks permissions={permissions} />
        </div>
        <div className="border-t border-nav-rule px-3 py-3">
          <p className="truncate px-2 text-xs text-nav-fg" title={admin.email}>
            {admin.email}
          </p>
          <p className="mb-1 px-2 text-xs text-nav-muted">{role}</p>
          <SignOut label="Cerrar sesión" />
        </div>
        </div>
      </aside>

      {/* Móvil (M1): arriba solo la marca y el área actual; las secciones van en la barra inferior. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 bg-nav-bg px-4 pt-[env(safe-area-inset-top,0px)] md:hidden">
        <BrandMark />
        <div className="min-w-0">
          <p className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-white">Celebraloo</p>
          <p className="truncate text-xs text-nav-muted">
            <AreaName />
          </p>
        </div>
      </header>

      {/* El padding inferior móvil reserva la barra de pestañas y, si la hay, la acción principal (M3). */}
      <main
        id="contenido"
        tabIndex={-1}
        className="min-w-0 px-4 py-5 focus:outline-none max-md:pb-[calc(84px+env(safe-area-inset-bottom,0px))] max-md:has-[[data-primary-action]]:pb-[calc(140px+env(safe-area-inset-bottom,0px))] md:px-8 md:py-8"
      >
        <div className="mx-auto w-full max-w-[1280px]">{children}</div>
      </main>
      <BottomTabs permissions={permissions} email={admin.email} role={role} alertCount={alertCount} />
    </div>
  );
}
