import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Lecturas del panel. Todas van por las RPCs admin_* con la sesión de quien
 * entra: la BD valida el permiso de su rol y hace TODOS los cálculos. Aquí no
 * se suma ni se resta dinero.
 */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
      throw new Error(`Falta aplicar la migración que crea ${fn} en Supabase.`);
    }
    if (error.code === "42501") throw new Error("Tu rol no tiene permiso para ver esta información.");
    throw new Error(`${fn}: ${error.message}`);
  }
  return data as T;
}

// Postgres devuelve bigint como número en JSON mientras quepa; los montos del
// panel (centavos) caben de sobra en Number.MAX_SAFE_INTEGER.

export type FinanceSummary = {
  period_from: string;
  period_to: string;
  ventas_brutas_cents: number;
  numero_ventas: number;
  reembolsos_cents: number;
  contracargos_cents: number;
  dinero_recibido_cents: number;
  iva_cobrado_cents: number;
  ventas_sin_iva_cents: number;
  comisiones_stripe_cents: number;
  gastos_subtotal_cents: number;
  gastos_total_cents: number;
  retiros_cents: number;
  resultado_operativo_cents: number;
  apartados_reglas_cents: number;
  dinero_apartado_cents: number;
  dinero_disponible_cents: number;
  ventas_sin_datos_financieros: number;
};

/** from null = acumulado desde el primer movimiento. */
export const getFinanceSummary = cache(async (from: string | null, to: string | null): Promise<FinanceSummary> => {
  const rows = await rpc<FinanceSummary[]>("admin_finance_summary", { p_from: from, p_to: to });
  return rows[0];
});

export type SetAsideRow = { name: string; kind: "iva" | "percent" | "fixed"; value: number | null; base: string | null; amount_cents: number };

export async function getSetAsideBreakdown(from: string | null, to: string | null): Promise<SetAsideRow[]> {
  return rpc<SetAsideRow[]>("admin_set_aside_breakdown", { p_from: from, p_to: to });
}

export type ProductSales = {
  item_type: "plan" | "addon";
  item_key: string;
  item_name: string;
  numero_ventas: number;
  ventas_brutas_cents: number;
  reembolsos_cents: number;
};

export async function getSalesByProduct(from: string, to: string): Promise<ProductSales[]> {
  return rpc<ProductSales[]>("admin_sales_by_product", { p_from: from, p_to: to });
}

export type SaleRow = {
  id: string;
  sale_at: string;
  customer_id: string | null;
  customer_email: string;
  customer_name: string | null;
  event_id: string | null;
  event_name: string | null;
  item_type: string | null;
  item_name: string | null;
  total_cents: number;
  tax_cents: number | null;
  stripe_fee_cents: number | null;
  net_cents: number | null;
  refunded_cents: number;
  display_status: string;
  total_count: number;
};

export type SalesFilters = {
  from: string | null;
  to: string | null;
  status: string | null;
  product: string | null;
  search: string | null;
  eventId: string | null;
  limit: number;
  offset: number;
};

