# Celebraloo · Panel de administración

Panel interno para ver usuarios y eventos, y administrar los permisos y
complementos de cada evento. Usa el mismo proyecto de Supabase que Celebraloo.

## Puesta en marcha

1. **Llaves:** llena `.env.local` (ver `.env.example` para qué es cada una).
2. **Migraciones:** en Supabase → SQL Editor, ejecuta en este orden (carpeta
   `../Celebraloo/supabase/migrations/`):
   - `20260928120000_clear_event_capability_override.sql`: botón **Quitar**.
   - `20260929120000_free_plan_once_and_edit_lock.sql`: plan gratis una vez
     por correo y bloqueo de edición 2 semanas antes del evento.
   - `20260929140000_platform_super_admin.sql`: roles admin/superadmin
     (deja a 2023030519@upsin.edu.mx como superadmin).
   - `20260929160000_super_admin_tools.sql`: herramientas de superadmin y
     página Actividad.
   - `20261001100000_admin_finance_foundation.sql`,
     `20261001110000_stripe_webhook_financials.sql` y
     `20261001120000_admin_metrics.sql`: Panel V1 (datos financieros,
     gastos, configuración y métricas). Después corre el backfill (abajo).
   - `20261002100000_admin_set_aside_breakdown.sql`: desglose de apartados,
     ventas solo de Stripe (sin cortesías) y corrección de Actividad.
   - `20261003100000_admin_catalog_overview.sql`: resumen comercial de Planes
     y permisos por evento en Actividad.
   - **Panel V2** (carpeta `supabase/migrations/` de ESTE repo, en orden):
     `20261005100000_admin_roles_permissions.sql`,
     `20261005110000_profile_acquisition_last_seen.sql`,
     `20261005120000_admin_definitions.sql` y
     `20261005130000_admin_alerts.sql` y
     `20261005140000_admin_inicio_alertas_venta.sql` y
     `20261005150000_admin_clientes_gastos.sql` (habilita pg_cron) y
     `20261005160000_admin_promociones.sql`. Aplícalas ANTES de desplegar el panel
     V2. Sin ellas el panel funciona en modo de respaldo: solo entra el
     superadmin de siempre.
3. **Tu usuario admin:** ejecuta `supabase/crear-admin.sql` con tu correo.
4. **Arrancar:**
   ```bash
   pnpm install
   pnpm dev        # http://localhost:3001 (Celebraloo usa el 3000)
   ```

## Seguridad

- Solo entra quien tiene sesión **y** un rol de panel en
  `celebraloo_staff.admin_role`: **superadmin**, **administracion**,
  **soporte** o **finanzas**. Sin rol = 404.
- La matriz rol → acción vive en `public.admin_role_permissions`. El panel la
  lee con `admin_my_permissions()` para el menú y para ocultar botones
  (`lib/auth/permissions.ts`, `lib/auth/require-admin.ts`), pero la regla que
  manda está en la BD: cada RPC empieza con
  `private.require_admin_permission('<permiso>')` y las tablas del panel
  tienen RLS por permiso. Soporte recibe las ventas sin subtotal, IVA,
  comisión ni neto (la BD los omite).
- `is_platform_admin` / `is_super_admin` se derivan del rol (los usa
  Celebraloo): solo Superadmin y Administración son admin de plataforma.
- Cambiar un rol va por `set_staff_role` con motivo obligatorio; siempre debe
  quedar al menos un superadmin. Queda en Actividad.
- La llave `service_role` solo se usa en el servidor: lecturas y lo que va por
  la API admin de Auth (**deshabilitar / habilitar** y **borrar cuenta**),
  que se anota en `admin_audit_log`. También limpia Storage al borrar un evento.
- Los cambios de permisos de un evento van por RPC con la sesión de quien los
  hace (`set_event_capability_override`, `clear_event_capability_override`,
  permiso `eventos.permisos`) y quedan en `event_entitlement_grants`.

## Promociones (Stripe)

- Stripe es la fuente de verdad. Crear o editar una promoción en el panel crea
  el Coupon y el Promotion Code en Stripe (applies_to = Products de los planes
  y complementos elegidos, max_redemptions, expires_at) y guarda una copia con
  sus ids. Un Coupon de Stripe no se puede editar: cambiar el descuento, los
  productos, el máximo o la vigencia crea uno nuevo con el mismo código y
  desactiva el anterior (los usos se acumulan).
- "Inicio" no existe en Stripe: el código se crea inactivo y se activa al abrir
  Promociones o con la tarea `/api/cron/promociones` (cada hora en
  `vercel.json`, protegida con `CRON_SECRET`).
- Llave: `STRIPE_SECRET_KEY` solo en el servidor del panel, de preferencia una
  restricted key con escritura en Coupons, Promotion codes y Products.
- En Celebraloo, el checkout liga cada precio a su Product y permite códigos
  (`allow_promotion_codes`); el webhook valida subtotal − descuento = total y
  guarda en la compra lo cobrado, el precio de lista, el descuento y el código.

## Qué hace cada acción

| Acción | Efecto |
|---|---|
| Activar / Guardar | Override de admin con ese valor. Gana sobre lo comprado. |
| Quitar | Revoca el override. Si el evento lo compró, vuelve al valor comprado; si no, se apaga. |
| Aplicar plan | Valores exactos del plan (también baja límites). Salir de Tour quita “Elegir plan”. Opcional: quitar lo que el plan no incluye. |
| Sumar complemento | Solo sube valores; nunca baja un límite. |
| Acceso total | Atelier + todos los complementos activos, con el mayor valor de cada uno. Sale de Tour. |

Nota: “Aplicar plan” no crea una compra, así que en Celebraloo la pantalla de
Plan no mostrará el nombre del plan; las funciones sí quedan activas.

## Backfill de datos financieros (una vez, después de las migraciones del Panel V1)

Desde `../Celebraloo`, con `STRIPE_SECRET_KEY` en `.env.local`:

```bash
# Prueba: consulta Stripe y muestra qué guardaría, sin escribir
node --env-file=.env.local --experimental-strip-types scripts/backfill-purchase-financials.mts
# Aplicar
node --env-file=.env.local --experimental-strip-types scripts/backfill-purchase-financials.mts --apply
```
