-- Celebraloo — Panel Admin V2 · Fase 1: roles de staff y matriz de permisos
--
-- Requiere las migraciones del Panel V1 de Celebraloo hasta 20261002100000.
-- (20261003100000_admin_catalog_overview no está aplicada y no se necesita.)
--
-- 1. celebraloo_staff.admin_role: superadmin | administracion | soporte |
--    finanzas. NULL = sin acceso al panel. No se reutiliza department:
--    'soporte' ahí ya da acceso a Invitación (can_view_invitation_staff).
-- 2. is_platform_admin / is_super_admin se derivan del rol (los siguen
--    leyendo funciones y políticas de Celebraloo). Soporte y Finanzas NO
--    reciben is_platform_admin: no editan permisos ni actúan como staff de
--    Invitación.
-- 3. admin_role_permissions: la matriz vive en datos. Cada RPC del panel
--    exige un permiso con private.require_admin_permission().
-- 4. set_staff_role reemplaza a set_platform_admin_role: motivo obligatorio
--    y bitácora.
-- 5. RLS de las tablas del panel por permiso, no por is_super_admin.

-- -----------------------------------------------------------------------------
-- 1. Rol
-- -----------------------------------------------------------------------------

alter table public.celebraloo_staff
  add column if not exists admin_role text;

alter table public.celebraloo_staff
  drop constraint if exists celebraloo_staff_admin_role_check;
alter table public.celebraloo_staff
  add constraint celebraloo_staff_admin_role_check
  check (admin_role in ('superadmin', 'administracion', 'soporte', 'finanzas'));

comment on column public.celebraloo_staff.admin_role is
  'Rol del panel admin. NULL = sin acceso. Define is_platform_admin (superadmin, administracion) e is_super_admin (superadmin).';

update public.celebraloo_staff
   set admin_role = case when is_super_admin then 'superadmin' else 'administracion' end
 where admin_role is null and is_platform_admin;

-- Solo actúa cuando se escribe admin_role: una fila de staff sin rol de panel
-- (p. ej. diseño) conserva sus flags como estén.
create or replace function private.sync_staff_flags()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.admin_role is null then
    return new;
  end if;
  new.is_super_admin := new.admin_role is not distinct from 'superadmin';
  new.is_platform_admin := coalesce(new.admin_role in ('superadmin', 'administracion'), false);
  return new;
end;
$$;

revoke execute on function private.sync_staff_flags() from public, anon, authenticated;

drop trigger if exists celebraloo_staff_sync_flags on public.celebraloo_staff;
create trigger celebraloo_staff_sync_flags
  before insert or update of admin_role on public.celebraloo_staff
  for each row execute function private.sync_staff_flags();

-- -----------------------------------------------------------------------------
-- 2. Matriz de permisos
-- -----------------------------------------------------------------------------

create table if not exists public.admin_role_permissions (
  role text not null check (role in ('superadmin', 'administracion', 'soporte', 'finanzas')),
  permission text not null check (permission ~ '^[a-z_]+\.[a-z_]+$'),
  primary key (role, permission)
);

comment on table public.admin_role_permissions is
  'Matriz rol → acción del panel. La UI la usa para ocultar; la regla real está en cada RPC (require_admin_permission) y en RLS.';

