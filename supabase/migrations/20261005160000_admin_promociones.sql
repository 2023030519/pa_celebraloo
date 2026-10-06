-- Celebraloo — Panel Admin V2 · Fase 4: promociones sincronizadas con Stripe
--
-- Requiere 20261005100000 … 20261005150000.
--
-- Stripe es la fuente de verdad: el panel crea el Coupon y el Promotion Code
-- en Stripe (applies_to = productos de planes y complementos,
-- max_redemptions, expires_at) y aquí guarda la copia con sus ids. Los usos
-- se sincronizan desde Stripe. Cupones, descuentos y promociones de
-- lanzamiento son todos códigos que el cliente escribe en el checkout de
-- Stripe (no hay descuentos automáticos).
--
-- 1. admin_promotions + historial de ids de Stripe (un Coupon de Stripe no
--    se puede editar: cambiar el descuento crea uno nuevo con el mismo código).
-- 2. plans/addons.stripe_product_id (ya existen; aquí solo se documentan): el
--    checkout los usa para que applies_to funcione.
-- 3. Descuento por compra: purchases.amount_total_cents pasa a ser lo
--    COBRADO; list_amount_cents guarda el precio antes del descuento. Así
--    IVA, comisión, neto, ingresos y reportes salen bien sin tocar fórmulas.
-- 4. record_stripe_payment_success acepta subtotal y descuento (antes un
--    cupón marcaba amount_mismatch y el cliente no recibía su plan).
-- 5. Lecturas y escrituras del panel con permisos y bitácora.

-- -----------------------------------------------------------------------------
-- 1. Promociones
-- -----------------------------------------------------------------------------

create table if not exists public.admin_promotions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('cupon', 'descuento', 'lanzamiento')),
  name text not null check (length(trim(name)) > 0),
  code text not null check (code ~ '^[A-Z0-9_-]{3,40}$'),
  discount_type text not null check (discount_type in ('percent', 'amount')),
  percent_off numeric(5, 2) check (percent_off > 0 and percent_off <= 100),
  amount_off_cents integer check (amount_off_cents > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_redemptions integer check (max_redemptions > 0),
  -- Usos de códigos anteriores (ya reemplazados) + usos del código actual.
  redeemed_before integer not null default 0,
  times_redeemed integer not null default 0,
  times_redeemed_synced_at timestamptz,
  applies_to_plans text[] not null default '{}',
  applies_to_addons text[] not null default '{}',
  is_active boolean not null default true,
  stripe_coupon_id text,
  stripe_promotion_code_id text,
  stripe_active boolean not null default false,
  stripe_history jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_promotions_discount check (
    (discount_type = 'percent' and percent_off is not null and amount_off_cents is null)
    or (discount_type = 'amount' and amount_off_cents is not null and percent_off is null)
  ),
  constraint admin_promotions_dates check (expires_at is null or expires_at > starts_at),
  constraint admin_promotions_applies check (cardinality(applies_to_plans) + cardinality(applies_to_addons) > 0)
);

comment on table public.admin_promotions is
  'Copia de los cupones de Stripe (fuente de verdad). stripe_history guarda los Coupon/Promotion Code anteriores de la misma promoción. times_redeemed = redeemed_before + usos del código actual en Stripe.';

create unique index if not exists admin_promotions_code_active_key
  on public.admin_promotions (upper(code)) where is_active;
create unique index if not exists admin_promotions_stripe_code_key
  on public.admin_promotions (stripe_promotion_code_id) where stripe_promotion_code_id is not null;

alter table public.admin_promotions enable row level security;
revoke all on public.admin_promotions from public, anon, authenticated;
grant select on public.admin_promotions to authenticated;
grant all on public.admin_promotions to service_role;
drop policy if exists admin_promotions_select_perm on public.admin_promotions;
create policy admin_promotions_select_perm on public.admin_promotions
  for select to authenticated using (private.has_admin_permission('promociones.read'));

-- Bitácora: la etiqueta de una promoción es su código. Sincronizar usos no
-- es un cambio de nadie: no entra a la bitácora.
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
    when 'admin_promotions' then v_row->>'code'
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

