-- Celebraloo — Panel Admin V2 · Fase 1: centro de alertas
--
-- Requiere 20261005120000.
--
-- Una fila por alerta: tipo, severidad (rojo | amarillo | azul), título,
-- detalle, fecha y destino (purchase → /ventas/:id, event → /eventos/:id,
-- customer → /clientes/:id). Reemplaza a admin_attention_items, que se
-- queda mientras el panel cambia de pantalla (Fase 2).
--
-- Definiciones:
-- * Pago duplicado: 2+ compras pagadas del mismo usuario (perfil o correo),
--   mismo producto y evento, a menos de 24 h. Se marca la posterior.
-- * Pago sin plan asignado: compra pagada y ya reclamada (tiene evento) con
--   un item que NUNCA generó un grant. No basta "sin grant activo": subir de
--   plan, un reembolso o un contracargo revocan grants legítimamente. Una
--   compra sin reclamar no puede tener grants (no hay evento): va aparte como
--   "Pagó y no ha reclamado".
-- * Eventos próximos: status 'proximo' (30 días, sin archivar).

create or replace view private.admin_alerts as
-- ROJO -----------------------------------------------------------------------
select 'pago_fallido'::text as kind,
       'rojo'::text as severity,
       'Pago rechazado'::text as title,
       p.email || coalesce(' · ' || p.item_name, '') as detail,
       p.created_at as occurred_at,
       'purchase'::text as target_type,
       p.id::text as target_id
  from private.admin_purchases p
 where p.created_at >= now() - interval '30 days'
   and (p.payment_status = 'failed' or (p.payment_status in ('pending', 'cancelled') and p.has_failed_attempt))
union all
select 'contracargo', 'rojo', 'Contracargo abierto (' || d.status || ')',
       coalesce(p.email, d.stripe_charge_id) || coalesce(' · ' || d.reason, ''),
       d.stripe_created_at, 'purchase', d.purchase_id::text
  from public.purchase_disputes d
  join private.admin_purchases p on p.id = d.purchase_id
 where d.status not in ('won', 'lost')
union all
select 'pago_duplicado', 'rojo', 'Posible pago duplicado',
       b.email || ' · ' || coalesce(b.item_name, 'Compra'), b.paid_at, 'purchase', b.id::text
  from private.admin_user_purchases b
 where b.payment_status = 'paid'
   and exists (
     select 1
       from private.admin_user_purchases a
      where a.id <> b.id
        and a.payment_status = 'paid'
        and (a.user_id = b.user_id or lower(a.email) = lower(b.email))
        and a.item_key is not distinct from b.item_key
        and a.event_id is not distinct from b.event_id
        and (a.paid_at, a.id) < (b.paid_at, b.id)
        and b.paid_at - a.paid_at < interval '24 hours')
union all
select 'pago_sin_plan', 'rojo', 'Pago sin plan asignado',
       p.email || ' · ' || coalesce(p.item_name, 'Compra'), p.paid_at, 'purchase', p.id::text
  from private.admin_purchases p
 where p.payment_status = 'paid'
   and p.claimed_at is not null
   and p.event_id is not null
   and exists (
     select 1 from public.purchase_items pi
      where pi.purchase_id = p.id
        and not exists (select 1 from public.event_entitlement_grants g where g.source_ref = pi.id))
union all
select 'error_webhook', 'rojo', 'Error de webhook de Stripe',
       w.event_type || ': ' || coalesce(w.error_reason, 'sin detalle'), w.created_at,
       case when w.purchase_id is null then null else 'purchase' end, w.purchase_id::text
  from public.stripe_webhook_events w
 where w.processing_status = 'anomaly' and w.created_at >= now() - interval '30 days'
