-- Celebraloo — Panel Admin V2 · Fase 2: Inicio, alertas y ficha de venta
--
-- Requiere 20261005100000 … 20261005130000.
--
-- 1. private.admin_purchases solo cuenta pagos de Stripe. En producción
--    seguía la versión de 20261001120000 (la parte de la vista de
--    20261002100000 no se aplicó): las cortesías del panel (provider
--    admin_panel, $0) contaban como ventas, "sin comisión" y "sin plan".
-- 2. Clientes nuevos en su propia función: la serie de la gráfica pide una
--    sola métrica por punto sin recalcular todo admin_period_metrics.
-- 3. Mezcla de productos (conteo y %) para Inicio: la ven todos los roles;
--    los montos siguen en admin_sales_by_product (finanzas.read).
-- 4. Ficha de venta: cliente (también si la compra aún no se reclama) y
--    resumen del reembolso (monto, fecha, parcial o total).
-- 5. Se retira admin_attention_items (lo reemplaza admin_alerts).

-- -----------------------------------------------------------------------------
-- 1. Ventas = pagos de Stripe (misma vista de 20261002100000)
-- -----------------------------------------------------------------------------

create or replace view private.admin_purchases as
select
  p.id,
  p.created_at,
  p.paid_at,
  p.email,
  p.profile_id,
  p.event_id,
  p.claimed_at,
  p.payment_status,
  p.amount_total_cents,
  p.currency,
  p.provider_checkout_session_id,
  p.provider_payment_intent_id,
  p.checkout_intent,
  p.billing_mode,
  coalesce(r.refunded_cents, 0)::integer as refunded_cents,
  coalesce(r.refunded_tax_cents, 0)::integer as refunded_tax_cents,
  f.tax_rate_bps,
  f.subtotal_cents,
  f.tax_cents,
  f.stripe_fee_cents,
  f.net_cents,
  f.stripe_charge_id,
  f.stripe_balance_transaction_id,
  d.dispute_status,
  item.item_type,
  item.item_key,
  item.item_name,
  exists (
    select 1 from public.stripe_webhook_events w
     where w.purchase_id = p.id and w.event_type = 'payment_intent.payment_failed'
  ) as has_failed_attempt,
  case
    when d.dispute_status is not null and d.dispute_status <> 'won' then 'disputed'
    when p.payment_status = 'refunded' then 'refunded'
    when p.payment_status = 'paid' and coalesce(r.refunded_cents, 0) > 0 then 'partially_refunded'
    else p.payment_status
  end as display_status
from public.purchases p
left join public.purchase_financials f on f.purchase_id = p.id
left join lateral (
  select sum(x.amount_cents) as refunded_cents, sum(x.tax_cents) as refunded_tax_cents
    from public.purchase_refunds x
   where x.purchase_id = p.id and x.status = 'succeeded'
) r on true
left join lateral (
  select x.status as dispute_status
    from public.purchase_disputes x
   where x.purchase_id = p.id
   order by x.stripe_created_at desc
   limit 1
) d on true
left join lateral (
  select pi.item_type,
         coalesce(pi.plan_key, pi.addon_key) as item_key,
         coalesce(pl.name, ad.name, pi.plan_key, pi.addon_key) as item_name
    from public.purchase_items pi
    left join public.plans pl on pl.key = pi.plan_key
    left join public.addons ad on ad.key = pi.addon_key
   where pi.purchase_id = p.id
   order by pi.item_type desc  -- 'plan' antes que 'addon'
   limit 1
) item on true
where p.provider = 'stripe'
  and not private.is_staff_account(p.profile_id, p.email);

revoke all on private.admin_purchases from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Clientes nuevos (registrados, sin staff) en [p_from, p_to)
-- -----------------------------------------------------------------------------

