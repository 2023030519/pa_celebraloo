"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, type MouseEvent } from "react";
import {
  BadgeDollarSign,
  ChartLine,
  Bell,
  CalendarHeart,
  FileSpreadsheet,
  History,
  House,
  Landmark,
  LogOut,
  Menu,
  Receipt,
  Settings,
  ShieldCheck,
  Tags,
  TicketPercent,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui";
import { areaPermissions, type Permission } from "@/lib/auth/permissions";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title?: string; items: NavItem[] };

// Agrupadas por área de negocio y en orden de trabajo diario. Cada entrada se
// muestra solo si el rol tiene el permiso de esa sección (AREA_PERMISSIONS, el
// mismo mapa que usa el proxy); un grupo sin entradas no se muestra.
const NAV: NavGroup[] = [
  {
    items: [
      { href: "/", label: "Inicio", icon: House },
      { href: "/alertas", label: "Alertas", icon: Bell },
    ],
  },
  {
    title: "Operación",
    items: [
      { href: "/clientes", label: "Clientes", icon: UserRound },
      { href: "/eventos", label: "Eventos", icon: CalendarHeart },
    ],
  },
  {
    title: "Dinero",
    items: [
      { href: "/ventas", label: "Ventas", icon: BadgeDollarSign },
      { href: "/finanzas", label: "Finanzas", icon: Landmark },
      { href: "/gastos", label: "Gastos", icon: Receipt },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/catalogo", label: "Planes", icon: Tags },
      { href: "/promociones", label: "Promociones", icon: TicketPercent },
    ],
  },
  {
    title: "Análisis",
    items: [
      { href: "/reportes", label: "Reportes", icon: FileSpreadsheet },
      { href: "/metricas", label: "Métricas", icon: ChartLine },
    ],
  },
  {
    title: "Control",
    items: [
      { href: "/actividad", label: "Actividad", icon: History },
      { href: "/configuracion", label: "Configuración", icon: Settings },
      { href: "/usuarios", label: "Cuentas y roles", icon: ShieldCheck },
    ],
  },
];