-- AMARILLO -------------------------------------------------------------------
union all
select 'evento_sin_publicar', 'amarillo', 'Evento próximo sin invitación publicada',
       e.name || ' · ' || to_char(e.event_date, 'DD/MM/YYYY'), e.event_date::timestamptz, 'event', e.id::text
  from private.admin_events e
 where e.status = 'proximo' and not e.published and not e.is_staff_owner
union all
select 'evento_sin_invitados', 'amarillo', 'Evento próximo sin invitados',
       e.name || ' · ' || to_char(e.event_date, 'DD/MM/YYYY'), e.event_date::timestamptz, 'event', e.id::text
  from private.admin_events e
 where e.status = 'proximo' and e.guests = 0 and not e.is_staff_owner  -- guests ya excluye is_demo
union all
select 'pago_sin_reclamar', 'amarillo',
       case when p.claimed_at is null then 'Pagó y no ha reclamado su compra' else 'Pagó y no tiene evento' end,
       p.email || coalesce(' · ' || p.item_name, ''), p.paid_at, 'purchase', p.id::text
  from private.admin_purchases p
 where p.payment_status = 'paid'
   and (p.claimed_at is null or p.event_id is null)
   and p.paid_at < now() - interval '1 hour'
union all
select 'reembolso_pendiente', 'amarillo', 'Reembolso pendiente', p.email || ' · ' || r.status,
       r.stripe_created_at, 'purchase', r.purchase_id::text
  from public.purchase_refunds r
  join private.admin_purchases p on p.id = r.purchase_id
 where r.status in ('pending', 'requires_action')
-- AZUL -----------------------------------------------------------------------
union all
select 'registrado_sin_evento', 'azul', 'Registrado sin evento', c.email, c.registered_at, 'customer', c.id::text
  from private.admin_customers c
 where not c.is_staff and c.events = 0
union all
select 'evento_sin_publicar_usuario', 'azul', 'Tiene evento sin invitación publicada',
       c.email || ' · ' || count(*) || case when count(*) = 1 then ' evento' else ' eventos' end,
       max(e.created_at), 'customer', c.id::text
  from private.admin_customers c
  join private.admin_events e on e.owner_id = c.id
 where not c.is_staff and not e.published and e.status not in ('archivado', 'finalizado')
 group by c.id, c.email
union all
select 'venta_sin_comision', 'azul', 'Venta sin comisión de Stripe registrada',
       p.email || ' · corre el backfill', p.paid_at, 'purchase', p.id::text
  from private.admin_purchases p
 where p.paid_at is not null and p.stripe_fee_cents is null and p.paid_at < now() - interval '1 hour';

revoke all on private.admin_alerts from public, anon, authenticated;

-- Lista ordenada por severidad y luego por fecha. p_kind filtra un tipo.
create or replace function public.admin_alerts(p_kind text default null, p_limit integer default 200)
returns table (
  kind text, severity text, title text, detail text, occurred_at timestamptz,
  target_type text, target_id text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_permission('alertas.read');
  return query
  select a.kind, a.severity, a.title, a.detail, a.occurred_at, a.target_type, a.target_id
    from private.admin_alerts a
   where p_kind is null or a.kind = p_kind
   order by case a.severity when 'rojo' then 0 when 'amarillo' then 1 else 2 end,
            a.occurred_at desc nulls last
   limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

-- Contador por tipo (para los filtros y el resumen de Inicio).
create or replace function public.admin_alert_counts()
returns table (kind text, severity text, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_permission('alertas.read');
  return query
  select a.kind, a.severity, count(*)::integer
    from private.admin_alerts a
   group by a.kind, a.severity
   order by case a.severity when 'rojo' then 0 when 'amarillo' then 1 else 2 end, count(*) desc;
end;
$$;

revoke execute on function public.admin_alerts(text, integer) from public, anon;
revoke execute on function public.admin_alert_counts() from public, anon;
grant execute on function public.admin_alerts(text, integer) to authenticated;
grant execute on function public.admin_alert_counts() to authenticated;

notify pgrst, 'reload schema';
