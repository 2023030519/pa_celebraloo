-- Celebraloo — Panel Admin V2 · Fase 3: clientes, acciones de cuenta y gastos recurrentes
--
-- Requiere 20261005100000 … 20261005140000.
--
-- 1. Asignar plan, complemento o acceso total a un evento en UNA transacción
--    (antes eran N llamadas desde el panel y podían quedar a medias). Crea
--    grants admin_override con el motivo; nunca crea compras: no son ventas
--    ni ingresos. Cada asignación queda en admin_event_assignments (para
--    mostrar el plan del evento y si fue cortesía) y en admin_audit_log.
-- 2. Plan del evento con su origen: compra, asignado, cortesía o prueba.
-- 3. Tabla y ficha de clientes con último acceso, eventos con su plan y
--    complementos, y actividad.
-- 4. Bitácora de acciones de cuenta hechas por la API de Auth (reenviar
--    confirmación, suspender, reactivar): permiso y motivo validados aquí.
-- 5. "Ver como usuario": sesiones de 15 minutos, solo superadmin, solo
--    lectura (la única salida es una función stable que devuelve datos).
-- 6. Gastos recurrentes: plantillas, generador idempotente con pg_cron,
--    "Suscripciones y servicios" y alerta de renovación anual (≤ 15 días).
-- 7. La bitácora automática de tablas guarda el motivo si la transacción lo
--    trae en app.audit_reason.

-- -----------------------------------------------------------------------------
-- 0. Motivo en la bitácora automática
-- -----------------------------------------------------------------------------

create or replace function private.audit_admin_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_label text;
begin
  v_label := case tg_table_name
    when 'admin_expenses' then v_row->>'concept'
    when 'admin_recurring_expenses' then v_row->>'concept'
    when 'admin_set_aside_rules' then v_row->>'name'
    else 'Configuración'
  end;

  perform private.log_admin_action(
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_row->>'id',
    v_label,
    jsonb_build_object(
      'before', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      'after', case when tg_op = 'DELETE' then null else to_jsonb(new) end
    ),
    nullif(current_setting('app.audit_reason', true), '')
  );
  return coalesce(new, old);
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Asignaciones a eventos
-- -----------------------------------------------------------------------------

create table if not exists public.admin_event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('plan', 'complemento', 'acceso_total')),
  item_key text,
  is_courtesy boolean not null default false,
  reason text not null check (length(btrim(reason)) >= 3),
  changes integer not null default 0,
  granted_by_staff_id uuid references public.celebraloo_staff (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint admin_event_assignments_item check ((kind = 'acceso_total') = (item_key is null))
);

comment on table public.admin_event_assignments is
  'Planes, complementos y accesos totales asignados desde el panel (con grants admin_override). No son compras: nunca cuentan como ventas ni ingresos. is_courtesy = cortesía.';

create index if not exists admin_event_assignments_event_idx on public.admin_event_assignments (event_id, created_at desc);

alter table public.admin_event_assignments enable row level security;
revoke all on public.admin_event_assignments from public, anon, authenticated;
grant select on public.admin_event_assignments to authenticated;
grant all on public.admin_event_assignments to service_role;
drop policy if exists admin_event_assignments_select_perm on public.admin_event_assignments;
create policy admin_event_assignments_select_perm on public.admin_event_assignments
  for select to authenticated using (private.has_admin_permission('eventos.read'));

-- Mayor = más acceso (mismo criterio que recalculate_event_entitlement).
create or replace function private.capability_rank(
  p_capability_key text,
  p_bool boolean,
  p_int integer,
  p_text text
)
returns integer
language sql
stable
set search_path = ''
as $$
  select case c.value_type
           when 'boolean' then case when p_bool then 1 else 0 end
           when 'integer' then coalesce(p_int, -1)
           else private.enum_value_rank(p_capability_key, p_text)
         end
    from public.capabilities c
   where c.key = p_capability_key;
$$;

revoke execute on function private.capability_rank(text, boolean, integer, text) from public, anon, authenticated;

