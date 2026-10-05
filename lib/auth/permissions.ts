/**
 * Roles y permisos del panel. La matriz real vive en la BD
 * (public.admin_role_permissions) y cada RPC la vuelve a validar; aquí solo
 * están los nombres para tipar y para ocultar lo que un rol no puede usar.
 */

export const ADMIN_ROLES = ["superadmin", "administracion", "soporte", "finanzas"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  superadmin: "Superadmin",
  administracion: "Administración",
  soporte: "Soporte",
  finanzas: "Finanzas",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  superadmin: "Todo: planes, configuración, cuentas y roles, borrados y ver como usuario.",
  administracion: "Clientes, eventos, alertas y ventas (lectura). Asigna planes, complementos y cortesías; suspende cuentas.",
  soporte: "Clientes, eventos y alertas en lectura. Reenvía la confirmación de correo. No ve el desglose de las ventas.",
  finanzas: "Ventas, finanzas, gastos, reportes, métricas y promociones. Sin acciones sobre cuentas de clientes.",
};

export const PERMISSIONS = [
  "inicio.read",
  "alertas.read",
  "ventas.read",
  "ventas.financiero",
  "finanzas.read",
  "gastos.read",
  "gastos.write",
  "reportes.read",
  "metricas.read",
  "promociones.read",
  "promociones.write",
  "clientes.read",
  "eventos.read",
  "actividad.read",
  "notas.write",
  "clientes.reenviar_confirmacion",
  "clientes.suspender",
  "clientes.borrar",
  "clientes.plan_gratis",
  "clientes.ver_como",
  "eventos.permisos",
  "eventos.asignar_plan",
  "eventos.cortesia",
  "eventos.desbloquear",
  "eventos.borrar",
  "planes.read",
  "planes.write",
  "config.write",
  "roles.write",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Qué permiso abre cada sección. La primera coincidencia gana; "/" es Inicio.
 * Varias opciones = basta con una.
 */
export const AREA_PERMISSIONS: { prefix: string; anyOf: Permission[] }[] = [
  { prefix: "/alertas", anyOf: ["alertas.read"] },
  { prefix: "/ventas", anyOf: ["ventas.read"] },
  { prefix: "/finanzas", anyOf: ["finanzas.read"] },
  { prefix: "/gastos", anyOf: ["gastos.read"] },
  { prefix: "/clientes", anyOf: ["clientes.read"] },
  { prefix: "/eventos", anyOf: ["eventos.read"] },
  { prefix: "/catalogo", anyOf: ["planes.read"] },
  { prefix: "/reportes", anyOf: ["reportes.read"] },
  { prefix: "/actividad", anyOf: ["actividad.read"] },
  { prefix: "/configuracion", anyOf: ["config.write"] },
  // Cuentas y roles; también la usa quien puede suspender cuentas.
  { prefix: "/usuarios", anyOf: ["roles.write", "clientes.suspender"] },
  { prefix: "/notas", anyOf: ["notas.write"] },
  { prefix: "/ver-como", anyOf: ["clientes.ver_como"] },
];

export function areaPermissions(pathname: string): Permission[] | null {
  if (pathname === "/") return ["inicio.read"];
  const area = AREA_PERMISSIONS.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return area ? area.anyOf : null;
}
