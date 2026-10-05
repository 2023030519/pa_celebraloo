-- Celebraloo — Panel Admin V2 · Fase 1: definiciones únicas de métricas
--
-- Requiere 20261005100000 y 20261005110000.
--
-- Inicio, Reportes y Métricas leen de aquí. Definiciones:
-- * Ingresos = dinero recibido: cobrado (paid_at) − reembolsos (fecha en
--   Stripe) − contracargos perdidos (closed_at). Días de America/Mexico_City.
-- * Ventas (transacciones) = compras de Stripe pagadas en el periodo. Las
--   cortesías (provider admin_panel) no son ventas: private.admin_purchases
--   solo tiene Stripe y excluye staff.
-- * Ticket promedio = ingresos / transacciones (null sin transacciones).
-- * Cliente de pago = usuario registrado (no staff) con al menos una compra
--   pagada que no se reembolsó totalmente ni perdió en contracargo.
-- * Conversión gratis a pago = de los registrados en el periodo, cuántos
--   tienen al menos una compra pagada.
-- * Comparación = mismos días transcurridos del mes anterior; sin
--   porcentaje si el valor anterior es 0.
-- * Eventos próximos = event_date en los próximos 30 días y sin archived_at
--   (status 'proximo' de private.admin_events; admin_settings = 30).
--
-- Una compra pertenece a un usuario por profile_id o, si aún no la reclamó,
-- por su correo (private.admin_user_purchases).

-- -----------------------------------------------------------------------------
-- 0. Utilidades
-- -----------------------------------------------------------------------------