-- plan: deja los valores EXACTOS del plan (también baja límites); salir de
--   la prueba quita "Elegir plan"; p_remove_others apaga lo que el plan no
--   incluye.
-- complemento: solo sube valores, nunca baja un límite.
-- acceso_total: Atelier + todos los complementos activos (el mayor valor de
--   cada uno), solo sube y sale de la prueba.
create or replace function public.admin_assign_to_event(
  p_event_id uuid,
  p_kind text,
  p_item_key text,
  p_courtesy boolean,
  p_reason text,
  p_remove_others boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_staff_id uuid;
  v_event_name text;
  v_item_name text;
  v_tag text;
  v_changes integer := 0;
  r record;
begin
  perform private.require_admin_permission(case when p_courtesy then 'eventos.cortesia' else 'eventos.asignar_plan' end);
  if p_kind not in ('plan', 'complemento', 'acceso_total') then
    raise exception 'invalid kind %', p_kind using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'reason required' using errcode = '22023';
  end if;

  -- Serializa asignaciones simultáneas sobre el mismo evento.
  select e.name into v_event_name from public.events e where e.id = p_event_id for update;
  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if p_kind = 'plan' then
    select pl.name into v_item_name from public.plans pl where pl.key = p_item_key;
  elsif p_kind = 'complemento' then
    select ad.name into v_item_name from public.addons ad where ad.key = p_item_key;
  else
    v_item_name := 'Acceso total';
  end if;
  if v_item_name is null then
    raise exception 'unknown item %', p_item_key using errcode = 'P0002';
  end if;

  select s.id into v_staff_id from public.celebraloo_staff s where s.profile_id = auth.uid();
  v_tag := v_reason || ' [' || case when p_courtesy then 'cortesía: ' else '' end
           || case p_kind when 'plan' then 'plan ' when 'complemento' then 'complemento ' else '' end
           || v_item_name || ']';

  -- 1. Valores objetivo y estado actual.
  for r in
    with src as (
      select pc.capability_key, pc.value_boolean, pc.value_integer, pc.value_text
        from public.plan_capabilities pc
       where (p_kind = 'plan' and pc.plan_key = p_item_key)
          or (p_kind = 'acceso_total' and pc.plan_key = 'atelier')
      union all
      select ac.capability_key, ac.value_boolean, ac.value_integer, ac.value_text
        from public.addon_capabilities ac
        join public.addons ad on ad.key = ac.addon_key
       where (p_kind = 'complemento' and ac.addon_key = p_item_key)
          or (p_kind = 'acceso_total' and ad.is_active)
    ),
    target as (
      select distinct on (s.capability_key)
             s.capability_key, s.value_boolean, s.value_integer, s.value_text,
             private.capability_rank(s.capability_key, s.value_boolean, s.value_integer, s.value_text) as rnk
        from src s
       order by s.capability_key,
                private.capability_rank(s.capability_key, s.value_boolean, s.value_integer, s.value_text) desc
    )
    select t.*,
           e.event_id is not null as has_current,
           (e.value_boolean, e.value_integer, e.value_text)
             is not distinct from (t.value_boolean, t.value_integer, t.value_text) as same_value,
           private.capability_rank(t.capability_key, e.value_boolean, e.value_integer, e.value_text) as cur_rnk
      from target t
      left join public.event_entitlements e on e.event_id = p_event_id and e.capability_key = t.capability_key
  loop
    if (p_kind = 'plan' and (not r.has_current or not r.same_value))
       or (p_kind <> 'plan' and (not r.has_current or r.rnk > r.cur_rnk)) then
      insert into public.event_entitlement_grants
        (event_id, capability_key, value_boolean, value_integer, value_text, source, granted_by_staff_id, reason)
      values
        (p_event_id, r.capability_key, r.value_boolean, r.value_integer, r.value_text, 'admin_override', v_staff_id, v_tag);
      perform private.recalculate_event_entitlement(p_event_id, r.capability_key);
      v_changes := v_changes + 1;
    end if;
  end loop;

  -- 2. Lo que se apaga: "Elegir plan" al salir de la prueba y, si se pidió,
  --    lo que el plan no incluye. Quitar = revocar el override; si una compra
  --    lo otorga, vuelve a ese valor.
  for r in
    select e.capability_key
      from public.event_entitlements e
     where e.event_id = p_event_id
       and (
         (p_kind = 'acceso_total' and e.capability_key = 'choose_plan')
         or (p_kind = 'plan'
             and not exists (select 1 from public.plan_capabilities pc
                              where pc.plan_key = p_item_key and pc.capability_key = e.capability_key)
             and (p_remove_others or (e.capability_key = 'choose_plan' and p_item_key <> 'tour')))
       )
  loop
    update public.event_entitlement_grants
       set revoked_at = now(), revoked_reason = v_tag
     where event_id = p_event_id and capability_key = r.capability_key
       and source = 'admin_override' and revoked_at is null;
    perform private.recalculate_event_entitlement(p_event_id, r.capability_key);
    v_changes := v_changes + 1;
  end loop;

  insert into public.admin_event_assignments (event_id, kind, item_key, is_courtesy, reason, changes, granted_by_staff_id)
  values (p_event_id, p_kind, case when p_kind = 'acceso_total' then null else p_item_key end,
          coalesce(p_courtesy, false), v_reason, v_changes, v_staff_id);

  perform private.log_admin_action(
    case when p_courtesy then 'event.courtesy' else 'event.assign_' || p_kind end,
    'event', p_event_id::text, v_event_name,
    jsonb_build_object('kind', p_kind, 'item', p_item_key, 'item_name', v_item_name,
                       'courtesy', coalesce(p_courtesy, false), 'changes', v_changes,
                       'remove_others', coalesce(p_remove_others, false)),
    v_reason
  );

  return v_changes;
end;
$$;

revoke execute on function public.admin_assign_to_event(uuid, text, text, boolean, text, boolean) from public, anon;
grant execute on function public.admin_assign_to_event(uuid, text, text, boolean, text, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Plan del evento y su origen
-- -----------------------------------------------------------------------------
-- tour (prueba) > lo más reciente entre compra pagada y asignación del panel.

create or replace function private.admin_event_plan(p_event_id uuid)
returns table (plan_key text, origin text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.event_has_capability(p_event_id, 'choose_plan') then
    return query select 'tour'::text, 'prueba'::text;
    return;
  end if;
  return query
  select x.plan_key, x.origin
    from (
      select pi.plan_key, 'compra'::text as origin, coalesce(p.claimed_at, p.paid_at, p.created_at) as at
        from public.purchases p
        join public.purchase_items pi on pi.purchase_id = p.id and pi.item_type = 'plan'
       where p.event_id = p_event_id and p.payment_status = 'paid'
      union all
      select coalesce(a.item_key, 'atelier'), case when a.is_courtesy then 'cortesia' else 'asignado' end, a.created_at
        from public.admin_event_assignments a
       where a.event_id = p_event_id and a.kind in ('plan', 'acceso_total')
    ) x
   order by x.at desc
   limit 1;
end;
$$;

revoke execute on function private.admin_event_plan(uuid) from public, anon, authenticated;

create or replace function private.admin_event_plan_key(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select plan_key from private.admin_event_plan(p_event_id);
$$;

-- Complementos de un evento: comprados y asignados desde el panel.
create or replace function private.admin_event_addons(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', x.addon_key, 'name', coalesce(ad.name, x.addon_key), 'origin', x.origin)
                            order by coalesce(ad.name, x.addon_key)), '[]'::jsonb)
    from (
      select distinct on (addon_key) addon_key, origin
        from (
          select pi.addon_key, 'compra'::text as origin, 0 as pri
            from public.purchases p
            join public.purchase_items pi on pi.purchase_id = p.id and pi.item_type = 'addon'
           where p.event_id = p_event_id and p.payment_status = 'paid'
          union all
          select a.item_key, case when a.is_courtesy then 'cortesia' else 'asignado' end, 1
            from public.admin_event_assignments a
           where a.event_id = p_event_id and a.kind = 'complemento'
        ) y
       order by addon_key, pri
    ) x
    left join public.addons ad on ad.key = x.addon_key;
$$;

revoke execute on function private.admin_event_addons(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Clientes
-- -----------------------------------------------------------------------------

drop function if exists public.admin_customers(text, text, integer, integer);

create function public.admin_customers(
  p_search text,
  p_filter text,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid, email text, name text, registered_at timestamptz, last_activity_at timestamptz,
  events integer, spent_cents bigint, disabled boolean, is_staff boolean, is_paying boolean,
  email_confirmed boolean, total_count bigint
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
  select c.id, c.email, c.name, c.registered_at, c.last_activity_at,
         c.events, c.spent_cents, c.disabled, c.is_staff, c.is_paying,
         c.email_confirmed_at is not null, count(*) over ()
    from private.admin_customers c
   where (p_filter is null
          or (p_filter = 'paying' and c.is_paying and not c.is_staff)
          or (p_filter = 'free' and not c.is_paying and not c.is_staff)
          or (p_filter = 'disabled' and c.disabled)
          or (p_filter = 'unconfirmed' and c.email_confirmed_at is null)
          or (p_filter = 'staff' and c.is_staff))
     and (v_search is null
          or lower(c.email) like '%' || v_search || '%'
          or lower(coalesce(c.name, '')) like '%' || v_search || '%')
   order by c.registered_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.admin_customers(text, text, integer, integer) from public, anon;
grant execute on function public.admin_customers(text, text, integer, integer) to authenticated;

create or replace function public.admin_customer_card(p_profile_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_admin_permission('clientes.read');
  select to_jsonb(c) || jsonb_build_object(
           'email_confirmed', c.email_confirmed_at is not null,
           'purchases', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'id', p.id, 'sale_at', coalesce(p.paid_at, p.created_at), 'item_type', p.item_type,
                       'item_name', p.item_name, 'event_id', p.event_id, 'total_cents', p.amount_total_cents,
                       'refunded_cents', p.refunded_cents, 'display_status', p.display_status)
                     order by p.created_at desc)
                from private.admin_user_purchases p
               where p.user_id = c.id), '[]'::jsonb),
           'events_list', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'id', e.id, 'name', e.name, 'event_date', e.event_date, 'status', e.status,
                       'published', e.published, 'guests', e.guests,
                       'plan_key', pl.plan_key, 'plan_origin', pl.origin,
                       'addons', private.admin_event_addons(e.id))
                     order by e.event_date)
                from private.admin_events e
                left join lateral private.admin_event_plan(e.id) pl on true
               where e.owner_id = c.id), '[]'::jsonb),
           'activity', coalesce((
              select jsonb_agg(a order by (a ->> 'at') desc)
                from (
                  select jsonb_build_object('at', x.at, 'kind', x.kind, 'title', x.title, 'detail', x.detail,
                                            'actor', x.actor, 'target_type', x.target_type, 'target_id', x.target_id) as a
                    from (
                      select c.registered_at as at, 'registro'::text as kind, 'Se registró'::text as title,
                             null::text as detail, null::text as actor, null::text as target_type, null::text as target_id
                      union all
                      select e.created_at, 'evento', 'Creó un evento', e.name, null, 'event', e.id::text
                        from public.events e where e.created_by = c.id
                      union all
                      select p.paid_at, 'pago', 'Pago confirmado', p.item_name, null, 'purchase', p.id::text
                        from private.admin_user_purchases p where p.user_id = c.id and p.paid_at is not null
                      union all
                      select l.created_at, 'admin', l.action, coalesce(l.reason, l.target_label), l.actor_email,
                             l.target_type, l.target_id
                        from public.admin_audit_log l
                       where (l.target_type in ('user', 'customer') and l.target_id = c.id::text)
                          or (l.target_type = 'event' and l.target_id in (
                                select e2.id::text from public.events e2 where e2.created_by = c.id))
                    ) x
                   order by x.at desc
                   limit 50
                ) y), '[]'::jsonb)
         )
    into v_result
    from private.admin_customers c
   where c.id = p_profile_id;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Bitácora de acciones de cuenta (API de Auth)
