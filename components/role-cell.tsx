import { Badge } from "@/components/ui";
import { ROLE_LABELS, type AdminRole } from "@/lib/auth/permissions";

/** Rol del panel, solo lectura. Se cambia en la ficha de la cuenta (con motivo). */
export function RoleCell({ role }: { role: AdminRole | null }) {
  if (!role) return <span className="text-ink-600">—</span>;
  return <Badge tone="gold">{ROLE_LABELS[role]}</Badge>;
}