-- Variación en puntos base. null si no hay valor anterior o es 0.
create or replace function private.pct_change(p_now bigint, p_before bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_now is null or coalesce(p_before, 0) = 0 then null
    else ((p_now - p_before) * 10000 / abs(p_before))::integer
  end;
$$;

revoke execute on function private.pct_change(bigint, bigint) from public, anon;

-- -----------------------------------------------------------------------------
-- 1. Compras por usuario
-- -----------------------------------------------------------------------------

create or replace view private.admin_user_purchases as
select p.*, coalesce(p.profile_id, u.id) as user_id
  from private.admin_purchases p
  left join auth.users u on p.profile_id is null and lower(u.email::text) = lower(p.email);

revoke all on private.admin_user_purchases from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Clientes: todos los registrados (con o sin perfil)
-- -----------------------------------------------------------------------------
-- Antes partía de profiles: quien se registró y no terminó el onboarding no
-- aparecía. Las primeras 12 columnas conservan nombre, tipo y orden.

create or replace view private.admin_customers as
select
  u.id,
  u.email::text as email,
  nullif(trim(concat_ws(' ',
    coalesce(nullif(pr.first_name, ''), u.raw_user_meta_data ->> 'first_name'),
    coalesce(nullif(pr.last_name, ''), u.raw_user_meta_data ->> 'last_name'))), '') as name,
  u.phone::text as phone,
  u.created_at as registered_at,
  u.last_sign_in_at,
  (u.banned_until is not null and u.banned_until > now()) as disabled,
  private.is_staff_account(u.id, u.email) as is_staff,
  coalesce(s.spent, 0)::bigint as spent_cents,
  coalesce(s.paid_purchases, 0)::integer as paid_purchases,
  coalesce(ev.events, 0)::integer as events,
  (
    select pl.key
      from public.events e2
      join public.plans pl on pl.key = private.admin_event_plan_key(e2.id)
     where e2.created_by = u.id and e2.archived_at is null
     order by pl.price_cents desc, pl.sort_order desc
     limit 1
  ) as current_plan_key,
  coalesce(s.is_paying, false) as is_paying,
  s.first_paid_at,
  s.last_paid_at,
  pr.last_seen_at,
  greatest(pr.last_seen_at, u.last_sign_in_at) as last_activity_at,
  u.email_confirmed_at,
  pr.id is not null as has_profile,
  a.utm_source as acq_utm_source,
  a.utm_medium as acq_utm_medium,
  a.utm_campaign as acq_utm_campaign,
  a.referrer as acq_referrer,
  a.captured_at as acq_captured_at,
  private.acquisition_channel(a.utm_source, a.referrer, a.captured_at) as acq_channel
from auth.users u
left join public.profiles pr on pr.id = u.id
left join lateral (
  -- Perfil primero; sin perfil, lo que mandó el registro.
  select coalesce(pr.acq_utm_source, private.clean_acq(m ->> 'utm_source', 120)) as utm_source,
         coalesce(pr.acq_utm_medium, private.clean_acq(m ->> 'utm_medium', 120)) as utm_medium,
         coalesce(pr.acq_utm_campaign, private.clean_acq(m ->> 'utm_campaign', 200)) as utm_campaign,
         coalesce(pr.acq_referrer, private.clean_acq(m ->> 'referrer', 500)) as referrer,
         coalesce(pr.acq_captured_at, case when jsonb_typeof(m) = 'object' then u.created_at end) as captured_at
    from (select u.raw_user_meta_data -> 'acquisition' as m) x
) a on true
left join lateral (
  -- Gastado = cobrado − reembolsado.
  select sum(p.amount_total_cents - p.refunded_cents) filter (where p.paid_at is not null) as spent,
         count(*) filter (where p.paid_at is not null) as paid_purchases,
         bool_or(p.payment_status = 'paid'
                 and p.amount_total_cents > p.refunded_cents
                 and p.dispute_status is distinct from 'lost') as is_paying,
         min(p.paid_at) as first_paid_at,
         max(p.paid_at) as last_paid_at
    from private.admin_user_purchases p
   where p.user_id = u.id
) s on true
left join lateral (
  select count(*) as events from public.events e where e.created_by = u.id
) ev on true
where u.deleted_at is null;

revoke all on private.admin_customers from public, anon, authenticated;

-- Misma firma; "de pago" ahora es la definición oficial (is_paying).
create or replace function public.admin_customers(
  p_search text,
  p_filter text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid, email text, name text, registered_at timestamptz, last_sign_in_at timestamptz,
  current_plan_key text, events integer, spent_cents bigint, disabled boolean, is_staff boolean,
  is_paying boolean, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
begin
  perform private.require_admin_permission('clientes.read');
  return query
  select c.id, c.email, c.name, c.registered_at, c.last_sign_in_at, c.current_plan_key,
         c.events, c.spent_cents, c.disabled, c.is_staff, c.is_paying, count(*) over ()
    from private.admin_customers c
   where (p_filter is null
          or (p_filter = 'paying' and c.is_paying and not c.is_staff)
          or (p_filter = 'free' and not c.is_paying and not c.is_staff)
          or (p_filter = 'disabled' and c.disabled)
          or (p_filter = 'staff' and c.is_staff))
     and (v_search is null
          or lower(c.email) like '%' || v_search || '%'
          or lower(coalesce(c.name, '')) like '%' || v_search || '%')
   order by c.registered_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Resumen financiero: el cálculo sin el chequeo de permiso
-- -----------------------------------------------------------------------------
-- private.admin_finance_core es el cuerpo de admin_finance_summary (versión
-- 20261002100000) sin cambios de fórmula. Así las métricas que ve
-- Administración (número de ventas) salen de la misma cuenta sin darle
-- acceso a Finanzas.

create or replace function private.admin_finance_core(p_from date, p_to date)
returns table (
  period_from date,
  period_to date,
  ventas_brutas_cents bigint,
  numero_ventas integer,
  reembolsos_cents bigint,
  contracargos_cents bigint,
  dinero_recibido_cents bigint,
  iva_cobrado_cents bigint,
  ventas_sin_iva_cents bigint,
  comisiones_stripe_cents bigint,
  gastos_subtotal_cents bigint,
  gastos_total_cents bigint,
  retiros_cents bigint,
  resultado_operativo_cents bigint,
  apartados_reglas_cents bigint,
  dinero_apartado_cents bigint,
  dinero_disponible_cents bigint,
  ventas_sin_datos_financieros integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := p_from;
  v_to date := coalesce(p_to, private.mx_today() + 1);
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_months integer;
begin
  if v_from is null then
    select least(
      coalesce((select min((paid_at at time zone 'America/Mexico_City')::date) from private.admin_purchases), private.mx_today()),
      coalesce((select min(expense_date) from public.admin_expenses), private.mx_today())
    ) into v_from;
    -- Acumulado hasta una fecha anterior al primer movimiento: periodo vacío.
    v_from := least(v_from, v_to - 1);
  end if;
  if v_to <= v_from then
    raise exception 'invalid period' using errcode = '22023';
  end if;

  v_from_ts := private.mx_start(v_from);
  v_to_ts := private.mx_start(v_to);
  v_months := private.months_touched(v_from, v_to);

  return query
  with sales as (
    select coalesce(sum(p.amount_total_cents), 0)::bigint as gross,
           count(*)::integer as n,
           coalesce(sum(p.tax_cents), 0)::bigint as tax,
           coalesce(sum(p.stripe_fee_cents), 0)::bigint as fees,
           count(*) filter (where p.stripe_fee_cents is null)::integer as missing
      from private.admin_purchases p
     where p.paid_at >= v_from_ts and p.paid_at < v_to_ts
  ),
  refunds as (
    select coalesce(sum(r.amount_cents), 0)::bigint as amount,
           coalesce(sum(r.tax_cents), 0)::bigint as tax
      from public.purchase_refunds r
      join private.admin_purchases p on p.id = r.purchase_id
     where r.status = 'succeeded' and r.stripe_created_at >= v_from_ts and r.stripe_created_at < v_to_ts
  ),
  disputes_lost as (
    select coalesce(sum(d.amount_cents), 0)::bigint as amount,
           coalesce(sum(private.mul_div_round(d.amount_cents, coalesce(p.tax_cents, 0), p.amount_total_cents)), 0)::bigint as tax
      from public.purchase_disputes d
      join private.admin_purchases p on p.id = d.purchase_id
     where d.status = 'lost' and d.closed_at >= v_from_ts and d.closed_at < v_to_ts
  ),
  dispute_fees as (
    select coalesce(sum(d.fee_cents), 0)::bigint as amount
      from public.purchase_disputes d
      join private.admin_purchases p on p.id = d.purchase_id
     where d.stripe_created_at >= v_from_ts and d.stripe_created_at < v_to_ts
  ),
  expenses as (
    select coalesce(sum(e.subtotal_cents) filter (where e.category <> 'retiro'), 0)::bigint as subtotal,
           coalesce(sum(e.total_cents) filter (where e.category <> 'retiro'), 0)::bigint as total,
           coalesce(sum(e.total_cents) filter (where e.category = 'retiro'), 0)::bigint as withdrawals
      from public.admin_expenses e
     where e.expense_date >= v_from and e.expense_date < v_to
  ),
  base as (
    select s.gross, s.n, r.amount as refunded, dl.amount as disputed,
           s.gross - r.amount - dl.amount as received,
           s.tax - r.tax - dl.tax as iva,
           s.fees + df.amount as fees,
           e.subtotal as exp_sub, e.total as exp_total, e.withdrawals,
           s.missing
      from sales s, refunds r, disputes_lost dl, dispute_fees df, expenses e
  ),
  calc as (
    select b.*,
           b.received - b.iva as net_of_tax,
           b.received - b.iva - b.fees - b.exp_sub as operating
      from base b
  ),
  rules as (
    select coalesce(sum(a.amount_cents), 0)::bigint as amount
      from calc c,
           lateral private.set_aside_amounts(c.net_of_tax, c.received, c.operating, v_months) a
  )
  select v_from, v_to,
         c.gross, c.n, c.refunded, c.disputed, c.received, c.iva, c.net_of_tax, c.fees,
         c.exp_sub, c.exp_total, c.withdrawals, c.operating,
         ru.amount, c.iva + ru.amount,
         c.received - c.fees - c.exp_total - c.withdrawals - (c.iva + ru.amount),
         c.missing
    from calc c, rules ru;
end;
$$;

revoke execute on function private.admin_finance_core(date, date) from public, anon, authenticated;

create or replace function public.admin_finance_summary(p_from date, p_to date)
returns table (
  period_from date,
  period_to date,
  ventas_brutas_cents bigint,
  numero_ventas integer,
  reembolsos_cents bigint,
  contracargos_cents bigint,
  dinero_recibido_cents bigint,
  iva_cobrado_cents bigint,
  ventas_sin_iva_cents bigint,
  comisiones_stripe_cents bigint,
  gastos_subtotal_cents bigint,
  gastos_total_cents bigint,
  retiros_cents bigint,
  resultado_operativo_cents bigint,
  apartados_reglas_cents bigint,
  dinero_apartado_cents bigint,
  dinero_disponible_cents bigint,
  ventas_sin_datos_financieros integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_permission('finanzas.read');
  return query select f.* from private.admin_finance_core(p_from, p_to) f;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Métricas de un periodo [p_from, p_to)
-- -----------------------------------------------------------------------------

create or replace function private.admin_period_metrics(p_from date, p_to date)
returns table (
  ingresos_cents bigint,
  transacciones integer,
  ticket_promedio_cents bigint,
  clientes_nuevos integer,
  clientes_nuevos_con_compra integer,
  conversion_bps integer,
  clientes_de_pago integer,
  clientes_de_pago_nuevos integer,
  eventos_creados integer,
  dinero_disponible_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from_ts timestamptz := private.mx_start(p_from);
  v_to_ts timestamptz := private.mx_start(p_to);
  f record;
  a record;
begin
  if p_to <= p_from then
    raise exception 'invalid period' using errcode = '22023';
  end if;

  select * into f from private.admin_finance_core(p_from, p_to);
  ingresos_cents := f.dinero_recibido_cents;
  transacciones := f.numero_ventas;
  ticket_promedio_cents := case when f.numero_ventas > 0
                                then private.mul_div_round(f.dinero_recibido_cents, 1, f.numero_ventas) end;

  -- Disponible acumulado al cierre del periodo.
  select x.dinero_disponible_cents into dinero_disponible_cents from private.admin_finance_core(null, p_to) x;

  select count(*)::integer,
         count(*) filter (where c.first_paid_at is not null)::integer
    into clientes_nuevos, clientes_nuevos_con_compra
    from private.admin_customers c
   where not c.is_staff and c.registered_at >= v_from_ts and c.registered_at < v_to_ts;
  conversion_bps := case when clientes_nuevos > 0
                         then (clientes_nuevos_con_compra * 10000 / clientes_nuevos)::integer end;

  -- Clientes de pago al cierre del periodo: reembolsos y contracargos
  -- posteriores a p_to todavía no cuentan.
  select count(distinct p.user_id)::integer into clientes_de_pago
    from private.admin_user_purchases p
    join private.admin_customers c on c.id = p.user_id and not c.is_staff
   where p.paid_at < v_to_ts
     and p.amount_total_cents > coalesce((
           select sum(r.amount_cents) from public.purchase_refunds r
            where r.purchase_id = p.id and r.status = 'succeeded' and r.stripe_created_at < v_to_ts), 0)
     and not exists (
           select 1 from public.purchase_disputes d
            where d.purchase_id = p.id and d.status = 'lost' and d.closed_at < v_to_ts);

  select count(*)::integer into clientes_de_pago_nuevos
    from private.admin_customers c
   where not c.is_staff and c.first_paid_at >= v_from_ts and c.first_paid_at < v_to_ts;

  select count(*)::integer into eventos_creados
    from private.admin_events e
   where not e.is_staff_owner and e.created_at >= v_from_ts and e.created_at < v_to_ts;

  return next;
end;
$$;

revoke execute on function private.admin_period_metrics(date, date) from public, anon, authenticated;

-- Para el panel: los montos solo con finanzas.read.
create or replace function public.admin_period_metrics(p_from date, p_to date)
returns table (
  ingresos_cents bigint,
  transacciones integer,
  ticket_promedio_cents bigint,
  clientes_nuevos integer,
  clientes_nuevos_con_compra integer,
  conversion_bps integer,
  clientes_de_pago integer,
  clientes_de_pago_nuevos integer,
  eventos_creados integer,
  dinero_disponible_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_money boolean;
begin
  perform private.require_admin_permission('inicio.read');
  v_money := private.has_admin_permission('finanzas.read');
  return query
  select case when v_money then m.ingresos_cents end,
         m.transacciones,
         case when v_money then m.ticket_promedio_cents end,
         m.clientes_nuevos,
         m.clientes_nuevos_con_compra,
         m.conversion_bps,
         m.clientes_de_pago,
         m.clientes_de_pago_nuevos,
         m.eventos_creados,
         case when v_money then m.dinero_disponible_cents end
    from private.admin_period_metrics(p_from, p_to) m;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Mes en curso contra los mismos días del mes anterior
-- -----------------------------------------------------------------------------
-- 5 de octubre → [1 oct, 6 oct) contra [1 sep, 6 sep). 31 de marzo → el
-- anterior se recorta al 1 de marzo (todo febrero).

create or replace function public.admin_month_to_date(p_today date default null)
returns table (
  metric text,
  actual bigint,
  anterior bigint,
  variacion_bps integer,
  actual_desde date,
  actual_hasta date,
  anterior_desde date,
  anterior_hasta date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, private.mx_today());
  v_from date := date_trunc('month', v_today)::date;
  v_to date := v_today + 1;
  v_prev_from date := (v_from - interval '1 month')::date;
  v_prev_to date := least(v_prev_from + (v_to - v_from), v_from);
  v_money boolean;
  a record;
  b record;
begin
  perform private.require_admin_permission('inicio.read');
  v_money := private.has_admin_permission('finanzas.read');
  select * into a from private.admin_period_metrics(v_from, v_to);
  select * into b from private.admin_period_metrics(v_prev_from, v_prev_to);

  return query
  select x.metric, x.actual, x.anterior, private.pct_change(x.actual, x.anterior),
         v_from, v_to, v_prev_from, v_prev_to
    from (values
      ('ingresos',          a.ingresos_cents,                  b.ingresos_cents,                  true),
      ('ventas',            a.transacciones::bigint,           b.transacciones::bigint,           false),
      ('clientes_de_pago',  a.clientes_de_pago::bigint,        b.clientes_de_pago::bigint,        false),
      ('dinero_disponible', a.dinero_disponible_cents,         b.dinero_disponible_cents,         true),
      ('ticket_promedio',   a.ticket_promedio_cents,           b.ticket_promedio_cents,           true),
      ('conversion_bps',    a.conversion_bps::bigint,          b.conversion_bps::bigint,          false),
      ('clientes_nuevos',   a.clientes_nuevos::bigint,         b.clientes_nuevos::bigint,         false),
      ('eventos_creados',   a.eventos_creados::bigint,         b.eventos_creados::bigint,         false)
    ) as x (metric, actual, anterior, is_money)
   where v_money or not x.is_money;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Serie para la gráfica de Inicio
-- -----------------------------------------------------------------------------
-- p_bucket: day | week (lunes) | month. p_metric: ingresos | ventas |
-- clientes_nuevos. Cada punto sale de private.admin_period_metrics.

create or replace function public.admin_series(p_from date, p_to date, p_bucket text, p_metric text)
returns table (bucket_start date, bucket_end date, value bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_bucket not in ('day', 'week', 'month') or p_metric not in ('ingresos', 'ventas', 'clientes_nuevos') then
    raise exception 'invalid bucket or metric' using errcode = '22023';
  end if;
  if p_to <= p_from or p_to - p_from > 800 then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  perform private.require_admin_permission(case when p_metric = 'ingresos' then 'finanzas.read' else 'inicio.read' end);

  return query
  select s.d_from, s.d_to,
         case p_metric
           when 'ingresos' then m.ingresos_cents
           when 'ventas' then m.transacciones::bigint
           else m.clientes_nuevos::bigint
         end
    from (
      select greatest(b::date, p_from) as d_from,
             least((b + ('1 ' || p_bucket)::interval)::date, p_to) as d_to
        from generate_series(date_trunc(p_bucket, p_from::timestamp), (p_to - 1)::timestamp,
                             ('1 ' || p_bucket)::interval) as b
    ) s,
    lateral private.admin_period_metrics(s.d_from, s.d_to) m
   order by s.d_from;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. KPIs operativos con las definiciones oficiales
-- -----------------------------------------------------------------------------

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
begin
  perform private.require_admin_permission('inicio.read');
  return query
  select
    (select count(*) from private.admin_customers c
      where not c.is_staff and c.registered_at >= v_from and c.registered_at < v_to)::integer,
    (select count(*) from private.admin_customers c where not c.is_staff and c.is_paying)::integer,
    (select count(*) from private.admin_customers c where not c.is_staff and not c.is_paying)::integer,
    -- Activo = invitación publicada y el evento no ha pasado (incluye próximos publicados).
    (select count(*) from private.admin_events e
      where not e.is_staff_owner and e.published and e.status in ('activo', 'proximo'))::integer,
    (select count(*) from private.admin_events e where not e.is_staff_owner and e.status = 'proximo')::integer,
    (select count(*) from private.admin_events e where not e.is_staff_owner and e.status = 'finalizado')::integer,
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

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.admin_period_metrics(date, date)',
    'public.admin_month_to_date(date)',
    'public.admin_series(date, date, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