-- -----------------------------------------------------------------------------
-- El panel hace la acción en Auth (service role, solo servidor) y la registra
-- aquí con la sesión de quien la hizo: permiso y motivo los valida la BD.

create or replace function public.admin_record_account_action(
  p_user_id uuid,
  p_action text,
  p_reason text,
  p_detail jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permission text := case p_action
    when 'account.resend_confirmation' then 'clientes.reenviar_confirmacion'
    when 'account.disable' then 'clientes.suspender'
    when 'account.enable' then 'clientes.suspender'
    when 'account.delete' then 'clientes.borrar'
  end;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_email text;
begin
  if v_permission is null then
    raise exception 'invalid action %', p_action using errcode = '22023';
  end if;
  perform private.require_admin_permission(v_permission);
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  select u.email into v_email from auth.users u where u.id = p_user_id;
  perform private.log_admin_action(p_action, 'customer', p_user_id::text, coalesce(v_email, p_user_id::text), p_detail, v_reason);
end;
$$;

revoke execute on function public.admin_record_account_action(uuid, text, text, jsonb) from public, anon;
grant execute on function public.admin_record_account_action(uuid, text, text, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Ver como usuario (solo lectura)
-- -----------------------------------------------------------------------------

create table if not exists public.admin_view_as_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (length(btrim(reason)) >= 3),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz
);

comment on table public.admin_view_as_sessions is
  'Sesiones de "ver como usuario": 15 minutos, solo superadmin. No dan acceso a la cuenta: el panel lee una réplica de solo lectura con admin_view_as().';

alter table public.admin_view_as_sessions enable row level security;
revoke all on public.admin_view_as_sessions from public, anon, authenticated;
grant all on public.admin_view_as_sessions to service_role;

create or replace function public.admin_start_view_as(p_user_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_email text;
  v_id uuid;
  v_expires timestamptz := now() + interval '15 minutes';
begin
  perform private.require_admin_permission('clientes.ver_como');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if private.is_staff_account(p_user_id, v_email) then
    raise exception 'cannot view staff accounts' using errcode = '42501';
  end if;

  -- Una sesión abierta a la vez por persona del staff.
  update public.admin_view_as_sessions
     set ended_at = now()
   where staff_profile_id = auth.uid() and ended_at is null;

  insert into public.admin_view_as_sessions (staff_profile_id, target_user_id, reason, expires_at)
  values (auth.uid(), p_user_id, v_reason, v_expires)
  returning id into v_id;

  perform private.log_admin_action('account.view_as', 'customer', p_user_id::text, v_email,
                                   jsonb_build_object('session', v_id, 'expires_at', v_expires), v_reason);
  return v_id;
end;
$$;

create or replace function public.admin_end_view_as(p_session_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.admin_view_as_sessions
     set ended_at = now()
   where id = p_session_id and staff_profile_id = auth.uid() and ended_at is null;
$$;

-- Lo que ve el cliente en su cuenta, de solo lectura. Falla si la sesión no
-- es de quien llama, ya terminó o venció.
create or replace function public.admin_view_as(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
begin
  perform private.require_admin_permission('clientes.ver_como');
  select * into s from public.admin_view_as_sessions
   where id = p_session_id and staff_profile_id = auth.uid();
  if not found or s.ended_at is not null or s.expires_at <= now() then
    raise exception 'view-as session expired' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'session', jsonb_build_object('id', s.id, 'expires_at', s.expires_at, 'reason', s.reason),
    'customer', (select jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email,
                                           'registered_at', c.registered_at, 'email_confirmed', c.email_confirmed_at is not null)
                   from private.admin_customers c where c.id = s.target_user_id),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'name', e.name, 'event_type', e.event_type, 'event_date', e.event_date,
               'city', e.city, 'status', e.status, 'published', e.published, 'invitation_status', e.invitation_status,
               'plan_key', pl.plan_key, 'plan_origin', pl.origin, 'addons', private.admin_event_addons(e.id),
               'guests', e.guests, 'rsvp_confirmed', e.rsvp_confirmed, 'rsvp_pending', e.rsvp_pending,
               'rsvp_declined', e.rsvp_declined, 'checked_in', e.checked_in, 'photos', e.photos,
               'role', m.role)
             order by e.event_date)
        from (
          -- Lo mismo que ve el cliente: los eventos de sus organizaciones
          -- (dueño) y aquellos donde es parte del equipo.
          select distinct on (x.event_id) x.event_id, x.role
            from (
              select ev.id as event_id, om.role
                from public.organization_members om
                join public.events ev on ev.organization_id = om.organization_id
               where om.profile_id = s.target_user_id
              union all
              select em.event_id, em.role
                from public.event_members em
               where em.profile_id = s.target_user_id
            ) x
           order by x.event_id, (x.role = 'owner') desc
        ) m
        join private.admin_events e on e.id = m.event_id
        left join lateral private.admin_event_plan(e.id) pl on true), '[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'at', coalesce(p.paid_at, p.created_at), 'item_name', p.item_name,
                                          'total_cents', p.amount_total_cents, 'display_status', p.display_status)
                       order by p.created_at desc)
        from private.admin_user_purchases p where p.user_id = s.target_user_id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_start_view_as(uuid, text) from public, anon;
