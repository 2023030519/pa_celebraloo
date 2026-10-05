import { Badge } from "@/components/ui";
import { RoleSelect } from "@/components/role-select";

/**
 * Rol del panel: ninguno, admin o superadmin. Un superadmin lo cambia para
 * cualquier usuario (la BD exige que quede al menos un superadmin); los demás
 * solo lo ven.
 */
export function RoleCell({
  user,
  canEdit,
}: {
  user: { id: string; isPlatformAdmin: boolean; isSuperAdmin: boolean };
  canEdit: boolean;
}) {
  const role = user.isSuperAdmin ? "superadmin" : user.isPlatformAdmin ? "admin" : "none";
  if (canEdit) return <RoleSelect userId={user.id} role={role} />;
  if (role === "none") return <span className="text-ink-600">—</span>;
  return <Badge tone="gold">{role === "superadmin" ? "Superadmin" : "Admin"}</Badge>;
}