drop trigger if exists admin_promotions_audit on public.admin_promotions;
create trigger admin_promotions_audit
  after insert or delete on public.admin_promotions
  for each row execute function private.audit_admin_row_change();

drop trigger if exists admin_promotions_audit_update on public.admin_promotions;
create trigger admin_promotions_audit_update
  after update on public.admin_promotions
  for each row
  when ((to_jsonb(old) - array['times_redeemed', 'times_redeemed_synced_at', 'stripe_active', 'updated_at'])
        is distinct from (to_jsonb(new) - array['times_redeemed', 'times_redeemed_synced_at', 'stripe_active', 'updated_at']))
  execute function private.audit_admin_row_change();

drop trigger if exists admin_promotions_touch on public.admin_promotions;
create trigger admin_promotions_touch
  before update on public.admin_promotions
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Productos de Stripe de planes y complementos (las columnas ya existen)
-- -----------------------------------------------------------------------------

alter table public.plans add column if not exists stripe_product_id text;
alter table public.addons add column if not exists stripe_product_id text;

comment on column public.plans.stripe_product_id is
  'Product de Stripe del plan. El checkout lo usa en price_data.product para que los cupones con applies_to apliquen.';

-- -----------------------------------------------------------------------------
-- 3. Descuento por compra
-- -----------------------------------------------------------------------------

alter table public.purchases
  add column if not exists list_amount_cents integer check (list_amount_cents >= 0),
  add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0),
  add column if not exists promotion_id uuid references public.admin_promotions (id) on delete set null,
  add column if not exists promotion_code text,
  add column if not exists stripe_coupon_id text,
  add column if not exists stripe_promotion_code_id text;

comment on column public.purchases.amount_total_cents is
  'Lo que se cobra. Antes del pago = precio de lista; al confirmar un pago con descuento pasa a lo cobrado (list_amount_cents guarda el precio de lista).';
comment on column public.purchases.discount_cents is
  'Descuento aplicado en Stripe (total_details.amount_discount). list_amount_cents - discount_cents = amount_total_cents.';

create index if not exists purchases_promotion_idx on public.purchases (promotion_id) where promotion_id is not null;

-- -----------------------------------------------------------------------------
-- 4. Confirmación de pago con descuento
-- -----------------------------------------------------------------------------
-- Mismo cuerpo que 20260914220000, con:
-- * p_amount_subtotal_cents / p_amount_discount_cents: si llegan, el precio de
--   lista de la compra debe ser el subtotal y el total = subtotal - descuento.
--   Sin ellos (webhook anterior) se compara el total como antes.
-- * Un reintento sobre una compra ya pagada compara contra list_amount_cents.
-- * Guarda el descuento, el código y la promoción del panel.

drop function if exists public.record_stripe_payment_success(text, text, text, text, integer, text, text, uuid);

