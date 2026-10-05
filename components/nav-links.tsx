"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Bell,
  CalendarHeart,
  FileSpreadsheet,
  History,
  House,
  Landmark,
  Receipt,
  Settings,
  ShieldCheck,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui";
import { areaPermissions, type Permission } from "@/lib/auth/permissions";

type NavItem = { href: string; label: string; icon: LucideIcon };

// Cada entrada se muestra solo si el rol tiene el permiso de esa sección
// (AREA_PERMISSIONS, el mismo mapa que usa el proxy).
const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/ventas", label: "Ventas", icon: BadgeDollarSign },
  { href: "/finanzas", label: "Finanzas", icon: Landmark },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/clientes", label: "Clientes", icon: UserRound },
  { href: "/eventos", label: "Eventos", icon: CalendarHeart },
  { href: "/catalogo", label: "Planes", icon: Tags },
  { href: "/reportes", label: "Reportes", icon: FileSpreadsheet },
  { href: "/actividad", label: "Actividad", icon: History },
  { href: "/configuracion", label: "Configuración", icon: Settings },
  { href: "/usuarios", label: "Cuentas y roles", icon: ShieldCheck },
];

export function NavLinks({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname();
  const allowed = new Set(permissions);
  const items = NAV.filter(({ href }) => (areaPermissions(href) ?? []).some((permission) => allowed.has(permission)));

  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:px-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 font-medium whitespace-nowrap",
              active ? "bg-gold-100 text-ink-950" : "text-ink-800 hover:bg-paper"
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