function visibleGroups(permissions: Permission[]): NavGroup[] {
  const allowed = new Set(permissions);
  return NAV.map((group) => ({
    ...group,
    items: group.items.filter(({ href }) => (areaPermissions(href) ?? []).some((permission) => allowed.has(permission))),
  })).filter((group) => group.items.length > 0);
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Tocar otra vez la sección en la que ya estás (la ruta exacta, no una ficha dentro de ella)
 * vuelve a pedir sus datos al servidor y sube al inicio, como en una app.
 */
function useRefreshOnRetap(pathname: string) {
  const router = useRouter();
  return (href: string) => (event: MouseEvent) => {
    if (pathname !== href || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
}

function Groups({ permissions, pathname }: { permissions: Permission[]; pathname: string }) {
  const retap = useRefreshOnRetap(pathname);
  return (
    <div className="flex flex-col gap-5">
      {visibleGroups(permissions).map((group, index) => (
        <div key={group.title ?? index}>
          {group.title && (
            <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-nav-muted">{group.title}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={retap(href)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-9 items-center gap-2.5 max-md:h-11 rounded-md px-3 text-[13px] font-medium transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                      "focus-visible:outline-nav-accent",
                      active ? "bg-nav-active text-white" : "text-nav-fg/85 hover:bg-nav-hover hover:text-white"
                    )}
                  >
                    {/* Marca oro del ítem activo: la única aparición del acento en la barra. */}
                    {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-nav-accent" />}
                    <Icon size={16} aria-hidden="true" className={active ? "text-nav-accent" : "text-nav-muted"} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Navegación de la barra lateral (escritorio). */
export function NavLinks({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del panel">
      <Groups permissions={permissions} pathname={pathname} />
    </nav>
  );
}

/** Nombre del área actual, para el encabezado móvil (M1). */
export function AreaName() {
  const pathname = usePathname();
  const item = NAV.flatMap((group) => group.items).find(({ href }) => isActive(pathname, href));
  return item ? <>{item.label}</> : null;
}

// M1: los cuatro destinos fijos de la barra inferior, en este orden; si el rol no tiene
// alguno, entra la siguiente área permitida en el orden de la barra lateral.
const TAB_HREFS = ["/", "/alertas", "/clientes", "/eventos"];

const tabClass =
  "flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none font-medium transition-colors focus-visible:outline-nav-accent focus-visible:-outline-offset-2";

/**
 * Barra inferior de pestañas en móvil (M1). "Más" abre, como hoja desde abajo, el menú
 * completo con la cuenta y "Cerrar sesión"; se cierra con Escape, tocando el fondo o al navegar.
 * alertCount: total de alertas (sin conteo si es 0 o no se pasa).
 */
export function BottomTabs({
  permissions,
  email,
  role,
  alertCount,
}: {
  permissions: Permission[];
  email: string;
  role: string;
  alertCount?: number;
}) {
  const pathname = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const retap = useRefreshOnRetap(pathname);
  const allowed = visibleGroups(permissions).flatMap((group) => group.items);
  const tabs = [
    ...TAB_HREFS.flatMap((href) => allowed.filter((item) => item.href === href)),
    ...allowed.filter((item) => !TAB_HREFS.includes(item.href)),
  ].slice(0, 4);
  const moreActive = !tabs.some(({ href }) => isActive(pathname, href));
  const close = () => sheet.current?.close();

  return (
    <nav
      aria-label="Secciones principales"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-nav-rule bg-nav-bg pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      <ul className="flex">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const count = href === "/alertas" && alertCount ? alertCount : 0;
          return (
            <li key={href} className="flex min-w-0 flex-1">
              <Link href={href} onClick={retap(href)} aria-current={active ? "page" : undefined} className={cn(tabClass, active ? "text-white" : "text-nav-muted")}>
                <span className="relative">
                  <Icon size={22} aria-hidden="true" className={active ? "text-nav-accent" : undefined} />
                  {count > 0 && (
                    <span className="absolute -top-1.5 left-3.5 min-w-[18px] rounded-full bg-nav-accent px-1 py-0.5 text-center text-[10px] leading-none font-semibold text-nav-bg tabular-nums">
                      {count > 99 ? "99+" : count}
                      <span className="sr-only"> pendientes</span>
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate px-1">{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => sheet.current?.showModal()}
            className={cn(tabClass, moreActive ? "text-white" : "text-nav-muted")}
          >
            <Menu size={22} aria-hidden="true" className={moreActive ? "text-nav-accent" : undefined} />
            Más
          </button>
        </li>
      </ul>

      {/* Modal nativo: Escape, foco atrapado y fondo inerte vienen del navegador. */}
      <dialog
        key={pathname}
        ref={sheet}
        aria-label="Menú"
        onClick={(e) => {
          // Toque en el fondo (el propio dialog) o en un enlace: se cierra.
          if (e.target === e.currentTarget || (e.target as Element).closest("a")) close();
        }}
        className="animate-enter inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-xl bg-nav-bg p-0 text-nav-fg backdrop:bg-black/40"
      >
        <div className="px-3 pt-2 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <div className="mb-2 flex items-center justify-between pl-3">
            <p className="text-[15px] font-semibold text-white">Menú</p>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar menú"
              className="flex size-11 items-center justify-center rounded-md text-nav-fg hover:bg-nav-hover focus-visible:outline-nav-accent"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Secciones del panel">
            <Groups permissions={permissions} pathname={pathname} />
          </nav>
          <div className="mt-4 border-t border-nav-rule pt-3">
            <p className="truncate px-2 text-xs text-nav-fg" title={email}>
              {email}
            </p>
            <p className="mb-1 px-2 text-xs text-nav-muted">{role}</p>
            <form action="/auth/signout" method="post">
              <button className="flex h-11 w-full items-center gap-2 rounded-md px-2 text-sm font-medium text-nav-fg hover:bg-nav-hover hover:text-white focus-visible:outline-nav-accent">
                <LogOut size={16} aria-hidden="true" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </dialog>
    </nav>
  );
}