revoke execute on function public.admin_end_view_as(uuid) from public, anon;
revoke execute on function public.admin_view_as(uuid) from public, anon;
grant execute on function public.admin_start_view_as(uuid, text) to authenticated;
grant execute on function public.admin_end_view_as(uuid) to authenticated;
grant execute on function public.admin_view_as(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Gastos recurrentes
-- -----------------------------------------------------------------------------

create table if not exists public.admin_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  concept text not null check (length(trim(concept)) > 0),
  category text not null check (category <> 'retiro'),
  vendor text,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer generated always as (subtotal_cents + tax_cents) stored,
  periodicity text not null check (periodicity in ('mensual', 'anual')),
  start_date date not null,
  next_charge_date date not null,
  -- Ancla del calendario: cobro n = anchor_date + n periodos (sin deriva en
  -- días 29-31). Se reinicia si cambian la fecha o la periodicidad.
  anchor_date date not null,
  occurrences_generated integer not null default 0,
  status text not null default 'activo' check (status in ('activo', 'cancelado')),
  cancelled_at timestamptz,
  payment_method text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_recurring_expenses_dates check (next_charge_date >= start_date)
);

comment on table public.admin_recurring_expenses is
  'Plantillas de gastos recurrentes. private.generate_recurring_expenses crea cada cobro como gasto en su fecha (idempotente), desde next_charge_date: nunca rellena hacia atrás.';

