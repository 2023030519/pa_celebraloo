-- Celebraloo — Panel Admin V2 · Fase 1: fuente de adquisición y última actividad
--
-- Adquisición: Celebraloo guarda UTM, referrer y página de entrada en una
-- cookie de primera visita y los manda en signUp como
-- raw_user_meta_data.acquisition. El perfil no nace al registrarse (nace en
-- el onboarding o al reclamar una compra), así que se copian al perfil cuando
-- éste se crea. Mientras no hay perfil, el panel los lee de auth.users.
-- Quien se registró antes de esto no tiene acquisition: "Sin dato".
--
-- Última actividad: profiles.last_seen_at, a lo más una escritura cada 15
-- minutos por usuario (guarda en SQL + cookie en el proxy de Celebraloo).

alter table public.profiles
  add column if not exists acq_utm_source text,
  add column if not exists acq_utm_medium text,
  add column if not exists acq_utm_campaign text,
  add column if not exists acq_utm_term text,
  add column if not exists acq_utm_content text,
  add column if not exists acq_referrer text,
  add column if not exists acq_landing_path text,
  add column if not exists acq_captured_at timestamptz,
  add column if not exists last_seen_at timestamptz;

comment on column public.profiles.acq_captured_at is
  'Cuándo se capturó la fuente (primera visita). NULL = usuario anterior a la captura: "Sin dato". Con fecha y sin UTM ni referrer: "Directo".';
comment on column public.profiles.last_seen_at is
  'Última actividad en Celebraloo. Se actualiza a lo más cada 15 minutos (public.touch_last_seen).';

-- authenticated solo puede actualizar first_name y last_name (grants por
-- columna): estas columnas no son editables por el cliente.

-- -----------------------------------------------------------------------------
-- 1. Adquisición
-- -----------------------------------------------------------------------------

create or replace function private.clean_acq(p_value text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(p_value), p_max), '');
$$;

-- Al crear el perfil, copia la fuente desde los metadatos del registro.
create or replace function private.profiles_copy_acquisition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acq jsonb;
begin
  if new.acq_captured_at is not null then
    return new;
  end if;
  select u.raw_user_meta_data -> 'acquisition' into v_acq from auth.users u where u.id = new.id;
  if v_acq is null or jsonb_typeof(v_acq) <> 'object' then
    return new;
  end if;
  new.acq_utm_source := private.clean_acq(v_acq ->> 'utm_source', 120);
  new.acq_utm_medium := private.clean_acq(v_acq ->> 'utm_medium', 120);
  new.acq_utm_campaign := private.clean_acq(v_acq ->> 'utm_campaign', 200);
  new.acq_utm_term := private.clean_acq(v_acq ->> 'utm_term', 200);
  new.acq_utm_content := private.clean_acq(v_acq ->> 'utm_content', 200);
  new.acq_referrer := private.clean_acq(v_acq ->> 'referrer', 500);
  new.acq_landing_path := private.clean_acq(v_acq ->> 'landing_path', 500);
  new.acq_captured_at := coalesce(
    case when (v_acq ->> 'captured_at') ~ '^\d{4}-\d{2}-\d{2}T' then (v_acq ->> 'captured_at')::timestamptz end,
    now()
  );
  return new;
end;
$$;

revoke execute on function private.profiles_copy_acquisition() from public, anon, authenticated;

drop trigger if exists profiles_copy_acquisition on public.profiles;
create trigger profiles_copy_acquisition
  before insert on public.profiles
  for each row execute function private.profiles_copy_acquisition();

-- Canal legible para reportes: UTM source > dominio del referrer > Directo;
-- sin captura, "Sin dato".
create or replace function private.acquisition_channel(
  p_utm_source text,
  p_referrer text,
  p_captured_at timestamptz
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_captured_at is null then 'Sin dato'
    when nullif(btrim(p_utm_source), '') is not null then lower(btrim(p_utm_source))
    when nullif(btrim(p_referrer), '') is not null
      then coalesce(substring(lower(p_referrer) from '^[a-z]+://(?:www\.)?([^/:?#]+)'), 'Otro sitio')
    else 'Directo'
  end;
$$;

revoke execute on function private.clean_acq(text, integer) from public, anon, authenticated;
revoke execute on function private.acquisition_channel(text, text, timestamptz) from public, anon;

-- -----------------------------------------------------------------------------
-- 2. Última actividad
-- -----------------------------------------------------------------------------

create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '15 minutes');
$$;

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Que la actividad no cuente como "perfil editado": updated_at solo se mueve
-- si cambió algo además de last_seen_at.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  when ((to_jsonb(old) - 'last_seen_at' - 'updated_at') is distinct from (to_jsonb(new) - 'last_seen_at' - 'updated_at'))
  execute function public.set_updated_at();

notify pgrst, 'reload schema';