create function public.record_stripe_payment_success(
  p_stripe_event_id text,
  p_event_type text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_amount_total_cents integer,
  p_currency text,
  p_stripe_price_id text,
  p_metadata_purchase_id uuid,
  p_amount_subtotal_cents integer default null,
  p_amount_discount_cents integer default null,
  p_promotion_code_id text default null,
  p_promotion_code text default null,
  p_coupon_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted boolean;
  v_purchase record;
  v_plan_price_id text;
  v_anomaly text;
  v_list integer;
  v_discount integer := coalesce(p_amount_discount_cents, 0);
  v_promotion_id uuid;
begin
  insert into public.stripe_webhook_events (id, event_type, processing_status)
  values (p_stripe_event_id, p_event_type, 'processed')
  on conflict (id) do nothing;

  get diagnostics v_inserted = row_count;
  if not v_inserted then
    return;
  end if;

  select id, event_id, payment_status, amount_total_cents, list_amount_cents, currency, provider, billing_mode
    into v_purchase
    from public.purchases
    where provider_checkout_session_id = p_checkout_session_id
    for update;

  if found then
    v_list := coalesce(v_purchase.list_amount_cents, v_purchase.amount_total_cents);
  end if;

  if v_list is null then
    v_anomaly := 'purchase_not_found_for_checkout_session';
  elsif v_purchase.provider <> 'stripe' then
    v_anomaly := 'provider_mismatch';
  elsif p_metadata_purchase_id is not null and p_metadata_purchase_id <> v_purchase.id then
    v_anomaly := 'metadata_purchase_id_mismatch';
  elsif p_amount_subtotal_cents is null and v_list <> p_amount_total_cents then
    v_anomaly := 'amount_mismatch';
  elsif p_amount_subtotal_cents is not null and v_list <> p_amount_subtotal_cents then
    v_anomaly := 'amount_mismatch';
  elsif p_amount_subtotal_cents is not null
        and (v_discount < 0 or v_discount > p_amount_subtotal_cents
             or p_amount_total_cents <> p_amount_subtotal_cents - v_discount) then
    v_anomaly := 'discount_mismatch';
  elsif upper(v_purchase.currency) <> upper(coalesce(p_currency, '')) then
    v_anomaly := 'currency_mismatch';
  elsif v_purchase.payment_status = 'paid' then
    v_anomaly := null;
  elsif v_purchase.payment_status not in ('pending') then
    v_anomaly := 'invalid_transition_from_' || v_purchase.payment_status;
  end if;

  if v_anomaly is null
     and p_stripe_price_id is not null
     and coalesce(v_purchase.billing_mode, 'catalog') <> 'prorated_upgrade' then
    select p.stripe_price_id into v_plan_price_id
      from public.purchase_items pi
      join public.plans p on p.key = pi.plan_key
      where pi.purchase_id = v_purchase.id and pi.item_type = 'plan';

    if v_plan_price_id is not null and v_plan_price_id <> p_stripe_price_id then
      v_anomaly := 'price_id_mismatch';
    end if;
  end if;

  if v_anomaly is not null then
    update public.stripe_webhook_events
      set processing_status = 'anomaly', error_reason = v_anomaly, purchase_id = v_purchase.id
      where id = p_stripe_event_id;
    return;
  end if;

  update public.stripe_webhook_events set purchase_id = v_purchase.id where id = p_stripe_event_id;

  if v_purchase.payment_status = 'paid' then
    return;
  end if;

  if v_discount > 0 then
    select ap.id into v_promotion_id
      from public.admin_promotions ap
     where ap.stripe_promotion_code_id = p_promotion_code_id
        or ap.stripe_coupon_id = p_coupon_id
        or ap.stripe_history @> jsonb_build_array(jsonb_build_object('promotion_code_id', p_promotion_code_id))
        or ap.stripe_history @> jsonb_build_array(jsonb_build_object('coupon_id', p_coupon_id))
     limit 1;
  end if;

  update public.purchases
    set payment_status = 'paid',
        paid_at = now(),
        provider_payment_intent_id = coalesce(p_payment_intent_id, provider_payment_intent_id),
        list_amount_cents = v_list,
        amount_total_cents = case when p_amount_subtotal_cents is null then amount_total_cents else p_amount_total_cents end,
        discount_cents = case when p_amount_subtotal_cents is null then 0 else v_discount end,
        promotion_id = v_promotion_id,
        promotion_code = case when v_discount > 0 then upper(p_promotion_code) end,
        stripe_coupon_id = case when v_discount > 0 then p_coupon_id end,
        stripe_promotion_code_id = case when v_discount > 0 then p_promotion_code_id end
    where id = v_purchase.id;

  if v_purchase.event_id is not null then
    perform public.apply_purchase_entitlements(v_purchase.id);
    perform private.clear_choose_plan_after_paid_plan(v_purchase.event_id, v_purchase.id);
  end if;
end;
$$;

revoke execute on function public.record_stripe_payment_success(text, text, text, text, integer, text, text, uuid, integer, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_stripe_payment_success(text, text, text, text, integer, text, text, uuid, integer, integer, text, text, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- 5. Panel
-- -----------------------------------------------------------------------------

-- Guarda una promoción ya creada/actualizada en Stripe (el servidor del panel
-- llama a Stripe primero y manda aquí los ids). Motivo obligatorio.
create or replace function public.admin_save_promotion(p_id uuid, p_data jsonb, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_id uuid := p_id;
begin
  perform private.require_admin_permission('promociones.write');
  if v_reason is null or length(v_reason) < 3 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  perform set_config('app.audit_reason', v_reason, true);

  if v_id is null then
    insert into public.admin_promotions (
      kind, name, code, discount_type, percent_off, amount_off_cents, starts_at, expires_at, max_redemptions,
      applies_to_plans, applies_to_addons, is_active, stripe_coupon_id, stripe_promotion_code_id, stripe_active, created_by
    ) values (
      p_data ->> 'kind', p_data ->> 'name', upper(p_data ->> 'code'), p_data ->> 'discount_type',
      nullif(p_data ->> 'percent_off', '')::numeric, nullif(p_data ->> 'amount_off_cents', '')::integer,
      (p_data ->> 'starts_at')::timestamptz, nullif(p_data ->> 'expires_at', '')::timestamptz,
      nullif(p_data ->> 'max_redemptions', '')::integer,
      coalesce(array(select jsonb_array_elements_text(p_data -> 'applies_to_plans')), '{}'),
      coalesce(array(select jsonb_array_elements_text(p_data -> 'applies_to_addons')), '{}'),
      coalesce((p_data ->> 'is_active')::boolean, true),
      p_data ->> 'stripe_coupon_id', p_data ->> 'stripe_promotion_code_id',
      coalesce((p_data ->> 'stripe_active')::boolean, false), auth.uid()
    )
    returning id into v_id;
  else
    update public.admin_promotions
       set kind = p_data ->> 'kind',
           name = p_data ->> 'name',
           code = upper(p_data ->> 'code'),
           discount_type = p_data ->> 'discount_type',
           percent_off = nullif(p_data ->> 'percent_off', '')::numeric,
           amount_off_cents = nullif(p_data ->> 'amount_off_cents', '')::integer,
           starts_at = (p_data ->> 'starts_at')::timestamptz,
           expires_at = nullif(p_data ->> 'expires_at', '')::timestamptz,
           max_redemptions = nullif(p_data ->> 'max_redemptions', '')::integer,
           applies_to_plans = coalesce(array(select jsonb_array_elements_text(p_data -> 'applies_to_plans')), '{}'),
           applies_to_addons = coalesce(array(select jsonb_array_elements_text(p_data -> 'applies_to_addons')), '{}'),
           is_active = coalesce((p_data ->> 'is_active')::boolean, is_active),
           stripe_active = coalesce((p_data ->> 'stripe_active')::boolean, stripe_active),
           -- Si cambió el Coupon de Stripe, el anterior pasa al historial con sus usos.
           stripe_history = case
             when p_data ->> 'stripe_coupon_id' is distinct from stripe_coupon_id and stripe_coupon_id is not null
               then stripe_history || jsonb_build_array(jsonb_build_object(
                      'coupon_id', stripe_coupon_id, 'promotion_code_id', stripe_promotion_code_id,
                      'times_redeemed', times_redeemed - redeemed_before, 'replaced_at', now()))
             else stripe_history end,
           redeemed_before = case
             when p_data ->> 'stripe_coupon_id' is distinct from stripe_coupon_id and stripe_coupon_id is not null
               then times_redeemed else redeemed_before end,
           stripe_coupon_id = p_data ->> 'stripe_coupon_id',
           stripe_promotion_code_id = p_data ->> 'stripe_promotion_code_id'
     where id = v_id;
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

-- Usos y estado en Stripe (sincronización; no es un cambio de nadie). La
-- llama el panel al abrir Promociones (con la sesión de quien entra) o la
-- tarea programada del servidor del panel (service role).
create or replace function public.admin_sync_promotion(p_id uuid, p_current_redeemed integer, p_stripe_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    perform private.require_admin_permission('promociones.read');
  end if;
  update public.admin_promotions
     set times_redeemed = redeemed_before + greatest(coalesce(p_current_redeemed, 0), 0),
         stripe_active = coalesce(p_stripe_active, stripe_active),
         times_redeemed_synced_at = now()
   where id = p_id;
end;
$$;

-- Product de Stripe de un plan o complemento.
create or replace function public.admin_set_stripe_product(p_kind text, p_key text, p_product_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_permission('promociones.write');
  if p_product_id !~ '^prod_[A-Za-z0-9]+$' then
    raise exception 'invalid product id' using errcode = '22023';
  end if;
  if p_kind = 'plan' then
    update public.plans set stripe_product_id = p_product_id where key = p_key;
  elsif p_kind = 'addon' then
    update public.addons set stripe_product_id = p_product_id where key = p_key;
  else
    raise exception 'invalid kind' using errcode = '22023';
  end if;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  perform private.log_admin_action('stripe.product_link', p_kind, p_key, p_key,
                                   jsonb_build_object('stripe_product_id', p_product_id), null);
end;
$$;

-- Lista con el efecto de cada promoción (ventas de Stripe sin staff).
create or replace function public.admin_promotions_list()
returns table (
  id uuid, kind text, name text, code text, discount_type text, percent_off numeric, amount_off_cents integer,
  starts_at timestamptz, expires_at timestamptz, max_redemptions integer, times_redeemed integer,
  times_redeemed_synced_at timestamptz, applies_to_plans text[], applies_to_addons text[], is_active boolean,
  stripe_active boolean, stripe_coupon_id text, stripe_promotion_code_id text, status text,
  ventas integer, descuento_total_cents bigint, cobrado_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_permission('promociones.read');
  return query
  select a.id, a.kind, a.name, a.code, a.discount_type, a.percent_off, a.amount_off_cents,
         a.starts_at, a.expires_at, a.max_redemptions, a.times_redeemed, a.times_redeemed_synced_at,
         a.applies_to_plans, a.applies_to_addons, a.is_active, a.stripe_active, a.stripe_coupon_id,
         a.stripe_promotion_code_id,
         case
           when not a.is_active then 'inactiva'
           when a.expires_at is not null and a.expires_at <= now() then 'vencida'
           when a.max_redemptions is not null and a.times_redeemed >= a.max_redemptions then 'agotada'
           when a.starts_at > now() then 'programada'
           else 'activa'
         end,
         coalesce(s.ventas, 0)::integer, coalesce(s.descuento, 0)::bigint, coalesce(s.cobrado, 0)::bigint
    from public.admin_promotions a
    left join lateral (
      select count(*) as ventas, sum(pu.discount_cents) as descuento, sum(pu.amount_total_cents) as cobrado
        from public.purchases pu
        join private.admin_purchases p on p.id = pu.id
       where pu.promotion_id = a.id and p.paid_at is not null
    ) s on true
   order by a.is_active desc, a.created_at desc;
end;
$$;

-- Ficha de venta: agrega el descuento (precio de lista, descuento y código).
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
           'customer_id', p.user_id,
           'customer_name', nullif(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''),
           'event_name', e.name,
           'discount', case when pu.discount_cents > 0 then jsonb_build_object(
               'list_amount_cents', pu.list_amount_cents,
               'discount_cents', pu.discount_cents,
               'promotion_code', pu.promotion_code,
               'promotion_id', pu.promotion_id,
               'promotion_name', ap.name
             ) end,
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
    join public.purchases pu on pu.id = p.id
    left join public.admin_promotions ap on ap.id = pu.promotion_id
    left join public.profiles pr on pr.id = p.user_id
    left join public.events e on e.id = p.event_id
   where p.id = p_purchase_id;
  return v_result;
end;
$$;

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.admin_save_promotion(uuid, jsonb, text)',
    'public.admin_sync_promotion(uuid, integer, boolean)',
    'public.admin_set_stripe_product(text, text, text)',
    'public.admin_promotions_list()'
  ] loop
    execute format('revoke execute on function %s from public, anon', v_fn);
    execute format('grant execute on function %s to authenticated', v_fn);
  end loop;
end;
$$;

grant execute on function public.admin_sync_promotion(uuid, integer, boolean) to service_role;

notify pgrst, 'reload schema';
