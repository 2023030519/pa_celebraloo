/**
 * Secciones del Panel V1 que solo ve la superadmin. Lo usan el proxy (primer
 * filtro, 404) y el menú. La regla que manda está en el servidor
 * (requireSuperAdmin) y en la BD (private.require_super_admin).
 */
export const SUPER_ADMIN_PREFIXES = ["/ventas", "/finanzas", "/gastos", "/clientes", "/reportes", "/configuracion"];

export function isSuperAdminPath(pathname: string): boolean {
  return SUPER_ADMIN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