export async function listSales(filters: SalesFilters): Promise<SaleRow[]> {
  return rpc<SaleRow[]>("admin_sales", {
    p_from: filters.from,
    p_to: filters.to,
    p_status: filters.status,
    p_product: filters.product,
    p_search: filters.search,
    p_event_id: filters.eventId,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
}

export type SaleDetail = {
  sale: {
    id: string;
    created_at: string;
    paid_at: string | null;
    email: string;
    profile_id: string | null;
    event_id: string | null;
    claimed_at: string | null;
    payment_status: string;
    display_status: string;
    amount_total_cents: number;
    currency: string;
    provider_checkout_session_id: string | null;
    provider_payment_intent_id: string | null;
    checkout_intent: string | null;
    billing_mode: string | null;
    refunded_cents: number;
    tax_rate_bps: number | null;
    subtotal_cents: number | null;
    tax_cents: number | null;
    stripe_fee_cents: number | null;
    net_cents: number | null;
    stripe_charge_id: string | null;
    stripe_balance_transaction_id: string | null;
    item_type: string | null;
    item_key: string | null;
    item_name: string | null;
  };
  has_failed_attempt: boolean;
  /** false: el rol no tiene ventas.financiero y la BD omitió el desglose. */
  financials_visible?: boolean;
  /** Perfil del cliente; si aún no reclama la compra, el usuario con ese correo. */
  customer_id?: string | null;
  customer_name: string | null;
  refund_summary?: { refunded_cents: number; last_refund_at: string | null; kind: "total" | "parcial" } | null;
  /** Descuento de un cupón (migración 20261005160000). total cobrado = precio de lista − descuento. */
  discount?: {
    list_amount_cents: number;
    discount_cents: number;
    promotion_code: string | null;
    promotion_id: string | null;
    promotion_name: string | null;
  } | null;
  event_name: string | null;
  refunds: { id: string; amount_cents: number; tax_cents: number; status: string; reason: string | null; stripe_created_at: string }[];
  disputes: { id: string; amount_cents: number; fee_cents: number; status: string; reason: string | null; stripe_created_at: string; closed_at: string | null }[];
  stripe_events: { id: string; type: string; status: string; error: string | null; at: string }[];
};

export async function getSaleDetail(id: string): Promise<SaleDetail | null> {
  return rpc<SaleDetail | null>("admin_sale_detail", { p_purchase_id: id });
}

export type OperationalKpis = {
  clientes_nuevos: number;
  clientes_de_pago: number;
  clientes_gratuitos: number;
  eventos_activos: number;
  eventos_proximos: number;
  eventos_finalizados: number;
  eventos_creados: number;
  pagos_fallidos: number;
  pagos_rechazados: number;
  pagos_abandonados: number;
};

export async function getOperationalKpis(from: string, to: string): Promise<OperationalKpis> {
  const rows = await rpc<OperationalKpis[]>("admin_operational_kpis", { p_from: from, p_to: to });
  return rows[0];
}

export type EventListRow = {
  id: string;
  name: string;
  event_type: string;
  event_date: string | null;
  owner_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  plan_key: string | null;
  guests: number;
  rsvp_confirmed: number;
  rsvp_pending: number;
  rsvp_declined: number;
  status: string;
  created_at: string;
  is_staff_owner: boolean;
  total_count: number;
};

export async function listAdminEvents(args: {
  search: string | null;
  status: string | null;
  includeStaff: boolean;
  limit: number;
  offset: number;
}): Promise<EventListRow[]> {
  return rpc<EventListRow[]>("admin_events", {
    p_search: args.search,
    p_status: args.status,
    p_include_staff: args.includeStaff,
    p_limit: args.limit,
    p_offset: args.offset,
  });
}

export type AdminEventDetail = {
  id: string;
  name: string;
  event_type: string;
  event_date: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  plan_key: string | null;
  published: boolean;
  invitation_status: string | null;
  guests: number;
  rsvp_confirmed: number;
  rsvp_pending: number;
  rsvp_declined: number;
  checked_in: number;
  qr_generated: number;
  photos: number;
  status: string;
  invitations_sent: null;
  purchases: { id: string; sale_at: string; item_name: string | null; total_cents: number; display_status: string }[];
};

export async function getAdminEventDetail(id: string): Promise<AdminEventDetail | null> {
  return rpc<AdminEventDetail | null>("admin_event_detail", { p_event_id: id });
}

export type CustomerRow = {
  id: string;
  email: string;
  name: string | null;
  registered_at: string;
  /** Lo más reciente entre su última actividad en Celebraloo y su último inicio de sesión. */
  last_activity_at: string | null;
  events: number;
  spent_cents: number;
  disabled: boolean;
  is_staff: boolean;
  is_paying: boolean;
  email_confirmed: boolean;
  total_count: number;
};

export async function listCustomers(args: { search: string | null; filter: string | null; limit: number; offset: number }): Promise<CustomerRow[]> {
  return rpc<CustomerRow[]>("admin_customers", {
    p_search: args.search,
    p_filter: args.filter,
    p_limit: args.limit,
    p_offset: args.offset,
  });
}

/** compra | asignado (panel) | cortesia (panel) | prueba (Tour). */
export type PlanOrigin = "compra" | "asignado" | "cortesia" | "prueba";

export type EventAddon = { key: string; name: string; origin: PlanOrigin };

export type CustomerEvent = {
  id: string;
  name: string;
  event_date: string | null;
  status: string;
  published: boolean;
  guests: number;
  plan_key: string | null;
  plan_origin: PlanOrigin | null;
  addons: EventAddon[];
};

export type CustomerActivity = {
  at: string;
  kind: "registro" | "evento" | "pago" | "admin";
  title: string;
  detail: string | null;
  actor: string | null;
  target_type: string | null;
  target_id: string | null;
};

export type CustomerCard = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  registered_at: string;
  last_sign_in_at: string | null;
  last_seen_at: string | null;
  last_activity_at: string | null;
  email_confirmed: boolean;
  disabled: boolean;
  is_staff: boolean;
  has_profile: boolean;
  spent_cents: number;
  is_paying: boolean;
  paid_purchases: number;
  first_paid_at: string | null;
  last_paid_at: string | null;
  events: number;
  acq_channel: string;
  acq_utm_campaign: string | null;
  purchases: {
    id: string;
    sale_at: string;
    item_type: string | null;
    item_name: string | null;
    event_id: string | null;
    total_cents: number;
    refunded_cents: number;
    display_status: string;
  }[];
  events_list: CustomerEvent[];
  activity: CustomerActivity[];
};

export async function getCustomerCard(id: string): Promise<CustomerCard | null> {
  return rpc<CustomerCard | null>("admin_customer_card", { p_profile_id: id });
}

export type ViewAs = {
  session: { id: string; expires_at: string; reason: string };
  customer: { id: string; name: string | null; email: string; registered_at: string; email_confirmed: boolean } | null;
  events: (Omit<CustomerEvent, "guests"> & {
    event_type: string;
    city: string | null;
    invitation_status: string | null;
    guests: number;
    rsvp_confirmed: number;
    rsvp_pending: number;
    rsvp_declined: number;
    checked_in: number;
    photos: number;
    role: string;
  })[];
  purchases: { id: string; at: string; item_name: string | null; total_cents: number; display_status: string }[];
};

/** null = la sesión venció, terminó o no es de quien la pide. */
export async function getViewAs(sessionId: string): Promise<ViewAs | null> {
  try {
    return await rpc<ViewAs>("admin_view_as", { p_session_id: sessionId });
  } catch (error) {
    if (error instanceof Error && /permiso/.test(error.message)) return null;
    throw error;
  }
}

export type Subscription = {
  id: string;
  concept: string;
  category: string;
  vendor: string | null;
  periodicity: "mensual" | "anual";
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  monthly_equivalent_cents: number;
  start_date: string;
  next_charge_date: string;
  status: "activo" | "cancelado";
  payment_method: string | null;
  notes: string | null;
  days_to_next: number;
};

export async function getSubscriptions(): Promise<Subscription[]> {
  return rpc<Subscription[]>("admin_subscriptions", {});
}

export type CatalogOverviewRow = {
  item_type: "plan" | "addon";
  item_key: string;
  name: string;
  is_active: boolean;
  price_cents: number | null;
  price_without_tax_cents: number | null;
  tax_cents: number | null;
  tax_rate_bps: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  numero_ventas: number;
  ingresos_cents: number;
};

export async function getCatalogOverview(): Promise<CatalogOverviewRow[]> {
  return rpc<CatalogOverviewRow[]>("admin_catalog_overview", {});
}

export type MonthlyReportRow = {
  month: string;
  ventas_brutas_cents: number;
  transacciones: number;
  ticket_promedio_cents: number | null;
  dinero_recibido_cents: number;
  /** Variación del dinero recibido contra el mes anterior (mes en curso: mismos días). */
  variacion_ingresos_bps: number | null;
  iva_cobrado_cents: number;
  comisiones_stripe_cents: number;
  ingresos_netos_cents: number;
  gastos_total_cents: number;
  resultado_operativo_cents: number;
  clientes_nuevos: number;
  clientes_de_pago_nuevos: number;
  conversion_bps: number | null;
  eventos_creados: number;
  ventas_con_descuento: number;
  descuentos_cents: number;
  plan_mas_comprado: string | null;
  complemento_mas_comprado: string | null;
};

export async function getMonthlyReport(fromMonth: string, months: number): Promise<MonthlyReportRow[]> {
  return rpc<MonthlyReportRow[]>("admin_monthly_report", { p_from_month: `${fromMonth}-01`, p_months: months });
}

export type ActivityItem = {
  occurred_at: string;
  kind: string;
  title: string;
  detail: string | null;
  actor: string | null;
  target_type: string | null;
  target_id: string | null;
};

/** before: para paginar hacia atrás (occurred_at del último renglón visto). */
export async function getActivity(limit: number, before: string | null): Promise<ActivityItem[]> {
  return rpc<ActivityItem[]>("admin_activity", { p_limit: limit, p_before: before });
}

// ---------------------------------------------------------------------------
// Inicio, alertas y definiciones (migraciones 20261005120000 … 140000)
// ---------------------------------------------------------------------------

export type MonthMetric =
  | "ingresos"
  | "ventas"
  | "clientes_de_pago"
  | "dinero_disponible"
  | "ticket_promedio"
  | "conversion_bps"
  | "clientes_nuevos"
  | "eventos_creados";

export type MonthToDateRow = {
  metric: MonthMetric;
  actual: number | null;
  anterior: number | null;
  /** Variación en puntos base; null sin dato anterior (o anterior = 0). */
  variacion_bps: number | null;
  actual_desde: string;
  actual_hasta: string;
  anterior_desde: string;
  anterior_hasta: string;
};

/** Mes en curso contra los mismos días del mes anterior. Sin finanzas.read no llegan las filas de dinero. */
export async function getMonthToDate(): Promise<Map<MonthMetric, MonthToDateRow>> {
  const rows = await rpc<MonthToDateRow[]>("admin_month_to_date", {});
  return new Map(rows.map((row) => [row.metric, row]));
}

export type SeriesMetric = "ingresos" | "ventas" | "clientes_nuevos";
export type SeriesBucket = "day" | "week" | "month";
export type SeriesPoint = { bucket_start: string; bucket_end: string; value: number };

export async function getSeries(from: string, to: string, bucket: SeriesBucket, metric: SeriesMetric): Promise<SeriesPoint[]> {
  return rpc<SeriesPoint[]>("admin_series", { p_from: from, p_to: to, p_bucket: bucket, p_metric: metric });
}

export type ProductMixRow = {
  item_type: "plan" | "addon";
  item_key: string;
  item_name: string;
  numero_ventas: number;
  /** Porcentaje dentro de su tipo, en puntos base. */
  porcentaje_bps: number;
};

export async function getProductMix(from: string, to: string): Promise<ProductMixRow[]> {
  return rpc<ProductMixRow[]>("admin_product_mix", { p_from: from, p_to: to });
}

export type AlertSeverity = "rojo" | "amarillo" | "azul";

export type AlertRow = {
  kind: string;
  severity: AlertSeverity;
  title: string;
  detail: string | null;
  occurred_at: string | null;
  target_type: "purchase" | "event" | "customer" | "expense" | null;
  target_id: string | null;
};

export async function getAlerts(kind: string | null, limit = 200): Promise<AlertRow[]> {
  return rpc<AlertRow[]>("admin_alerts", { p_kind: kind, p_limit: limit });
}

export type AlertCount = { kind: string; severity: AlertSeverity; total: number };

export async function getAlertCounts(): Promise<AlertCount[]> {
  return rpc<AlertCount[]>("admin_alert_counts", {});
}

// ---------------------------------------------------------------------------
// Promociones (migración 20261005160000)
// ---------------------------------------------------------------------------

export type PromotionKind = "cupon" | "descuento" | "lanzamiento";
export type PromotionStatus = "activa" | "programada" | "vencida" | "agotada" | "inactiva";

export type PromotionRow = {
  id: string;
  kind: PromotionKind;
  name: string;
  code: string;
  discount_type: "percent" | "amount";
  percent_off: number | null;
  amount_off_cents: number | null;
  starts_at: string;
  expires_at: string | null;
  max_redemptions: number | null;
  times_redeemed: number;
  times_redeemed_synced_at: string | null;
  applies_to_plans: string[];
  applies_to_addons: string[];
  is_active: boolean;
  stripe_active: boolean;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
  status: PromotionStatus;
  /** Ventas pagadas con esta promoción, descuento total y lo cobrado. */
  ventas: number;
  descuento_total_cents: number;
  cobrado_cents: number;
};

export async function listPromotions(): Promise<PromotionRow[]> {
  return rpc<PromotionRow[]>("admin_promotions_list", {});
}

// ---------------------------------------------------------------------------
// Reportes y métricas (migración 20261006100000)
// ---------------------------------------------------------------------------

export type ReportSummary = {
  ingresos_cents: number;
  resultado_operativo_cents: number;
  clientes_de_pago_nuevos: number;
  ticket_promedio_cents: number | null;
  transacciones: number;
  ventas_con_descuento: number;
  descuentos_cents: number;
};

export async function getReportSummary(from: string, to: string): Promise<ReportSummary> {
  const rows = await rpc<ReportSummary[]>("admin_report_summary", { p_from: from, p_to: to });
  return rows[0];
}

export type FunnelStep = "registro" | "evento" | "compra" | "publicada";

export type Metrics = {
  period: { from: string; to: string };
  adquisicion: { usuarios_registrados: number; clientes_nuevos: number; fuentes: { canal: string; usuarios: number }[] };
  activacion: { registrados: number; crean_evento: number; publican_invitacion: number; agregan_invitados: number };
  monetizacion: {
    conversion_bps: number | null;
    registrados_que_compraron: number;
    transacciones: number;
    ingresos_cents: number;
    ticket_promedio_cents: number | null;
    ventas_con_descuento: number;
    descuentos_cents: number;
    productos: { tipo: "plan" | "addon"; clave: string; nombre: string; ventas: number; porcentaje_bps: number; ventas_brutas_cents: number }[];
  };
  uso: {
    eventos_activos: number;
    eventos_proximos: number;
    usuarios_activos_30d: number;
    ultima_actividad: { menos_7_dias: number; de_7_a_30_dias: number; de_30_a_90_dias: number; mas_de_90_dias: number; nunca: number };
  };
  funnel: { paso: FunnelStep; usuarios: number }[];
};

export async function getMetrics(from: string, to: string): Promise<Metrics> {
  return rpc<Metrics>("admin_metrics", { p_from: from, p_to: to });
}
