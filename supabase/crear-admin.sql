-- Da acceso al panel (superadmin) a una cuenta existente de Celebraloo.
-- Ejecútalo en Supabase → SQL Editor, cambiando el correo.
-- La cuenta debe existir en auth.users; si aún no tiene perfil (no terminó el onboarding), se crea.
insert into public.profiles (id)
select u.id from auth.users u where u.email = 'CORREO@AQUI.COM'
on conflict (id) do nothing;

-- admin_role es lo que lee admin_my_permissions; el trigger deriva is_platform_admin/is_super_admin.
insert into public.celebraloo_staff (profile_id, department, admin_role)
select u.id, 'admin', 'superadmin'
from auth.users u
where u.email = 'CORREO@AQUI.COM'
on conflict (profile_id) do update set admin_role = 'superadmin';