insert into public.admin_role_permissions (role, permission)
select r, p
from (values
  ('inicio.read',                   array['superadmin', 'administracion', 'soporte', 'finanzas']),
  ('alertas.read',                  array['superadmin', 'administracion', 'soporte', 'finanzas']),
  ('ventas.read',                   array['superadmin', 'administracion', 'soporte', 'finanzas']),
  -- Desglose por venta: subtotal, IVA, comisión de Stripe y neto.
  ('ventas.financiero',             array['superadmin', 'administracion', 'finanzas']),
  -- Dinero agregado: ingresos, disponible, IVA, utilidad, apartados.
  ('finanzas.read',                 array['superadmin', 'finanzas']),
  ('gastos.read',                   array['superadmin', 'finanzas']),
  ('gastos.write',                  array['superadmin', 'finanzas']),
  ('reportes.read',                 array['superadmin', 'finanzas']),
  ('metricas.read',                 array['superadmin', 'administracion', 'finanzas']),
  ('promociones.read',              array['superadmin', 'finanzas']),
  ('promociones.write',             array['superadmin', 'finanzas']),
  ('clientes.read',                 array['superadmin', 'administracion', 'soporte', 'finanzas']),
  ('eventos.read',                  array['superadmin', 'administracion', 'soporte', 'finanzas']),
  ('actividad.read',                array['superadmin', 'administracion', 'finanzas']),
  ('notas.write',                   array['superadmin', 'administracion', 'soporte', 'finanzas']),
  ('clientes.reenviar_confirmacion', array['superadmin', 'administracion', 'soporte']),
  ('clientes.suspender',            array['superadmin', 'administracion']),
  ('clientes.borrar',               array['superadmin']),
  ('clientes.plan_gratis',          array['superadmin']),
  ('clientes.ver_como',             array['superadmin']),
  ('eventos.permisos',              array['superadmin', 'administracion']),
  ('eventos.asignar_plan',          array['superadmin', 'administracion']),
  ('eventos.cortesia',              array['superadmin', 'administracion']),
  ('eventos.desbloquear',           array['superadmin']),
  ('eventos.borrar',                array['superadmin']),
  ('planes.read',                   array['superadmin', 'administracion', 'finanzas']),
  ('planes.write',                  array['superadmin']),
  ('config.write',                  array['superadmin']),
  ('roles.write',                   array['superadmin'])
) as m (p, roles),
lateral unnest(m.roles) as r
on conflict do nothing;

create or replace function private.admin_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select admin_role from public.celebraloo_staff where profile_id = auth.uid();
$$;

create or replace function private.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.celebraloo_staff s
      join public.admin_role_permissions m on m.role = s.admin_role
     where s.profile_id = auth.uid() and m.permission = p_permission
  );
$$;

