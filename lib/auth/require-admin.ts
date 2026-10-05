import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, isPermission, PERMISSIONS, type AdminRole, type Permission } from "@/lib/auth/permissions";

export type AdminSession = {
  userId: string;
  email: string;
  role: AdminRole;
  permissions: ReadonlySet<Permission>;
};

export const NO_PERMISSION = "Tu rol no tiene permiso para hacer esto.";

/**
 * Antes de aplicar 20261005100000_admin_roles_permissions no existe
 * admin_my_permissions: el superadmin de siempre conserva todo y nadie más
 * entra (las RPCs viejas también exigen superadmin).
 */
async function legacyPermissions(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("celebraloo_staff")
    .select("is_platform_admin, is_super_admin")
    .eq("profile_id", userId)
    .maybeSingle<{ is_platform_admin: boolean; is_super_admin: boolean }>();
  if (!data?.is_platform_admin || !data.is_super_admin) return null;
  return { role: "superadmin" as const, permissions: new Set<Permission>(PERMISSIONS) };
}

/**
 * Única puerta del panel: sesión válida + rol de panel en celebraloo_staff.
 * Los permisos salen de la BD (admin_my_permissions, con la sesión de quien
 * entra). Se llama en el layout Y en cada Server Action (una acción es un
 * endpoint público). Fail-closed: sin sesión → /login; sin rol → 404, para
 * no revelar que el panel existe.
 */
export const requireAdmin = cache(async (): Promise<AdminSession> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const email = typeof data.claims.email === "string" ? data.claims.email : "";

  const { data: rows, error } = await supabase.rpc("admin_my_permissions");
  if (error) {
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      const legacy = await legacyPermissions(supabase, userId);
      if (legacy) return { userId, email, ...legacy };
    }
    notFound();
  }

  const list = (rows ?? []) as { role: string; permission: string }[];
  const role = list[0]?.role;
  if (!isAdminRole(role)) notFound();

  return {
    userId,
    email,
    role,
    permissions: new Set(list.map((row) => row.permission).filter(isPermission)),
  };
});

export function can(admin: AdminSession, permission: Permission): boolean {
  return admin.permissions.has(permission);
}

/** Páginas: sin el permiso, 404. La BD lo vuelve a validar en cada RPC. */
export async function requirePermission(...anyOf: Permission[]): Promise<AdminSession> {
  const admin = await requireAdmin();
  if (!anyOf.some((permission) => can(admin, permission))) notFound();
  return admin;
}
