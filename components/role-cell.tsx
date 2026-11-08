import { Check, ShieldCheck, X } from "lucide-react";
import { Badge, Nil } from "@/components/ui";
import { ROLE_LABELS, type AdminRole } from "@/lib/auth/permissions";

/** Rol del panel, solo lectura. Se cambia en la ficha de la cuenta (con motivo). */
export function RoleCell({ role }: { role: AdminRole | null }) {
  if (!role) return <Nil label="Sin acceso al panel" />;
  return (
    <Badge>
      <ShieldCheck size={12} aria-hidden="true" />
      {ROLE_LABELS[role]}
    </Badge>
  );
}

/**
 * ROLE_DESCRIPTIONS (revisado contra admin_role_permissions el 7 nov 2026) en
 * dos listas, como Stripe. shortcut: copia en texto de la matriz; si cambia un
 * permiso en la BD, cambia aquí y en ROLE_DESCRIPTIONS.
 */
export const ROLE_SCOPE: Record<AdminRole, { can: string[]; cannot: string[] }> = {
  superadmin: {
    can: [
      "Todo el panel",
      "Editar planes, precios, configuración y roles",
      "Borrar cuentas y eventos",
      "Desbloquear la edición de un evento",
      "Devolver la prueba gratis y ver como usuario",
      "En la app del cliente, actuar como staff de Invitación",
    ],
    cannot: [],
  },
  administracion: {
    can: [
      "Ver Inicio, alertas, clientes, eventos, ventas con su desglose, métricas y actividad",
      "Ver planes (solo lectura)",
      "Asignar planes, complementos, cortesías y permisos sueltos de un evento",
      "Suspender cuentas y reenviar la confirmación de correo",
      "Escribir notas",
      "En la app del cliente, actuar como staff de Invitación",
    ],
    cannot: [
      "Ver finanzas, gastos, reportes ni promociones",
      "Editar planes, precios, configuración ni roles",
      "Borrar cuentas o eventos, desbloquear la edición, devolver la prueba gratis ni ver como usuario",
    ],
  },
  soporte: {
    can: [
      "Ver Inicio, alertas, clientes, eventos y la lista de ventas",
      "Reenviar la confirmación de correo",
      "Escribir notas",
    ],
    cannot: [
      "Ver el desglose de las ventas, finanzas, gastos, reportes, métricas, promociones, planes ni actividad",
      "Cambiar planes ni cuentas",
    ],
  },
  finanzas: {
    can: [
      "Ver Inicio, alertas, ventas con su desglose, finanzas, gastos, reportes y métricas",
      "Registrar gastos y editar promociones",
      "Leer clientes, eventos, actividad y planes",
      "Escribir notas",
    ],
    cannot: ["Acciones sobre cuentas o eventos", "Editar planes, configuración ni roles"],
  },
};

/** "Puede" y "No puede" de un rol: marca + texto, nunca solo color. */
export function RoleScope({ role }: { role: AdminRole }) {
  const { can, cannot } = ROLE_SCOPE[role];
  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <ScopeList title="Puede" items={can} />
      {cannot.length > 0 ? (
        <ScopeList title="No puede" items={cannot} negative />
      ) : (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-600">No puede</p>
          <p className="text-ink-600">Nada: sin restricciones en el panel.</p>
        </div>
      )}
    </div>
  );
}

function ScopeList({ title, items, negative = false }: { title: string; items: string[]; negative?: boolean }) {
  const Icon = negative ? X : Check;
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink-600">{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5 text-ink-800">
            <Icon size={14} aria-hidden="true" className={negative ? "mt-0.5 shrink-0 text-danger-700" : "mt-0.5 shrink-0 text-ok-700"} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