create or replace function private.require_admin_permission(p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_admin_permission(p_permission) then
    raise exception 'missing admin permission %', p_permission using errcode = '42501';
  end if;
end;
$$;

-- Lo que puede hacer quien llama. El panel lo usa para el menú y para ocultar
-- botones; sin fila = sin acceso al panel.
create or replace function public.admin_my_permissions()
returns table (role text, permission text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.admin_role, m.permission
    from public.celebraloo_staff s
    join public.admin_role_permissions m on m.role = s.admin_role
   where s.profile_id = auth.uid();
$$;

revoke execute on function private.admin_role() from public, anon;
revoke execute on function private.has_admin_permission(text) from public, anon;
revoke execute on function private.require_admin_permission(text) from public, anon;
revoke execute on function public.admin_my_permissions() from public, anon;
grant execute on function private.admin_role() to authenticated;
grant execute on function private.has_admin_permission(text) to authenticated;
grant execute on function private.require_admin_permission(text) to authenticated;
grant execute on function public.admin_my_permissions() to authenticated;

alter table public.admin_role_permissions enable row level security;
revoke all on public.admin_role_permissions from public, anon, authenticated;
grant select on public.admin_role_permissions to authenticated;
grant all on public.admin_role_permissions to service_role;

drop policy if exists admin_role_permissions_select_staff on public.admin_role_permissions;
create policy admin_role_permissions_select_staff
  on public.admin_role_permissions for select to authenticated
  using (private.admin_role() is not null);

-- -----------------------------------------------------------------------------
-- 3. Cambiar el rol de una cuenta
-- -----------------------------------------------------------------------------

create or replace function public.set_staff_role(p_profile_id uuid, p_role text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before text;
  v_email text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform private.require_admin_permission('roles.write');
  if p_role is not null and p_role not in ('superadmin', 'administracion', 'soporte', 'finanzas') then
    raise exception 'invalid role %', p_role using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'reason required' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = p_profile_id;
  if v_email is null or not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  -- Serializa cambios simultáneos (regla de "al menos un superadmin").
  perform 1 from public.celebraloo_staff where admin_role = 'superadmin' for update;
  select admin_role into v_before from public.celebraloo_staff where profile_id = p_profile_id;

  if p_role is null then
    -- La fila de staff se queda (puede ser de diseño u otro departamento).
    update public.celebraloo_staff set admin_role = null where profile_id = p_profile_id;
  else
    insert into public.celebraloo_staff (profile_id, department, admin_role)
    values (p_profile_id, 'admin', p_role)
    on conflict (profile_id) do update set admin_role = excluded.admin_role;
  end if;

  if not exists (select 1 from public.celebraloo_staff where admin_role = 'superadmin') then
    raise exception 'at least one super admin must remain' using errcode = '55000';
  end if;

  if v_before is distinct from p_role then
    perform private.log_admin_action(
      'staff.role', 'user', p_profile_id::text, v_email,
      jsonb_build_object('before', v_before, 'after', p_role), v_reason
    );
  end if;
end;
$$;

revoke execute on function public.set_staff_role(uuid, text, text) from public, anon;
grant execute on function public.set_staff_role(uuid, text, text) to authenticated;

-- Escribía los flags directo (se saltaría el rol). El panel ya no la usa.
drop function if exists public.set_platform_admin_role(uuid, text);

-- -----------------------------------------------------------------------------
-- 4. Cada RPC del panel exige su permiso
-- -----------------------------------------------------------------------------
-- Todas empiezan con exactamente un "perform private.require_super_admin();".
-- Se reescribe ese renglón sobre la definición vigente (no sobre una copia),
-- así no se pisa ningún ajuste que ya esté en la base. Si una no lo tiene,
-- la migración falla en vez de dejarla abierta.

do $$
declare
  m record;
  v_def text;
  v_new text;
begin
  for m in
    select * from (values
      ('public.admin_finance_summary(date, date)',                                   'finanzas.read'),
      ('public.admin_set_aside_breakdown(date, date)',                               'finanzas.read'),
      ('public.admin_sales_by_day(date, date)',                                      'finanzas.read'),
      ('public.admin_sales_by_product(date, date)',                                  'finanzas.read'),
      ('public.admin_sales(date, date, text, text, text, uuid, integer, integer)',   'ventas.read'),
      ('public.admin_sale_detail(uuid)',                                             'ventas.read'),
      ('public.admin_events(text, text, boolean, integer, integer)',                 'eventos.read'),
      ('public.admin_event_detail(uuid)',                                            'eventos.read'),
      ('public.admin_customers(text, text, integer, integer)',                       'clientes.read'),
      ('public.admin_customer_card(uuid)',                                           'clientes.read'),
      ('public.admin_operational_kpis(date, date)',                                  'inicio.read'),
      ('public.admin_attention_items()',                                             'alertas.read'),
      ('public.admin_monthly_report(date, integer)',                                 'reportes.read'),
      ('public.admin_catalog_stats()',                                               'planes.read'),
      ('public.admin_activity(integer, timestamp with time zone)',                   'actividad.read'),
      ('public.admin_delete_event(uuid, text, text)',                                'eventos.borrar'),
      ('public.reset_free_plan(text, text)',                                         'clientes.plan_gratis'),
      ('public.set_event_edit_unlock(uuid, timestamp with time zone, text)',         'eventos.desbloquear'),
      ('public.update_catalog_item(text, text, text, integer, boolean, text)',       'planes.write')
    ) as t (fn, permission)
  loop
    v_def := pg_get_functiondef(m.fn::regprocedure);
    v_new := replace(v_def, 'perform private.require_super_admin();',
                     format('perform private.require_admin_permission(%L);', m.permission));
    if v_new = v_def then
      raise exception 'require_super_admin no encontrado en %', m.fn;
    end if;
    execute v_new;
  end loop;

  -- Permisos por evento: hoy aceptan a cualquier admin de plataforma.
  for m in
    select * from (values
      ('public.set_event_capability_override(uuid, text, boolean, integer, text, text)'),
      ('public.clear_event_capability_override(uuid, text, text)')
    ) as t (fn)
  loop
    v_def := pg_get_functiondef(m.fn::regprocedure);
    v_new := replace(v_def, 'if not private.is_platform_admin() then',
                     'if not private.has_admin_permission(''eventos.permisos'') then');
    if v_new = v_def then
      raise exception 'is_platform_admin no encontrado en %', m.fn;
    end if;
    execute v_new;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Ventas: el desglose financiero solo con ventas.financiero
-- -----------------------------------------------------------------------------
-- Soporte ve la venta (cliente, producto, total, estado) pero no subtotal,
-- IVA, comisión ni neto. Se anulan aquí, no en la interfaz.

create or replace function public.admin_sales(
  p_from date,
  p_to date,
  p_status text,
  p_product text,
  p_search text,
  p_event_id uuid,
  p_limit integer,
  p_offset integer
)
returns table (
  id uuid, sale_at timestamptz, customer_id uuid, customer_email text, customer_name text,
  event_id uuid, event_name text, item_type text, item_name text,
  total_cents integer, tax_cents integer, stripe_fee_cents integer, net_cents integer,
  refunded_cents integer, display_status text, total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(lower(trim(coalesce(p_search, ''))), '');
  v_fin boolean;
begin
  perform private.require_admin_permission('ventas.read');
  v_fin := private.has_admin_permission('ventas.financiero');
  return query
  select p.id,
         coalesce(p.paid_at, p.created_at),
         p.profile_id,
         p.email,
         nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
         p.event_id,
         e.name,
         p.item_type,
         p.item_name,
         p.amount_total_cents,
         case when v_fin then p.tax_cents end,
         case when v_fin then p.stripe_fee_cents end,
         case when v_fin then p.net_cents end,
         p.refunded_cents,
         p.display_status,
         count(*) over ()
    from private.admin_purchases p
    left join public.profiles pr on pr.id = p.profile_id
    left join public.events e on e.id = p.event_id
   where (p_from is null or coalesce(p.paid_at, p.created_at) >= private.mx_start(p_from))
     and (p_to is null or coalesce(p.paid_at, p.created_at) < private.mx_start(p_to))
     and (p_status is null or p.display_status = p_status)
     and (p_product is null or p.item_type || ':' || p.item_key = p_product)
     and (p_event_id is null or p.event_id = p_event_id)
     and (v_search is null
          or lower(p.email) like '%' || v_search || '%'
          or lower(concat_ws(' ', pr.first_name, pr.last_name)) like '%' || v_search || '%'
          or lower(coalesce(e.name, '')) like '%' || v_search || '%'
          or p.id::text = v_search)
   order by coalesce(p.paid_at, p.created_at) desc
   limit least(greatest(coalesce(p_limit, 50), 1), 500)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

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
           'sale', case when v_fin then to_jsonb(p) - 'has_failed_attempt'
                        else to_jsonb(p) - 'has_failed_attempt' - v_hidden end,
           'financials_visible', v_fin,
           'has_failed_attempt', p.has_failed_attempt,
           'customer_name', nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
           'event_name', e.name,
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
    from private.admin_purchases p
    left join public.profiles pr on pr.id = p.profile_id
    left join public.events e on e.id = p.event_id
   where p.id = p_purchase_id;
  return v_result;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RLS de las tablas del panel por permiso
-- -----------------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('purchase_financials',   'purchase_financials_select_super',   'ventas.financiero'),
      ('purchase_refunds',      'purchase_refunds_select_super',      'ventas.read'),
      ('purchase_disputes',     'purchase_disputes_select_super',     'ventas.read'),
      ('admin_expenses',        'admin_expenses_select_super',        'gastos.read'),
      ('admin_notes',           'admin_notes_select_super',           'notas.write')
    ) as v (tbl, old_policy, permission)
  loop
    execute format('drop policy if exists %I on public.%I', t.old_policy, t.tbl);
    execute format('drop policy if exists %I on public.%I', t.tbl || '_select_perm', t.tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.has_admin_permission(%L))',
      t.tbl || '_select_perm', t.tbl, t.permission
    );
  end loop;
end;
$$;

-- Configuración y apartados: los lee Finanzas, los edita solo Superadmin.
drop policy if exists admin_settings_select_super on public.admin_settings;
drop policy if exists admin_settings_select_perm on public.admin_settings;
create policy admin_settings_select_perm on public.admin_settings for select to authenticated
  using (private.has_admin_permission('finanzas.read') or private.has_admin_permission('config.write'));

drop policy if exists admin_settings_update_super on public.admin_settings;
drop policy if exists admin_settings_update_perm on public.admin_settings;
create policy admin_settings_update_perm on public.admin_settings for update to authenticated
  using (private.has_admin_permission('config.write')) with check (private.has_admin_permission('config.write'));

drop policy if exists admin_set_aside_rules_select_super on public.admin_set_aside_rules;
drop policy if exists admin_set_aside_rules_select_perm on public.admin_set_aside_rules;
create policy admin_set_aside_rules_select_perm on public.admin_set_aside_rules for select to authenticated
  using (private.has_admin_permission('finanzas.read') or private.has_admin_permission('config.write'));

drop policy if exists admin_set_aside_rules_write_super on public.admin_set_aside_rules;
drop policy if exists admin_set_aside_rules_write_perm on public.admin_set_aside_rules;
create policy admin_set_aside_rules_write_perm on public.admin_set_aside_rules for all to authenticated
  using (private.has_admin_permission('config.write')) with check (private.has_admin_permission('config.write'));

drop policy if exists admin_expenses_write_super on public.admin_expenses;
drop policy if exists admin_expenses_write_perm on public.admin_expenses;
create policy admin_expenses_write_perm on public.admin_expenses for all to authenticated
  using (private.has_admin_permission('gastos.write')) with check (private.has_admin_permission('gastos.write'));

drop policy if exists admin_notes_insert_super on public.admin_notes;
drop policy if exists admin_notes_insert_perm on public.admin_notes;
create policy admin_notes_insert_perm on public.admin_notes for insert to authenticated
  with check (private.has_admin_permission('notas.write') and created_by = auth.uid());

-- Borrar una nota: quien la escribió, o superadmin.
drop policy if exists admin_notes_delete_super on public.admin_notes;
drop policy if exists admin_notes_delete_perm on public.admin_notes;
create policy admin_notes_delete_perm on public.admin_notes for delete to authenticated
  using (private.has_admin_permission('notas.write')
         and (created_by = auth.uid() or private.admin_role() = 'superadmin'));

drop policy if exists admin_audit_log_select_admin on public.admin_audit_log;
drop policy if exists admin_audit_log_select_perm on public.admin_audit_log;
create policy admin_audit_log_select_perm on public.admin_audit_log for select to authenticated
  using (private.has_admin_permission('actividad.read'));

-- Comprobación final: ninguna RPC del panel quedó con el chequeo viejo.
do $$
declare
  v_left text;
begin
  select string_agg(p.proname, ', ') into v_left
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) like '%private.require_super_admin()%';
  if v_left is not null then
    raise exception 'Quedan RPCs con require_super_admin: %', v_left;
  end if;
end;
$$;

notify pgrst, 'reload schema';