alter table public.admin_expenses
  add column if not exists recurring_expense_id uuid references public.admin_recurring_expenses (id) on delete set null,
  add column if not exists occurrence_date date;

create unique index if not exists admin_expenses_recurring_occurrence_key
  on public.admin_expenses (recurring_expense_id, occurrence_date)
  where recurring_expense_id is not null;

alter table public.admin_recurring_expenses enable row level security;
revoke all on public.admin_recurring_expenses from public, anon, authenticated;
grant select on public.admin_recurring_expenses to authenticated;
grant all on public.admin_recurring_expenses to service_role;
drop policy if exists admin_recurring_expenses_select_perm on public.admin_recurring_expenses;
create policy admin_recurring_expenses_select_perm on public.admin_recurring_expenses
  for select to authenticated using (private.has_admin_permission('gastos.read'));

drop trigger if exists admin_recurring_expenses_audit on public.admin_recurring_expenses;
create trigger admin_recurring_expenses_audit
  after insert or update or delete on public.admin_recurring_expenses
  for each row execute function private.audit_admin_row_change();

drop trigger if exists admin_recurring_expenses_touch on public.admin_recurring_expenses;
create trigger admin_recurring_expenses_touch
  before update on public.admin_recurring_expenses
  for each row execute function private.touch_updated_at();

