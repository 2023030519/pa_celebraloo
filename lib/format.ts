/**
 * Formato y entradas del panel. Sin cálculos de métricas: esos viven en SQL
 * (migraciones admin_*). Aquí solo se muestra dinero en centavos (enteros) y
 * se arman rangos de fechas en hora de CDMX para pedirle datos a la BD.
 */

export const TIME_ZONE = "America/Mexico_City";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMxn(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return mxn.format(cents / 100);
}

export function formatInt(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : new Intl.NumberFormat("es-MX").format(value);
}

/** "1,990.5" → 199050. Solo con strings: nunca pasa por un float. null si no es válido. */
export function parsePesosToCents(raw: string): number | null {
  const clean = raw.replace(/[$,\s]/g, "");
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** 199050 → "1990.50" (para rellenar un input). */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Hoy en CDMX como YYYY-MM-DD. */
export function todayMx(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Mes "YYYY-MM" válido, o el actual de CDMX. */
export function monthOrCurrent(raw: string | undefined): string {
  return raw && MONTH.test(raw) ? raw : todayMx().slice(0, 7);
}

/** [primer día del mes, primer día del siguiente) como YYYY-MM-DD. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, mon] = month.split("-").map(Number);
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
}

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string): string {
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T12:00:00Z`)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export function isoDayOrNull(raw: string | undefined): string | null {
  return raw && ISO_DAY.test(raw) ? raw : null;
}

/** Fecha (YYYY-MM-DD) sin mover el día por zona horaria. */
export function formatDay(isoDay: string | null | undefined): string {
  if (!isoDay) return "—";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${isoDay.slice(0, 10)}T12:00:00Z`));
}

export const PAYMENT_STATUS: Record<string, { label: string; tone: "neutral" | "gold" | "ok" | "danger" | "info" }> = {
  paid: { label: "Pagado", tone: "ok" },
  pending: { label: "Pendiente", tone: "neutral" },
  failed: { label: "Fallido", tone: "danger" },
  cancelled: { label: "No completado", tone: "neutral" },
  refunded: { label: "Reembolsado", tone: "info" },
  partially_refunded: { label: "Parcialmente reembolsado", tone: "info" },
  disputed: { label: "Contracargo", tone: "danger" },
};

export const EVENT_STATUS: Record<string, { label: string; tone: "neutral" | "gold" | "ok" | "danger" | "info" }> = {
  borrador: { label: "Borrador", tone: "neutral" },
  configurando: { label: "Configurando", tone: "info" },
  activo: { label: "Activo", tone: "ok" },
  proximo: { label: "Próximo", tone: "gold" },
  finalizado: { label: "Finalizado", tone: "neutral" },
  archivado: { label: "Archivado", tone: "neutral" },
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  tecnologia: "Tecnología / infraestructura",
  desarrollo: "Desarrollo",
  diseno: "Diseño",
  marketing: "Marketing / publicidad",
  legal: "Legal",
  contabilidad: "Contabilidad",
  dominio_hosting: "Dominio / hosting",
  software: "Software / licencias",
  atencion_cliente: "Atención al cliente",
  administracion: "Administración",
  otros: "Otros",
  retiro: "Retiro (sale de caja, no es gasto operativo)",
};

const pctFormat = (digits: number, sign: boolean) =>
  new Intl.NumberFormat("es-MX", {
    style: "percent",
    maximumFractionDigits: digits,
    ...(sign ? { signDisplay: "exceptZero" as const } : {}),
  });

/** Puntos base → "66.7 %". */
export function formatBps(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return "—";
  return pctFormat(1, false).format(bps / 10000);
}

/** Variación en puntos base → "+18 %", "-4.5 %" (un decimal solo si es menor a 10 %). */
export function formatDeltaBps(bps: number): string {
  return pctFormat(Math.abs(bps) < 1000 ? 1 : 0, true).format(bps / 10000);
}

/** [desde, hasta) en días → "1–5 oct" o "28 sep–5 oct". */
export function dayRangeLabel(from: string, toExclusive: string): string {
  const last = addDays(toExclusive, -1);
  const fmt = (iso: string, withMonth: boolean) =>
    new Intl.DateTimeFormat("es-MX", { day: "numeric", ...(withMonth ? { month: "short" } : {}), timeZone: "UTC" }).format(
      new Date(`${iso}T12:00:00Z`)
    );
  if (from === last) return fmt(from, true);
  return from.slice(0, 7) === last.slice(0, 7) ? `${fmt(from, false)}–${fmt(last, true)}` : `${fmt(from, true)}–${fmt(last, true)}`;
}

/** Acciones de admin_audit_log con nombre legible (Actividad y ficha del cliente). */
export const ADMIN_ACTION_LABELS: Record<string, string> = {
  "role.change": "Cambio de rol",
  "staff.role": "Cambio de rol",
  "catalog.update": "Catálogo editado",
  "free_plan.reset": "Plan gratis devuelto",
  "event.unlock": "Edición desbloqueada",
  "event.relock": "Edición bloqueada de nuevo",
  "event.delete": "Evento borrado",
  "event.assign_plan": "Plan asignado",
  "event.assign_complemento": "Complemento asignado",
  "event.assign_acceso_total": "Acceso total asignado",
  "event.courtesy": "Cortesía otorgada",
  "account.disable": "Cuenta suspendida",
  "account.enable": "Cuenta reactivada",
  "account.delete": "Cuenta borrada",
  "account.resend_confirmation": "Confirmación de correo reenviada",
  "account.view_as": "Vista como usuario",
  "admin_expenses.insert": "Gasto registrado",
  "admin_expenses.update": "Gasto editado",
  "admin_expenses.delete": "Gasto borrado",
  "admin_recurring_expenses.insert": "Suscripción registrada",
  "admin_recurring_expenses.update": "Suscripción editada",
  "admin_recurring_expenses.delete": "Suscripción borrada",
  "admin_settings.update": "Configuración cambiada",
  "admin_set_aside_rules.insert": "Apartado creado",
  "admin_set_aside_rules.update": "Apartado editado",
  "admin_set_aside_rules.delete": "Apartado borrado",
};

/** ISO → "YYYY-MM-DDTHH:mm" en hora de Ciudad de México (para un input datetime-local). */
export function toMexicoCityLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export const PROMOTION_KIND: Record<string, string> = {
  cupon: "Cupón",
  descuento: "Descuento",
  lanzamiento: "Lanzamiento",
};
