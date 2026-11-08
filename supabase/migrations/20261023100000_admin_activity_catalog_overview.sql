-- Celebraloo — Panel Admin: aplica 20261003100000 (repo Celebraloo) con los
-- permisos de 20261005100000.
--
-- La base tenía la admin_activity de 20261001120000, cuya rama "pago fallido"
-- lee item_name de purchases ("column p.item_name does not exist"), y no
-- tenía admin_catalog_overview (Catálogo). require_super_admin se cambia por
-- el permiso que 20261005100000 le dio a cada una.

create or replace function public.admin_catalog_overview()
returns table (
  item_type text,
  item_key text,
  name text,
  is_active boolean,
  price_cents integer,
  price_without_tax_cents integer,
  tax_cents integer,
  tax_rate_bps integer,
  stripe_product_id text,
  stripe_price_id text,
  numero_ventas integer,
  ingresos_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rate integer := coalesce((select iva_rate_bps from public.admin_settings where id), 1600);
begin
  perform private.require_admin_permission('planes.read');
  return query
  with items as (
    select 'plan'::text as kind, pl.key, pl.name, pl.is_active, pl.price_cents,
           pl.stripe_product_id, pl.stripe_price_id, pl.sort_order as ord
      from public.plans pl
    union all
    select 'addon', ad.key, ad.name, ad.is_active, ad.price_cents,
           ad.stripe_product_id, ad.stripe_price_id, 1000
      from public.addons ad
  ),
  sales as (
    select p.item_type, p.item_key, count(*)::integer as n,
           sum(p.amount_total_cents - p.refunded_cents)::bigint as revenue
      from private.admin_purchases p
     where p.paid_at is not null and p.item_key is not null
     group by p.item_type, p.item_key
  )
  select i.kind, i.key, i.name, i.is_active, i.price_cents,
         split.subtotal_cents, split.tax_cents, v_rate,
         i.stripe_product_id, i.stripe_price_id,
         coalesce(s.n, 0), coalesce(s.revenue, 0)::bigint
    from items i
    left join sales s on s.item_type = i.kind and s.item_key = i.key
    left join lateral private.split_tax_included(i.price_cents, v_rate) split on i.price_cents is not null
   order by i.kind desc, i.ord, i.name;
end;
$$;

revoke execute on function public.admin_catalog_overview() from public, anon;
grant execute on function public.admin_catalog_overview() to authenticated;

-- -----------------------------------------------------------------------------
-- Actividad: también los permisos que un admin da o quita por evento (la
-- Actividad anterior del panel los mostraba). Misma función de 20261002100000
-- más esa rama.
-- -----------------------------------------------------------------------------

create or replace function public.admin_activity(p_limit integer, p_before timestamptz)
returns table (occurred_at timestamptz, kind text, title text, detail text, actor text, target_type text, target_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_before timestamptz := coalesce(p_before, now() + interval '1 minute');
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  perform private.require_admin_permission('actividad.read');
  return query
  select * from (
    select u.created_at, 'registro', 'Cliente se registró', u.email::text, null::text, 'customer', u.id::text
      from auth.users u where u.created_at < v_before
    union all
    select e.created_at, 'evento', 'Cliente creó un evento', e.name, e.owner_email, 'event', e.id::text
      from private.admin_events e where e.created_at < v_before
    union all
    select p.paid_at, 'pago', 'Pago confirmado',
           coalesce(p.item_name, 'Compra') || ' · ' || to_char(p.amount_total_cents / 100.0, 'FM$999,999,990.00'),
           p.email, 'purchase', p.id::text
      from private.admin_purchases p where p.paid_at is not null and p.paid_at < v_before
    union all
    select coalesce(p.failed_at, p.cancelled_at, p.created_at), 'pago_fallido',
           case when p.payment_status = 'failed' then 'Pago fallido' else 'Pago no completado' end,
           coalesce(ap.item_name, 'Compra'), p.email, 'purchase', p.id::text
      from private.admin_purchases ap
      join public.purchases p on p.id = ap.id
     where p.payment_status in ('failed', 'cancelled')
       and coalesce(p.failed_at, p.cancelled_at, p.created_at) < v_before
    union all
    select w.created_at, 'pago_rechazado', 'Intento de pago rechazado', w.error_reason, null, 'purchase', w.purchase_id::text
      from public.stripe_webhook_events w
     where w.event_type = 'payment_intent.payment_failed' and w.created_at < v_before
    union all
    select r.stripe_created_at, 'reembolso', 'Reembolso ' || r.status,
           to_char(r.amount_cents / 100.0, 'FM$999,999,990.00'), null, 'purchase', r.purchase_id::text
      from public.purchase_refunds r where r.stripe_created_at < v_before
    union all
    select d.stripe_created_at, 'contracargo', 'Contracargo ' || d.status, d.reason, null, 'purchase', d.purchase_id::text
      from public.purchase_disputes d where d.stripe_created_at < v_before
    union all
    select w.created_at, 'error', 'Anomalía de Stripe', w.event_type || ': ' || w.error_reason, null,
           case when w.purchase_id is null then null else 'purchase' end, w.purchase_id::text
      from public.stripe_webhook_events w where w.processing_status = 'anomaly' and w.created_at < v_before
    union all
    -- Permisos dados o quitados a mano por un admin (event_entitlement_grants).
    select g.granted_at, 'permiso',
           case when g.revoked_at is null then 'Permiso activado' else 'Permiso activado (revocado después)' end,
           coalesce(ev.name, 'Evento borrado') || ' · ' || g.capability_key || coalesce(' · ' || g.reason, ''),
           su.email::text, case when ev.id is null then null else 'event' end, g.event_id::text
      from public.event_entitlement_grants g
      left join public.events ev on ev.id = g.event_id
      left join public.celebraloo_staff st on st.id = g.granted_by_staff_id
      left join auth.users su on su.id = st.profile_id
     where g.source = 'admin_override' and g.granted_at < v_before
    union all
    select a.created_at, 'admin', a.action, coalesce(a.target_label, a.target_id), a.actor_email, a.target_type, a.target_id
      from public.admin_audit_log a where a.created_at < v_before
  ) as activity (occurred_at, kind, title, detail, actor, target_type, target_id)
  order by 1 desc
  limit v_limit;
end;
$$;

notify pgrst, 'reload schema';
