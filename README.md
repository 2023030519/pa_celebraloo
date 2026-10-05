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
3. **Tu usuario admin:** ejecuta `supabase/crear-admin.sql` con tu correo.
4. **Arrancar:**
   ```bash
   pnpm install
   pnpm dev        # http://localhost:3001 (Celebraloo usa el 3000)
   ```

## Seguridad

- Solo entra quien tiene sesión **y** está en `celebraloo_staff` con
  `is_platform_admin = true` (`lib/auth/require-admin.ts`). Se revisa en el
  layout y otra vez en cada Server Action.
- Roles: **admin** entra al panel, ve todo y edita permisos sueltos,
  complementos y el estado de las cuentas. **Superadmin** además: cambia roles
  (ninguno / admin / superadmin), aplica planes completos y acceso total,
  edita el catálogo (nombre, precio, activo), devuelve el plan gratis,
  desbloquea la edición de un evento y borra eventos o cuentas. Siempre debe
  quedar al menos un superadmin.
- Todo lo de superadmin va por RPC con su sesión (`set_platform_admin_role`,
  `update_catalog_item`, `reset_free_plan`, `set_event_edit_unlock`,
  `admin_delete_event`): la base vuelve a validar el rol y lo anota en
  `admin_audit_log` (página **Actividad**). Excepción: “Aplicar plan” y
  “Acceso total” usan las RPCs de permisos, que no distinguen roles; esa regla
  vive solo en `app/(admin)/eventos/[id]/actions.ts`.
- La llave `service_role` solo se usa en el servidor y para **leer**, salvo lo
  que va por la API admin de Auth (no hay RPC para eso): **deshabilitar /
  habilitar** (ban; una sesión abierta dura hasta que vence su token, 1 h
  máximo) y **borrar cuenta**; esas acciones se anotan en Actividad con service
  role. También limpia Storage al borrar un evento.
- Los cambios de permisos van por RPC con la sesión del admin
  (`set_event_capability_override`, `clear_event_capability_override`): la base
  vuelve a validar que sea admin y guarda quién, cuándo y por qué en
  `event_entitlement_grants` (se ve en la sección Auditoría del evento).

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