create or replace function private.admin_count_new_customers(p_from date, p_to date)
returns table (clientes_nuevos integer, clientes_nuevos_con_compra integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer,
         count(*) filter (where c.first_paid_at is not null)::integer
    from private.admin_customers c
   where not c.is_staff
     and c.registered_at >= private.mx_start(p_from)
     and c.registered_at < private.mx_start(p_to);
$$;

revoke execute on function private.admin_count_new_customers(date, date) from public, anon, authenticated;

-- Misma firma y mismas definiciones que en 20261005120000; los registrados
-- salen ahora de admin_count_new_customers.
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
begin
  if p_to <= p_from then
    raise exception 'invalid period' using errcode = '22023';
  end if;

  select * into f from private.admin_finance_core(p_from, p_to);
  ingresos_cents := f.dinero_recibido_cents;
  transacciones := f.numero_ventas;
  ticket_promedio_cents := case when f.numero_ventas > 0
                                then private.mul_div_round(f.dinero_recibido_cents, 1, f.numero_ventas) end;

  select x.dinero_disponible_cents into dinero_disponible_cents from private.admin_finance_core(null, p_to) x;

  select n.clientes_nuevos, n.clientes_nuevos_con_compra
    into clientes_nuevos, clientes_nuevos_con_compra
    from private.admin_count_new_customers(p_from, p_to) n;
  conversion_bps := case when clientes_nuevos > 0
                         then (clientes_nuevos_con_compra * 10000 / clientes_nuevos)::integer end;

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

-- Serie de la gráfica: cada punto calcula solo su métrica, con la misma
-- función que la define.
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
           when 'ingresos' then (select f.dinero_recibido_cents from private.admin_finance_core(s.d_from, s.d_to) f)
           when 'ventas' then (select f.numero_ventas::bigint from private.admin_finance_core(s.d_from, s.d_to) f)
           else (select n.clientes_nuevos::bigint from private.admin_count_new_customers(s.d_from, s.d_to) n)
         end
    from (
      select greatest(b::date, p_from) as d_from,
             least((b + ('1 ' || p_bucket)::interval)::date, p_to) as d_to
        from generate_series(date_trunc(p_bucket, p_from::timestamp), (p_to - 1)::timestamp,
                             ('1 ' || p_bucket)::interval) as b
    ) s
   order by s.d_from;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Ventas por producto: un cálculo, dos vistas
-- -----------------------------------------------------------------------------

create or replace function private.admin_sales_by_product_core(p_from date, p_to date)
returns table (item_type text, item_key text, item_name text, numero_ventas integer,
               ventas_brutas_cents bigint, reembolsos_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.item_type, p.item_key, p.item_name,
         count(*)::integer,
         sum(p.amount_total_cents)::bigint,
         sum(p.refunded_cents)::bigint
    from private.admin_purchases p
   where p.paid_at >= private.mx_start(p_from) and p.paid_at < private.mx_start(p_to)
     and p.item_key is not null
   group by p.item_type, p.item_key, p.item_name;
$$;

revoke execute on function private.admin_sales_by_product_core(date, date) from public, anon, authenticated;

create or replace function public.admin_sales_by_product(p_from date, p_to date)
returns table (item_type text, item_key text, item_name text, numero_ventas integer,
               ventas_brutas_cents bigint, reembolsos_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_permission('finanzas.read');
  return query
  select c.* from private.admin_sales_by_product_core(p_from, p_to) c
   order by c.ventas_brutas_cents desc;
end;
$$;

-- Conteo y porcentaje dentro de su tipo (planes entre planes, complementos
-- entre complementos). Sin montos.
create or replace function public.admin_product_mix(p_from date, p_to date)
returns table (item_type text, item_key text, item_name text, numero_ventas integer, porcentaje_bps integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_permission('inicio.read');
  return query
  select c.item_type, c.item_key, c.item_name, c.numero_ventas,
         (c.numero_ventas * 10000 / sum(c.numero_ventas) over (partition by c.item_type))::integer
    from private.admin_sales_by_product_core(p_from, p_to) c
   order by c.item_type desc, c.numero_ventas desc, c.item_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Ficha de venta
-- -----------------------------------------------------------------------------

create or replace function public.admin_sale_detail(p_purchase_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_fin boolean;
  v_hidden text[] := array['tax_rate_bps', 'subtotal_cents', 'tax_cents', 'stripe_fee_cents', 'net_cents',
                           'refunded_tax_cents', 'stripe_balance_transaction_id'];
begin
  perform private.require_admin_permission('ventas.read');
  v_fin := private.has_admin_permission('ventas.financiero');
  select jsonb_build_object(
           'sale', case when v_fin then to_jsonb(p) - 'has_failed_attempt' - 'user_id'
                        else to_jsonb(p) - 'has_failed_attempt' - 'user_id' - v_hidden end,
           'financials_visible', v_fin,
           'has_failed_attempt', p.has_failed_attempt,
           -- Cliente aunque la compra todavía no se reclame (por su correo).
           'customer_id', p.user_id,
           'customer_name', nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
           'event_name', e.name,
           'refund_summary', case when p.refunded_cents > 0 then jsonb_build_object(
               'refunded_cents', p.refunded_cents,
               'last_refund_at', (select max(r.stripe_created_at) from public.purchase_refunds r
                                   where r.purchase_id = p.id and r.status = 'succeeded'),
               'kind', case when p.refunded_cents >= p.amount_total_cents then 'total' else 'parcial' end
             ) end,
           'refunds', coalesce((select jsonb_agg(case when v_fin then to_jsonb(r) else to_jsonb(r) - 'tax_cents' end
                                                 order by r.stripe_created_at)
                                  from public.purchase_refunds r where r.purchase_id = p.id), '[]'::jsonb),
           'disputes', coalesce((select jsonb_agg(case when v_fin then to_jsonb(d) else to_jsonb(d) - 'fee_cents' end
                                                  order by d.stripe_created_at)
                                   from public.purchase_disputes d where d.purchase_id = p.id), '[]'::jsonb),
           'stripe_events', coalesce((select jsonb_agg(jsonb_build_object(
                                        'id', w.id, 'type', w.event_type, 'status', w.processing_status,
                                        'error', w.error_reason, 'at', w.created_at) order by w.created_at)
                                        from public.stripe_webhook_events w where w.purchase_id = p.id), '[]'::jsonb)
         )
    into v_result
    from private.admin_user_purchases p
    left join public.profiles pr on pr.id = p.user_id
    left join public.events e on e.id = p.event_id
   where p.id = p_purchase_id;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Limpieza y permisos
-- -----------------------------------------------------------------------------

drop function if exists public.admin_attention_items();

revoke execute on function public.admin_product_mix(date, date) from public, anon;
grant execute on function public.admin_product_mix(date, date) to authenticated;

notify pgrst, 'reload schema';
