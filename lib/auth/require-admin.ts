import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type AdminSession = {
  userId: string;
  email: string;
  staffId: string;
  /** Ve finanzas y ventas, y cambia roles, catálogo, etc. */
  isSuperAdmin: boolean;
};

/**
 * Única puerta del panel: sesión válida + fila en celebraloo_staff con
 * is_platform_admin. Se llama en el layout Y en cada Server Action (una
 * acción es un endpoint público: el layout no la protege). Fail-closed:
 * sin sesión → /login; con sesión pero sin permiso → 404, para no revelar
 * que el panel existe.
 */
export const requireAdmin = cache(async (): Promise<AdminSession> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const service = createServiceRoleClient();
  const read = (columns: string) =>
    service.from("celebraloo_staff").select(columns).eq("profile_id", userId).maybeSingle<{
      id: string;
      is_platform_admin: boolean;
      is_super_admin?: boolean;
    }>();

  let { data: staff, error } = await read("id, is_platform_admin, is_super_admin");
  // Sin la migración 20260929140000 la columna no existe: nadie es superadmin.
  if (error?.code === "42703") ({ data: staff, error } = await read("id, is_platform_admin"));

  if (error || !staff?.is_platform_admin) notFound();

  return {
    userId,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
    staffId: staff.id,
    isSuperAdmin: staff.is_super_admin === true,
  };
});

/**
 * Ventas, Finanzas, Gastos, Clientes y demás del Panel V1: solo superadmin.
 * Cualquier otro recibe 404 (también en Server Actions). La BD lo vuelve a
 * validar: cada RPC admin_* empieza con private.require_super_admin().
 */
export async function requireSuperAdmin(): Promise<AdminSession> {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) notFound();
  return admin;
}
