"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  CalendarHeart,
  ChartNoAxesColumn,
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

type NavItem = { href: string; label: string; icon: LucideIcon };

// Menú del brief (Panel V1).
const SUPER_ADMIN_NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: House },
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

const ADMIN_NAV: NavItem[] = [
  { href: "/", label: "Resumen", icon: ChartNoAxesColumn },
  { href: "/usuarios", label: "Usuarios", icon: UserRound },
  { href: "/eventos", label: "Eventos", icon: CalendarHeart },
  { href: "/catalogo", label: "Catálogo", icon: Tags },
  { href: "/actividad", label: "Actividad", icon: History },
];

export function NavLinks({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const items = isSuperAdmin ? SUPER_ADMIN_NAV : ADMIN_NAV;

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
