-- Celebraloo — Panel Admin V2 · Fase 5: reportes y métricas
--
-- Requiere 20261005100000 … 20261005160000.
--
-- Todo sale de las funciones centrales (admin_finance_core,
-- admin_period_metrics, admin_count_new_customers,
-- admin_sales_by_product_core). Aquí solo se agregan dos piezas con su
-- definición única y se reorganizan las salidas:
-- * private.admin_discount_totals: ventas con descuento y monto descontado.
-- * private.admin_event_counts: eventos activos, próximos y finalizados.
--
-- 1. admin_monthly_report: + transacciones, ticket promedio, conversión,
--    ventas con descuento, descuentos y variación de ingresos contra el mes
--    anterior (mes en curso: mismos días transcurridos; meses cerrados: mes
--    completo).
-- 2. admin_report_summary: las 4 tarjetas del reporte para el rango.
-- 3. admin_metrics: adquisición, activación, monetización, uso y funnel
--    Registro → Evento creado → Compra → Invitación publicada (orden validado
--    en la Fase 0: publicar exige un plan de pago).

-- -----------------------------------------------------------------------------
-- 0. Piezas nuevas con definición única
-- -----------------------------------------------------------------------------

create or replace function private.admin_discount_totals(p_from date, p_to date)
returns table (ventas_con_descuento integer, descuentos_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer, coalesce(sum(pu.discount_cents), 0)::bigint
    from public.purchases pu
    join private.admin_purchases p on p.id = pu.id
   where pu.discount_cents > 0
     and p.paid_at >= private.mx_start(p_from)
     and p.paid_at < private.mx_start(p_to);
$$;

-- Activo = invitación publicada y el evento no ha pasado (incluye próximos
-- publicados). Próximo = en los siguientes 30 días, sin archivar.
create or replace function private.admin_event_counts()
returns table (eventos_activos integer, eventos_proximos integer, eventos_finalizados integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) filter (where e.published and e.status in ('activo', 'proximo'))::integer,
         count(*) filter (where e.status = 'proximo')::integer,
         count(*) filter (where e.status = 'finalizado')::integer
    from private.admin_events e
   where not e.is_staff_owner;
$$;

revoke execute on function private.admin_discount_totals(date, date) from public, anon, authenticated;
revoke execute on function private.admin_event_counts() from public, anon, authenticated;

-- Mismos KPIs que 20261005120000; los conteos de eventos salen de admin_event_counts.
create or replace function public.admin_operational_kpis(p_from date, p_to date)
returns table (
  clientes_nuevos integer,
  clientes_de_pago integer,
  clientes_gratuitos integer,
  eventos_activos integer,
  eventos_proximos integer,
  eventos_finalizados integer,
  eventos_creados integer,
  pagos_fallidos integer,
  pagos_rechazados integer,
  pagos_abandonados integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := private.mx_start(p_from);
  v_to timestamptz := private.mx_start(p_to);
  ev record;
begin
  perform private.require_admin_permission('inicio.read');
  select * into ev from private.admin_event_counts();
  return query
  select
    (select n.clientes_nuevos from private.admin_count_new_customers(p_from, p_to) n),
    (select count(*) from private.admin_customers c where not c.is_staff and c.is_paying)::integer,
    (select count(*) from private.admin_customers c where not c.is_staff and not c.is_paying)::integer,
    ev.eventos_activos,
    ev.eventos_proximos,
    ev.eventos_finalizados,
    (select count(*) from private.admin_events e
      where not e.is_staff_owner and e.created_at >= v_from and e.created_at < v_to)::integer,
    (select count(*) from private.admin_purchases p
      where p.created_at >= v_from and p.created_at < v_to
        and (p.payment_status in ('failed', 'cancelled') or (p.payment_status = 'pending' and p.has_failed_attempt)))::integer,
    (select count(*) from private.admin_purchases p
      where p.created_at >= v_from and p.created_at < v_to
        and (p.payment_status = 'failed' or (p.payment_status in ('pending', 'cancelled') and p.has_failed_attempt)))::integer,
    (select count(*) from private.admin_purchases p
      where p.created_at >= v_from and p.created_at < v_to
        and p.payment_status = 'cancelled' and not p.has_failed_attempt)::integer;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Reporte mensual
-- -----------------------------------------------------------------------------

drop function if exists public.admin_monthly_report(date, integer);

create function public.admin_monthly_report(p_from_month date, p_months integer)
returns table (
  month date,
  ventas_brutas_cents bigint,
  transacciones integer,
  ticket_promedio_cents bigint,
  dinero_recibido_cents bigint,
  variacion_ingresos_bps integer,
  iva_cobrado_cents bigint,
  comisiones_stripe_cents bigint,
  ingresos_netos_cents bigint,
  gastos_total_cents bigint,
  resultado_operativo_cents bigint,
  clientes_nuevos integer,
  clientes_de_pago_nuevos integer,
  conversion_bps integer,
  eventos_creados integer,
  ventas_con_descuento integer,
  descuentos_cents bigint,
  plan_mas_comprado text,
  complemento_mas_comprado text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.mx_today();
  v_month date;
  v_next date;
  v_to date;
  v_prev_from date;
  v_prev_to date;
  f record;
  m record;
  prev record;
  d record;
begin
  perform private.require_admin_permission('reportes.read');
  if coalesce(p_months, 0) < 1 or p_months > 36 then
    raise exception 'months must be between 1 and 36' using errcode = '22023';
  end if;

  for i in 0 .. p_months - 1 loop
    v_month := (date_trunc('month', p_from_month) + make_interval(months => i))::date;
    v_next := (v_month + interval '1 month')::date;
    -- El mes en curso llega hasta hoy y se compara con los mismos días del anterior.
    v_to := least(v_next, v_today + 1);
    v_prev_from := (v_month - interval '1 month')::date;
    v_prev_to := least(v_prev_from + (v_to - v_month), v_month);

    select * into f from private.admin_finance_core(v_month, v_next);
    select * into m from private.admin_period_metrics(v_month, v_next);
    select * into prev from private.admin_finance_core(v_prev_from, v_prev_to);
    select * into d from private.admin_discount_totals(v_month, v_next);

    month := v_month;
    ventas_brutas_cents := f.ventas_brutas_cents;
    transacciones := f.numero_ventas;
    ticket_promedio_cents := m.ticket_promedio_cents;
    dinero_recibido_cents := f.dinero_recibido_cents;
    variacion_ingresos_bps := case when v_month > v_today then null
                                   else private.pct_change(
                                     (select x.dinero_recibido_cents from private.admin_finance_core(v_month, greatest(v_to, v_month + 1)) x),
                                     prev.dinero_recibido_cents) end;
    iva_cobrado_cents := f.iva_cobrado_cents;
    comisiones_stripe_cents := f.comisiones_stripe_cents;
    ingresos_netos_cents := f.ventas_sin_iva_cents - f.comisiones_stripe_cents;
    gastos_total_cents := f.gastos_total_cents;
    resultado_operativo_cents := f.resultado_operativo_cents;
    clientes_nuevos := m.clientes_nuevos;
    clientes_de_pago_nuevos := m.clientes_de_pago_nuevos;
    conversion_bps := m.conversion_bps;
    eventos_creados := m.eventos_creados;
    ventas_con_descuento := d.ventas_con_descuento;
    descuentos_cents := d.descuentos_cents;
    select s.item_name into plan_mas_comprado
      from private.admin_sales_by_product_core(v_month, v_next) s
     where s.item_type = 'plan' order by s.numero_ventas desc, s.ventas_brutas_cents desc limit 1;
    select s.item_name into complemento_mas_comprado
      from private.admin_sales_by_product_core(v_month, v_next) s
     where s.item_type = 'addon' order by s.numero_ventas desc, s.ventas_brutas_cents desc limit 1;
    return next;
    plan_mas_comprado := null;
    complemento_mas_comprado := null;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Tarjetas del reporte para el rango [p_from, p_to)
-- -----------------------------------------------------------------------------

create or replace function public.admin_report_summary(p_from date, p_to date)
returns table (
  ingresos_cents bigint,
  resultado_operativo_cents bigint,
  clientes_de_pago_nuevos integer,
  ticket_promedio_cents bigint,
  transacciones integer,
  ventas_con_descuento integer,
  descuentos_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  f record;
  m record;
  d record;
begin
  perform private.require_admin_permission('reportes.read');
  select * into f from private.admin_finance_core(p_from, p_to);
  select * into m from private.admin_period_metrics(p_from, p_to);
  select * into d from private.admin_discount_totals(p_from, p_to);
  return query
  select f.dinero_recibido_cents, f.resultado_operativo_cents, m.clientes_de_pago_nuevos, m.ticket_promedio_cents,
         f.numero_ventas, d.ventas_con_descuento, d.descuentos_cents;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Métricas
-- -----------------------------------------------------------------------------
-- Cohorte = personas (sin staff) registradas en [p_from, p_to). Adquisición,
-- activación, conversión y funnel son de esa cohorte. Ticket y ventas por
-- producto, de las ventas del periodo. Uso es la foto de hoy.

create or replace function public.admin_metrics(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := private.mx_start(p_from);
  v_to timestamptz := private.mx_start(p_to);
  v_result jsonb;
  m record;
  d record;
  ev record;
begin
  perform private.require_admin_permission('metricas.read');
  if p_to <= p_from or p_to - p_from > 1100 then
    raise exception 'invalid period' using errcode = '22023';
  end if;

  select * into m from private.admin_period_metrics(p_from, p_to);
  select * into d from private.admin_discount_totals(p_from, p_to);
  select * into ev from private.admin_event_counts();

  with cohort as (
    select c.id, c.acq_channel, c.first_paid_at, c.events,
           exists (select 1 from private.admin_events e where e.owner_id = c.id and e.published) as published,
           exists (select 1 from private.admin_events e where e.owner_id = c.id and e.guests > 0) as has_guests
      from private.admin_customers c
     where not c.is_staff and c.registered_at >= v_from and c.registered_at < v_to
  ),
  steps as (
    select count(*)::integer as registro,
           count(*) filter (where events > 0)::integer as evento,
           count(*) filter (where events > 0 and first_paid_at is not null)::integer as compra,
           count(*) filter (where events > 0 and first_paid_at is not null and published)::integer as publicada,
           count(*) filter (where published)::integer as publicaron,
           count(*) filter (where has_guests)::integer as con_invitados
      from cohort
  ),
  customers as (
    select c.last_activity_at
      from private.admin_customers c
     where not c.is_staff
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'adquisicion', jsonb_build_object(
      'usuarios_registrados', m.clientes_nuevos,
      -- Clientes nuevos = su primera compra pagada cae en el periodo.
      'clientes_nuevos', m.clientes_de_pago_nuevos,
      'fuentes', coalesce((select jsonb_agg(jsonb_build_object('canal', x.acq_channel, 'usuarios', x.total) order by x.total desc, x.acq_channel)
                             from (select acq_channel, count(*)::integer as total from cohort group by acq_channel) x), '[]'::jsonb)
    ),
    'activacion', (select jsonb_build_object(
      'registrados', s.registro,
      'crean_evento', s.evento,
      'publican_invitacion', s.publicaron,
      'agregan_invitados', s.con_invitados) from steps s),
    'monetizacion', jsonb_build_object(
      'conversion_bps', m.conversion_bps,
      'registrados_que_compraron', m.clientes_nuevos_con_compra,
      'transacciones', m.transacciones,
      'ingresos_cents', m.ingresos_cents,
      'ticket_promedio_cents', m.ticket_promedio_cents,
      'ventas_con_descuento', d.ventas_con_descuento,
      'descuentos_cents', d.descuentos_cents,
      'productos', coalesce((select jsonb_agg(jsonb_build_object(
                     'tipo', s.item_type, 'clave', s.item_key, 'nombre', s.item_name, 'ventas', s.numero_ventas,
                     'porcentaje_bps', s.porcentaje_bps, 'ventas_brutas_cents', s.ventas_brutas_cents)
                     order by s.item_type desc, s.numero_ventas desc)
                     from (select x.*, (x.numero_ventas * 10000 / sum(x.numero_ventas) over (partition by x.item_type))::integer as porcentaje_bps
                             from private.admin_sales_by_product_core(p_from, p_to) x) s), '[]'::jsonb)
    ),
    'uso', jsonb_build_object(
      'eventos_activos', ev.eventos_activos,
      'eventos_proximos', ev.eventos_proximos,
      'usuarios_activos_30d', (select count(*) from customers where last_activity_at >= now() - interval '30 days'),
      'ultima_actividad', (select jsonb_build_object(
          'menos_7_dias', count(*) filter (where last_activity_at >= now() - interval '7 days'),
          'de_7_a_30_dias', count(*) filter (where last_activity_at < now() - interval '7 days' and last_activity_at >= now() - interval '30 days'),
          'de_30_a_90_dias', count(*) filter (where last_activity_at < now() - interval '30 days' and last_activity_at >= now() - interval '90 days'),
          'mas_de_90_dias', count(*) filter (where last_activity_at < now() - interval '90 days'),
          'nunca', count(*) filter (where last_activity_at is null))
        from customers)
    ),
    'funnel', (select jsonb_build_array(
      jsonb_build_object('paso', 'registro', 'usuarios', s.registro),
      jsonb_build_object('paso', 'evento', 'usuarios', s.evento),
      jsonb_build_object('paso', 'compra', 'usuarios', s.compra),
      jsonb_build_object('paso', 'publicada', 'usuarios', s.publicada)) from steps s)
  )
  into v_result;
  return v_result;
end;
$$;

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.admin_monthly_report(date, integer)',
    'public.admin_report_summary(date, date)',
    'public.admin_metrics(date, date)'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
