-- Da acceso al panel a una cuenta existente de Celebraloo.
-- Ejecútalo en Supabase → SQL Editor, cambiando el correo.
-- La cuenta debe haberse registrado antes en Celebraloo (necesita perfil).
insert into public.celebraloo_staff (profile_id, department, is_platform_admin)
select p.id, 'admin', true
from public.profiles p
join auth.users u on u.id = p.id
where u.email = 'CORREO@AQUI.COM'
on conflict (profile_id) do update set is_platform_admin = true;