-- Crea los cobros vencidos (hasta hoy, CDMX). Idempotente.
create or replace function private.generate_recurring_expenses(p_today date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := coalesce(p_today, private.mx_today());
  v_step interval;
  v_count integer := 0;
  r record;
begin
  perform set_config('app.audit_reason', 'Gasto recurrente generado automáticamente', true);
  for r in
    select * from public.admin_recurring_expenses
     where status = 'activo' and next_charge_date <= v_today
     for update
  loop
    v_step := case r.periodicity when 'mensual' then interval '1 month' else interval '1 year' end;
    while r.next_charge_date <= v_today loop
      insert into public.admin_expenses (
        expense_date, concept, category, vendor, subtotal_cents, tax_cents, expense_type, periodicity,
        payment_method, notes, recurring_expense_id, occurrence_date
      ) values (
        r.next_charge_date, r.concept, r.category, r.vendor, r.subtotal_cents, r.tax_cents, 'fijo', r.periodicity,
        r.payment_method, 'Generado desde Suscripciones y servicios', r.id, r.next_charge_date
      )
      on conflict do nothing;
      r.occurrences_generated := r.occurrences_generated + 1;
      r.next_charge_date := (r.anchor_date + v_step * r.occurrences_generated)::date;
      v_count := v_count + 1;
    end loop;
    update public.admin_recurring_expenses
       set next_charge_date = r.next_charge_date, occurrences_generated = r.occurrences_generated
     where id = r.id;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.generate_recurring_expenses(date) from public, anon, authenticated;

-- Alta, edición y cancelación (motivo obligatorio, va a la bitácora).
create or replace function public.admin_save_recurring_expense(p_id uuid, p_data jsonb, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_id uuid := p_id;
  v_old record;
  v_next date := nullif(p_data ->> 'next_charge_date', '')::date;
  v_period text := p_data ->> 'periodicity';
  v_status text := coalesce(p_data ->> 'status', 'activo');
begin
  perform private.require_admin_permission('gastos.write');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  if v_status not in ('activo', 'cancelado') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  perform set_config('app.audit_reason', v_reason, true);

  if v_id is null then
    insert into public.admin_recurring_expenses (
      concept, category, vendor, subtotal_cents, tax_cents, periodicity, start_date, next_charge_date,
      anchor_date, payment_method, notes, created_by
    ) values (
      p_data ->> 'concept', p_data ->> 'category', nullif(p_data ->> 'vendor', ''),
      (p_data ->> 'subtotal_cents')::integer, coalesce((p_data ->> 'tax_cents')::integer, 0), v_period,
      (p_data ->> 'start_date')::date, v_next, v_next,
      nullif(p_data ->> 'payment_method', ''), nullif(p_data ->> 'notes', ''), auth.uid()
    )
    returning id into v_id;
  else
    select * into v_old from public.admin_recurring_expenses where id = v_id for update;
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    update public.admin_recurring_expenses
       set concept = p_data ->> 'concept',
           category = p_data ->> 'category',
           vendor = nullif(p_data ->> 'vendor', ''),
           subtotal_cents = (p_data ->> 'subtotal_cents')::integer,
           tax_cents = coalesce((p_data ->> 'tax_cents')::integer, 0),
           periodicity = v_period,
           start_date = (p_data ->> 'start_date')::date,
           next_charge_date = v_next,
           anchor_date = case when v_next is distinct from v_old.next_charge_date or v_period is distinct from v_old.periodicity
                              then v_next else v_old.anchor_date end,
           occurrences_generated = case when v_next is distinct from v_old.next_charge_date or v_period is distinct from v_old.periodicity
                                        then 0 else v_old.occurrences_generated end,
           payment_method = nullif(p_data ->> 'payment_method', ''),
           notes = nullif(p_data ->> 'notes', ''),
           status = v_status,
           cancelled_at = case when v_status = 'cancelado' then coalesce(v_old.cancelled_at, now()) end
     where id = v_id;
  end if;

  -- Si la próxima fecha ya pasó, el cobro se registra de inmediato.
  perform private.generate_recurring_expenses();
  return v_id;
end;
$$;

revoke execute on function public.admin_save_recurring_expense(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_save_recurring_expense(uuid, jsonb, text) to authenticated;

-- Suscripciones y servicios: costo mensual equivalente (anual / 12).
create or replace function public.admin_subscriptions()
returns table (
  id uuid, concept text, category text, vendor text, periodicity text, subtotal_cents integer, tax_cents integer,
  total_cents integer, monthly_equivalent_cents integer, start_date date, next_charge_date date, status text,
  payment_method text, notes text, days_to_next integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_permission('gastos.read');
  return query
  select r.id, r.concept, r.category, r.vendor, r.periodicity, r.subtotal_cents, r.tax_cents, r.total_cents,
         case r.periodicity when 'mensual' then r.total_cents
              else private.mul_div_round(r.total_cents, 1, 12)::integer end,
         r.start_date, r.next_charge_date, r.status, r.payment_method, r.notes,
         (r.next_charge_date - private.mx_today())::integer
    from public.admin_recurring_expenses r
   order by r.status, r.next_charge_date;
end;
$$;

revoke execute on function public.admin_subscriptions() from public, anon;
grant execute on function public.admin_subscriptions() to authenticated;

-- pg_cron (Supabase Cron). 06:15 UTC = 00:15 en Ciudad de México.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule('admin-recurring-expenses', '15 6 * * *', $$select private.generate_recurring_expenses()$$);

-- -----------------------------------------------------------------------------
-- 7. Alerta azul: renovación anual a 15 días o menos
-- -----------------------------------------------------------------------------

create or replace view private.admin_alerts as
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
union all
select 'evento_sin_publicar', 'amarillo', 'Evento próximo sin invitación publicada',
       e.name || ' · ' || to_char(e.event_date, 'DD/MM/YYYY'), e.event_date::timestamptz, 'event', e.id::text
  from private.admin_events e
 where e.status = 'proximo' and not e.published and not e.is_staff_owner
union all
select 'evento_sin_invitados', 'amarillo', 'Evento próximo sin invitados',
       e.name || ' · ' || to_char(e.event_date, 'DD/MM/YYYY'), e.event_date::timestamptz, 'event', e.id::text
  from private.admin_events e
 where e.status = 'proximo' and e.guests = 0 and not e.is_staff_owner
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
 where p.paid_at is not null and p.stripe_fee_cents is null and p.paid_at < now() - interval '1 hour'
union all
select 'renovacion_anual', 'azul', 'Renovación anual próxima',
       r.concept || ' · ' || to_char(r.next_charge_date, 'DD/MM/YYYY') || ' · '
         || to_char(r.total_cents / 100.0, 'FM$999,999,990.00'),
       r.next_charge_date::timestamptz, 'expense', r.id::text
  from public.admin_recurring_expenses r
 where r.status = 'activo' and r.periodicity = 'anual'
   and r.next_charge_date - private.mx_today() between 0 and 15;

revoke all on private.admin_alerts from public, anon, authenticated;

-- Renovaciones solo para quien ve gastos.
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
declare
  v_expenses boolean;
begin
  perform private.require_admin_permission('alertas.read');
  v_expenses := private.has_admin_permission('gastos.read');
  return query
  select a.kind, a.severity, a.title, a.detail, a.occurred_at, a.target_type, a.target_id
    from private.admin_alerts a
   where (p_kind is null or a.kind = p_kind)
     and (a.kind <> 'renovacion_anual' or v_expenses)
   order by case a.severity when 'rojo' then 0 when 'amarillo' then 1 else 2 end,
            a.occurred_at desc nulls last
   limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

create or replace function public.admin_alert_counts()
returns table (kind text, severity text, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_expenses boolean;
begin
  perform private.require_admin_permission('alertas.read');
  v_expenses := private.has_admin_permission('gastos.read');
  return query
  select a.kind, a.severity, count(*)::integer
    from private.admin_alerts a
   where a.kind <> 'renovacion_anual' or v_expenses
   group by a.kind, a.severity
   order by case a.severity when 'rojo' then 0 when 'amarillo' then 1 else 2 end, count(*) desc;
end;
$$;

notify pgrst, 'reload schema';
