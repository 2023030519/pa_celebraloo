# Cambios de la app Celebraloo (19 al 22 oct 2026) que el panel debe conocer

Documento de traspaso para el Claude que trabaja en `panelAdmin`. Escrito el 22 oct 2026 leyendo el repo hermano `Celebraloo` (`CHANGELOG.md` "Sin publicar", `docs/lanzamiento/PLAN.md`, `docs/lanzamiento/PENDIENTES_HUMANOS.md`, migraciones `20261019*` y `20261021*`) y el código de este repo. Lo que no se pudo confirmar leyendo está marcado **por confirmar**. Léelo completo antes de tocar código.

El PDF `Celebraloo_Panel_Admin_V1_para_Desarrollador.pdf` (carpeta padre) es la especificación V1 original (ventas, finanzas, clientes, eventos, planes, gastos, reportes, actividad). El panel actual ya la superó (roles, promociones, métricas). Nada de lo nuevo de este documento está en el PDF.

---

## 1. Contexto y reglas

- **La BD es una sola y compartida**: un único proyecto Supabase lo usan la app (`Celebraloo`), este panel y el deploy de producción. Todos los datos actuales son de prueba (decisión D1 del 19 oct).
- **Migraciones**:
  - La fuente de verdad del esquema es `Celebraloo/supabase/migrations/`. Toda migración NUEVA se crea ahí (`YYYYMMDDHHMMSS_descripcion.sql`, timestamp mayor a `20261021140000`), nunca editando una existente y nunca en este repo.
  - **Este repo SÍ tiene migraciones propias, históricas**: `supabase/migrations/20261005100000` a `20261006100000` (8 archivos: roles y permisos, adquisición y last_seen, definiciones de métricas, alertas, Inicio, clientes y gastos, promociones, reportes y métricas), más `supabase/crear-admin.sql`. Su README dice que se aplican antes de desplegar el panel V2 y que sin ellas el panel funciona en modo de respaldo (solo entra el superadmin de siempre). Si están aplicadas en el proyecto: **por confirmar** (el código tiene fallbacks, no se puede deducir leyendo). No agregues más archivos a esa carpeta: dos carpetas de migraciones sobre la misma BD terminan en desorden.
  - Riesgo de orden: la migración `20261005100000` reescribe funciones de la app con `pg_get_functiondef` + `replace('perform private.require_super_admin();', 'perform private.require_admin_permission(...)')` (`admin_delete_event`, `reset_free_plan`, `set_event_edit_unlock`, `update_catalog_item`, `set_event_capability_override`, `clear_event_capability_override`, y otras). Si una migración futura de la app hace `create or replace` de alguna de ellas, vuelve a `require_super_admin()` y se pierde el permiso por rol. Toda función nueva de panel debe usar `private.require_admin_permission('<permiso>')` desde el inicio.
  - Los nombres de permiso deben cumplir el CHECK de `admin_role_permissions`: `^[a-z_]+\.[a-z_]+$` (sin dígitos ni guiones).
- **Quién aplica**: el usuario aplica las migraciones a mano en el SQL Editor de Supabase. **Nunca ejecutes SQL, `supabase db push` ni scripts contra la BD**, ni desde el panel ni desde la terminal. Tú solo escribes el `.sql` (con casos de prueba manuales en la cabecera, como las migraciones de la app) y el usuario lo corre. En el repo de la app existe el agente `auditor-sql` para revisar migraciones antes de entregarlas.
- **Fail-closed**: sin sesión, sin rol o ante cualquier error, se niega (404 / 42501) sin revelar el motivo. Ocultar un botón no protege nada; cada RPC valida el permiso en SQL.
- **`service_role`**: solo en servidor (`lib/supabase/service-role.ts` tiene `import "server-only"`), después de `requireAdmin()` / `requirePermission(...)`, y preferentemente solo para lecturas. Las escrituras de negocio van por RPC con la sesión del admin para que queden en `admin_audit_log` (patrón actual del panel).
- **Todo cambio de acceso también en SQL**: si agregas un permiso o pantalla, agrega la fila en `admin_role_permissions` y valida con `private.require_admin_permission` dentro de la RPC.
- RPC `security definer`: siempre `set search_path = ''`, `revoke ... from public, anon` y `grant execute ... to authenticated` (con el chequeo de permiso adentro) o `to service_role` (solo cron/servidor).
- Secretos: nunca imprimir ni versionar `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `CRON_SECRET`. Las llaves de la app se rotaron el 22 oct; si el `.env.local` de este repo tiene llaves viejas, el usuario debe actualizarlo (**por confirmar**).
- No hagas commits ni push sin orden explícita del usuario. UI, comentarios y errores en español; identificadores en inglés.
- Next.js aquí es 16.3 con cambios incompatibles: lee `node_modules/next/dist/docs/` antes de usar APIs de Next (ver `AGENTS.md`).

---

## 2. Qué cambió en la BD (por migración)

Todas las `20261019*` y `20261021*` están **YA aplicadas** en el proyecto compartido. Cada punto termina con "Panel:" = qué debe hacer el panel con ello.

### 2.1 Catálogo v3 de planes (`20261019120000_packages_v3_catalog.sql`)

- Planes activos: `esencial` (gratis, publica y comparte), `signature`, `atelier`. `tour` y `basico` quedan `is_active = false` (solo existen en datos viejos; los eventos se migraron: tour a esencial, basico a signature).
- **Tabla `public.plan_prices`** (`id, plan_key, price_cents, currency, valid_from, valid_until, event_date_until, created_at`; único `(plan_key, price_cents, valid_from)` con nulls not distinct). RLS: SELECT abierto a anon y authenticated; **sin** insert/update/delete para ellos; solo `service_role` o migraciones escriben. Semilla:
  - esencial: 0, sin vigencia.
  - signature: 74900 hasta el 30 nov 2026 23:59:59 (-06), solo si el evento es hasta 2027-12-31 (`event_date_until`); 129000 desde el 1 dic 2026.
  - atelier: 99900 con las mismas condiciones; 169000 desde el 1 dic 2026.
- **`plans.price_cents` ya NO es el precio vigente**: quedó como respaldo con el precio de lanzamiento (749 / 999) y cobraría de menos después del 1 dic. La app lee `plan_prices` (`getPurchasablePlans`, `/api/checkout`); un plan de pago sin precio vigente se oculta y el checkout responde 503 `price_unavailable`.
- Capabilities nuevas: `pdf_export`, `typography_animated_cover`, `addons_allowed`, `team_extra_members`, `collection_changes`, `support_level` (email / email_whatsapp / priority_whatsapp), `collections_tier` (basic8 / all29 / all29_plus_premium). Columna `events.collection_changes_used`.
- `public.event_current_plan_key(p_event_id)`: plan efectivo (tour si sigue `choose_plan`; último plan pagado, con basico contado como signature; `esencial` si tiene `collections_tier = basic8` sin compra). Grants: **por confirmar**.
- Panel:
  - `lib/data/catalog.ts` y `catalogo/actions.ts` editan `plans.price_cents` con `update_catalog_item`: **eso ya no cambia lo que se cobra**. Hay que mostrar y editar `plan_prices` (ver 4.2).
  - `private.admin_event_plan` (panel, `20261005150000`) solo conoce `tour` (si `choose_plan`), compras y asignaciones: un evento Esencial gratis aparece sin plan. Debe seguir la lógica de `event_current_plan_key` (ver 4.1).
  - `components/customer-actions.tsx` y `clientes/[id]/page.tsx` filtran solo `tour`; ocultar también `basico` (**por confirmar** si `catalog.plans` trae los inactivos).

### 2.2 Límites de invitados y equipo (`20261019130000_enforce_v3_limits.sql`)

- Trigger `event_members_enforce_team_limit` y pre-chequeo en `invite_event_member`: error `team_limit_reached` según `team_extra_members` (el owner va aparte; 1000000 = sin límite). Solo rige para eventos v3 (los que tienen la capability `collections_tier`).
- RPC `consume_collection_change(p_event_id)`: solo `service_role`; consume un cambio de colección contra la capability `collection_changes` (`collection_changes_exhausted`). **El panel no debe llamarla.**
- **D8, cupo reservado**: el límite de invitados cuenta `guest_groups.max_guests` (lugares reservados), no filas de `guests`; trigger `enforce_guest_limit` (`guest_limit_reached`), sin cambios. `guest_limit` es **aditivo**: máximo del plan + suma de complementos (`guests_50` +50, `guests_100` +100). Un `admin_override` en `guest_limit` **reemplaza el total** (gana siempre en `recalculate_event_entitlement`), no se suma.
- Panel: ya puede hacer override de `guest_limit` (4.3). Mostrar el límite efectivo, su origen y los lugares reservados actuales.

### 2.3 Total pagado, reembolsos y contracargos (`20261019140000_event_paid_plan_total.sql` y el webhook)

- RPC `public.event_paid_plan_total(p_event_id)`: suma de compras `paid` con item de plan menos `amount_refunded_cents` (mínimo 0 por compra). Solo `authenticated` y solo devuelve valor si quien llama es miembro del evento (`private.is_event_member`): **un admin del panel que no es miembro recibe null**. El panel no debe usarla; que calcule desde `purchases` (service role) o con una RPC propia.
- **D2, upgrade = diferencia contra lo PAGADO**: la app cobra `precio vigente del plan destino` menos `total pagado de plan (menos reembolsos)`, nunca negativo. Sin compra registrada (Esencial, legado o **plan regalado desde el panel**, que crea grants y no compras) cae al precio de catálogo del plan actual. Consecuencia: regalar Signature y que el cliente pague Atelier cobra Atelier menos el precio de catálogo de Signature. Si se quiere otra regla es decisión de producto (**por confirmar**).
- Cupones: el checkout de la app tiene `allow_promotion_codes: true`. Si el "total pagado" usa `amount_total_cents` (parece que sí: lo que se pagó realmente), un cupón previo aumenta la diferencia del upgrade futuro; **por confirmar** si es intencional.
- **Pago duplicado**: el webhook reembolsa de inmediato la compra duplicada (`reason = duplicate`). La alerta `pago_duplicado` del panel (`private.admin_alerts`) la sigue detectando, y ahora existirá un reembolso automático asociado: no requiere acción manual.
- Tablas que el panel ya lee: `purchases`, `purchase_items`, `purchase_refunds`, `purchase_disputes`, `stripe_webhook_events`. Sin cambio de esquema.
- La metadata de la Checkout Session ahora incluye `kind` (plan|upgrade|addon), `plan`/`addon`, `event_id`, `account_id` y, si existen, `ga_client_id`, `fbp`, `fbc`, `utm_source`, `utm_medium`, `utm_campaign`.

### 2.4 Tienda de complementos v3 (`20261019150000_addons_store_v3.sql`, activación en `20261019240000`)

- Complementos activos: `guests_50` $149, `guests_100` $249, `extra_collection_change` $99, `album_memories_12m` "Conservar recuerdos 12 meses" $249 (se **activó** en `20261019240000`; capability `album_retention_months` = 12).
- Inactivos ("próximamente", con precio): `remove_branding_addon` $199, `premium_collection` $149 (1 dic 2026), `second_language` $199, `custom_domain` $490 por año. `extra_final_invitation`, `special_design` y `collaborative_album` inactivos. "Diseño a la medida" ya no es complemento: es cotización por WhatsApp.
- `collection_changes` pasó a ser aditiva (como `guest_limit`). `private.recalculate_event_entitlement` es el único escritor de `event_entitlements`; el panel nunca la llama.
- Regla de precios: ningún complemento activo puede costar igual o más que la diferencia de upgrade más barata (Signature a Atelier: $250 de lanzamiento, $400 desde el 1 dic). La migración tiene un `do $$` que aborta si se viola y la app lo prueba en TS. **Si el panel edita el precio de un complemento (`update_catalog_item`), no valida esta regla** (ver 4.2).
- Quién compra qué (lo aplica la app en servidor): Esencial no compra complementos; Signature compra +50, +100 y cambio de colección; Atelier solo Conservar recuerdos. `admin_assign_to_event` con `complemento` se salta esas reglas a propósito (es un grant `admin_override`).
- `album_memories_12m` no se puede comprar si `events.media_purged_at` ya no es nulo.

### 2.5 Recibos y solicitudes de factura (`20261019160000_payment_email_invoice_requests.sql`)

- `purchases.receipt_email_sent_at` (marca de recibo enviado; idempotencia del webhook).
- Tabla `public.invoice_requests`: `id, purchase_id (único: una por compra), event_id, requested_by, rfc, legal_name, tax_regime, postal_code, cfdi_use, email, status ('pending'|'issued'|'rejected', default 'pending'), created_at`. RLS: SELECT para el solicitante y owner/admin del evento; **sin** insert/update/delete para authenticated. Solo `create_invoice_request` (owner/admin, compra pagada del mismo evento, ventana de 30 días desde `paid_at`, formato de RFC y CP) escribe. `service_role` tiene todo.
- RPC `list_event_invoiceable_purchases(p_event_id)`: solo para la app.
- **D6 sigue pendiente**: nadie emite facturas automáticamente y no se decidió quién las emite (el aviso va a `INVOICE_NOTIFY_EMAIL`, variable solo de servidor de la app). La solicitud queda guardada; `status` solo cambiaría a mano.
- Panel: **no la muestra**; un admin de plataforma no la ve por RLS (no es miembro). Datos fiscales sensibles: limitarlos a superadmin y finanzas. Ver 4.9.

### 2.6 RSVP, zona horaria y límite por pase (`20261019170000_rsvp_timezone_seats.sql`, `20261021140000_rsvp_rate_limit.sql`)

- `get_public_invitation_by_token` y `submit_public_rsvp` (anon y authenticated) recreadas varias veces. La fecha límite del RSVP usa la hora del evento; ahora se crean acompañantes (`new_companion`) hasta completar `max_guests`.
- **Límite por pase** (`20261021140000`): máximo 20 envíos guardados por pase en 10 min (error 54000 `too_many_attempts`); tabla `private.rsvp_rate_limits` (sin acceso para nadie salvo la RPC).
- Un trigger sincroniza `invitation_briefs.rsvp_deadline` a `events.rsvp_deadline`.
- Panel: nada que hacer. Si un cliente dice que un invitado no puede confirmar, esta es una causa posible.

### 2.7 Adquisición (`20261019180000_profile_acquisition.sql`)

- `profiles.acquisition jsonb` (claves utm y referrer de `lib/acquisition.ts`; strings de máx. 200), poblada por el trigger `profiles_set_acquisition` desde `auth.users.raw_user_meta_data.acquisition`. RLS `profiles_select_own`.
- **Este panel tiene su propia versión** (`20261005110000`): trigger `profiles_copy_acquisition` que llena columnas separadas `acq_utm_source`, `acq_utm_medium`, `acq_utm_campaign`, `acq_utm_term`, `acq_utm_content`, `acq_referrer`, `acq_landing_path`, `acq_captured_at`. Los dos triggers corren al crear el perfil y **no chocan** (columnas distintas) pero guardan el mismo dato dos veces. Las métricas del panel siguen leyendo `acq_*`; no cambies eso. Unificar es opcional y requiere decisión del usuario.

### 2.8 Token de hostess por evento (`20261019190000_hostess_token_scope_event.sql`)

- `private.hostess_token_event_id` ya no resuelve "el evento más reciente de la organización": el token resuelve SIEMPRE a su evento (`event_id` de la invitación). Invitaciones antiguas sin `event_id` en cuentas con 2 o más eventos quedan **inválidas (fail-closed)**: hay que reinvitar a la hostess desde el evento.
- Panel: soporte puede recibir "mi hostess ya no entra". Es esperado. Nada que construir.

### 2.9 Registro de exportaciones (`20261019200000_export_audit_log.sql`)

- Tabla `public.export_audit_log` (`id, event_id, user_id, kind in (guests_pdf, tables_pdf, guests_csv, guests_xlsx, checkin_csv, checkin_backup), row_count, created_at`). RLS: SELECT para owner/admin del evento; sin escritura directa. RPC `log_event_export(p_event_id, p_kind, p_row_count)` (authenticated; tope 100000).
- Panel: opcional (soporte e investigación de fuga de datos). Lectura con service role tras `eventos.read`. No usar `log_event_export`.

### 2.10 Ventana del álbum, "Conservar recuerdos", borrado programado y avisos (`20261019210000`, `20261019240000`)

- Subida pública de fotos solo desde el día del evento hasta 7 días después (hora del evento). `confirm_public_album_upload` quedó solo para `service_role`.
- Expiración del álbum: `private.album_expiry(evento)` = inicio del día `event_date + 8` en `events.timezone` (al terminar el 7º día), o `event_date + N meses` con la capability `album_retention_months = N`.
- **Borrado programado de medios**: `events.media_purged_at` (null = no purgado). El cron diario `purge-album-photos` (RPC `events_pending_purge`, solo `service_role`) borra fotos del álbum y archivos de `invitation-assets` del evento y marca la columna. **Se borra álbum + archivos de la invitación; no se borran `events`, `guests`, `guest_groups` ni pagos.** Aplica también a eventos cancelados o archivados. Un evento con `updated_at` de menos de 24 h no se purga.
- `events.important_notices text[]` (máx. 2 avisos de 280 caracteres), editable con `set_event_notices` aunque el candado esté activo. Tabla `event_notifications_sent` (marcas de correos de aviso del candado y del borrado; sin acceso para nadie).
- Panel: mostrar `media_purged_at` y la fecha esperada de purga en la ficha del evento.

### 2.11 Reportes de contenido (`20261019220000_content_reports.sql`)

- Tabla `public.content_reports`: `id, kind ('invitation'|'album'), event_id, source_id (id del pase o enlace, para el tope), reason ('inappropriate'|'impersonation'|'spam'|'other'), comment (<= 500), reporter_ip_hash, status ('open'|'reviewed'|'dismissed', default 'open'), created_at`.
- RLS: SELECT **solo** con `private.is_super_admin()` (en este panel `is_super_admin` se deriva del rol: solo `superadmin`). Sin escritura directa: **nadie puede cambiar `status` hoy**, ni el superadmin con su sesión; solo `service_role` o una RPC nueva.
- RPC `report_public_content(p_token, p_kind, p_reason, p_comment, p_ip_hash default null)`: anon y authenticated; máximo 3 reportes abiertos por enlace en 24 h (54000 `too_many_reports`). La llama `app/api/report/route.ts` en la app (hash de IP con `REPORT_IP_SALT`, correo a `REPORT_NOTIFY_EMAIL`). **No la llames desde el panel.**
- Retención: `anonymize_event_guest_data` pone en null `comment` y `reporter_ip_hash` de los reportes del evento (ver 2.19); la fila queda.
- **La baja del contenido no está construida**: el plan la dejó para P-6 (panel). Ver 4.4.

### 2.12 Candado de contenido, zona horaria, identidad y cancelar evento (`20261019230000_event_timezone_lock.sql`)

- Columnas nuevas de `events`: `timezone text not null default 'America/Mexico_City'` (lista cerrada de 20 zonas IANA), `first_published_at`, `published_event_type`, `published_host_primary_name`, `published_host_secondary_name`, `content_locked_at`, `date_changes_count int default 0`, `cancelled_at`, `cancelled_by`. Sin grant de UPDATE para el cliente salvo `timezone` (y el RLS de `events` limita el UPDATE a owner/admin). `edit_unlocked_until` ya existía (`20260929120000`).
- **Fórmula** `private.event_lock_at(event_date, timezone, published_at, created_at)` = el MÁS TARDÍO entre (a) `event_date - 15 días` a las 23:59:59 en la zona del evento y (b) `coalesce(first_published_at, created_at) + 72 horas`. Bloqueado si `now() >= lock_at`. (Antes: 14 días fijos en CDMX con 72 h de gracia desde la creación.) `private.event_content_locked(p_event_id)` suma el sello permanente y el salto de soporte. Ambas son del esquema `private`: no se llaman por PostgREST.
- **Sello permanente**: la primera vez que se cambia fecha o zona con el candado ya vencido (solo posible a soporte o con el desbloqueo), `content_locked_at = lock_at original`; con sello el contenido sigue bloqueado aunque la nueva fecha quede lejos. Solo `edit_unlocked_until` vigente lo salta.
- Trigger `events_guard_identity`: el tipo de evento no cambia tras publicar; nombres de anfitriones hasta 3 letras de distancia contra el valor al publicar; fecha: un cambio libre de máximo 12 meses hacia adelante (el segundo solo soporte, `date_changes_count`); al crear, máximo 24 meses; el cliente no puede poner fecha pasada (`event_date_in_past`). **Soporte, service role y quien tenga `edit_unlocked_until` vigente se saltan las reglas.**
- El candado congela: textos de `invitation_briefs`, `invitation_module_supplements` (colección, música, mesa de regalos, etc.), `invitation_assets`, `invitation_itinerary_items` y la fecha. NO congela `rsvp_deadline` ni los avisos importantes.
- `set_event_edit_unlock(p_event_id, p_until, p_reason)` **no se redefinió**: sigue como en `20260929160000` (en este panel con el permiso `eventos.desbloquear`); registra `event.unlock` / `event.relock` en `admin_audit_log`, motivo obligatorio; `p_until` null quita el desbloqueo. Ver 3.3.
- **El espejo del panel está desactualizado**: `lib/edit-lock.ts` copia la regla vieja (`LOCK_DAYS = 14`, `GRACE_HOURS = 72` desde la creación, CDMX fija; ignora `timezone`, `first_published_at` y `content_locked_at`). La ficha del evento puede mostrar mal "bloqueado". Ver 4.5.
- **Cancelar evento**: RPC `cancel_event(p_event_id)` (owner o admin del evento vía `private.event_role`; **un admin de plataforma que no es miembro recibe 42501**). Marca `cancelled_at` y `archived_at`. Público: la invitación y el álbum muestran "Este evento ya no se realizará"; las RPC públicas del álbum lo niegan.
- En esta migración se recrearon `get_public_invitation_by_token`, `submit_public_rsvp` y `prepare_public_album_upload` (de nuevo en `...240000` y `...21140000`).
- Panel: hoy solo muestra "archivado"; falta mostrar "cancelado el ..." (`cancelled_at`).

### 2.13 Avisos por correo (`20261019240000_notices_album_expiry_notifications.sql`)

- Cron diario `event-notifications`: aviso de candado a 30/21/16 días y de borrado de fotos a 3 y 1 día; marca de envío en `event_notifications_sent`. Panel: nada que construir.

### 2.14 Alertas al administrador (`20261019250000_admin_alerts.sql`)

- Tabla `public.admin_alerts_sent (id, kind, ref_id, sent_at, unique(kind, ref_id))`: solo marcas anti-ruido; **no guarda datos para mostrar**; sin políticas ni grants.
- 4 RPC de agregados, **solo `service_role`** (revocadas a authenticated): `admin_alert_identity_changes(p_limit)`, `admin_alert_guest_archive_stats(p_limit)`, `admin_alert_account_event_counts(p_days, p_min, p_limit)` (firma `(integer, integer, integer)`), `admin_alert_photos_out_of_window(p_hours, p_limit)`.
- El cron diario `event-notifications` manda un correo a `ALERT_NOTIFY_EMAIL`, agrupado: (1) 2 o más cambios de fecha o nombres de anfitriones distintos a la instantánea de publicación; (2) más de la mitad de la lista archivada, habiendo tenido confirmaciones (mínimo 4 personas); (3) cuentas con más de 5 eventos en 30 días; (4) reportes de contenido abiertos recientes; (5) pagos anómalos, contracargos y reembolsos nuevos (los `duplicate` marcados como automáticos); (6) fotos subidas fuera de [día del evento, +7 días]. Ventana de 72 h.
- **No implementado a propósito (no hay datos)**: varias cuentas gratis con el mismo teléfono, tarjeta o dispositivo; cuenta gratis nueva con CLABE en mesa de regalos y más de 50 envíos el primer día.
- **La pantalla en el panel quedó para la Fase 8** (4.6). Este panel ya tiene `/alertas` (`private.admin_alerts`, `admin_alerts()`, `admin_alert_counts()`), pero solo de pagos y eventos operativos, no estas 6.

### 2.15 Check-in: privacidad de hostess, entradas sin pase, respaldo (`20261019260000`, `20261019270000`)

- Se recrearon `check_in_guests`, `hostess_check_in_guests`, `get_checkin_pass_by_credential/_group`, `hostess_get_checkin_pass_by_credential/_group`, `search_checkin_passes`, `hostess_search_checkin_passes`. Las RPC de pase ya no devuelven dietas, contacto principal ni `table_id`. `guests.checked_in_by_label` guarda `hostess_token:<8 caracteres del id de la invitación>` (nunca el token).
- **Entradas sin pase**: tabla `public.checkin_walkins` (nombre <= 100, nota <= 120, máximo 300 por evento; RLS SELECT solo owner/admin/planner); RPC `register_walkin`, `hostess_register_walkin`, `get_walkin_count`, `hostess_get_walkin_count`. No crean invitados ni tocan cupos.
- `get_checkin_backup(p_event_id)`: lista de respaldo imprimible solo con lista blanca (ventana: desde 48 h antes hasta el 7º día después).
- Panel: nada obligatorio. Opcional: contador de walk-ins por evento en la ficha. No muestres dietas de invitados.

### 2.16 Revocación de escrituras de `anon` (`20261021100000_revoke_anon_writes.sql`)

- `revoke insert, update, delete, truncate on all tables in schema public from anon` (y privilegios por defecto de `postgres`). Seguridad pura. El panel usa sesión authenticated o `service_role`; si algo del panel falla con 42501 sobre una tabla de `public`, comprueba que no esté usando una sesión anon.

### 2.17 Admin puede borrar eventos (`20261021110000_admin_can_delete_event.sql`)

- `delete_event(p_event_id, p_confirm_name)` y `archive_event(...)` permiten ahora **owner o admin del evento** (`private.event_role`), antes solo el dueño. Es el rol por evento, **no** un admin de plataforma.
- El borrado desde el panel sigue siendo `admin_delete_event(p_event_id, p_confirm_name, p_reason)` (permiso `eventos.borrar`, solo superadmin); no cambió. No encontré una RPC de "desarchivar": archivar es de un solo sentido para el cliente (**por confirmar** que no haya otra vía).

### 2.18 Aceptación de términos (`20261021120000_terms_acceptance.sql`)

- `profiles.terms_accepted_at timestamptz` y `profiles.terms_version text` (valor válido hoy: `"2026-10-21"`, lista cerrada `private.valid_terms_versions()`). El trigger `profiles_set_terms` (BEFORE INSERT) copia la versión desde `auth.users.raw_user_meta_data.terms_version`; cuentas anteriores al 21 oct quedan en null. Sin grant de UPDATE para el cliente. Subir de versión requiere cambiar `lib/legal/terms.ts` en la app y la función SQL.
- Límite: el usuario puede fijar esa metadata vía API de Auth; es evidencia razonable, no firma.
- Panel: **no lo muestra** (4.8).

### 2.19 Anonimización de invitados a los 7 días (`20261021130000_guest_data_retention.sql`)

- `events.guest_data_purged_at timestamptz` (null = pendiente o vigente). Al terminar el 7º día después del evento (inicio del día `event_date + 8` en `events.timezone`, SIN la extensión de Conservar recuerdos; puede tardar hasta ~24 h más) el cron `purge-album-photos` llama `anonymize_event_guest_data(p_event_id)`. Solo `service_role`: también `events_pending_guest_purge`, `private.guest_data_expiry`, `private.guest_data_purge_due`.
- Se anonimiza: `guests.name` a "Invitado" (solo `name_status = 'known'`), `phone`, `email`, `dietary_restrictions` a null; `guest_groups.name` y `primary_contact_name` a "Invitado"; `primary_contact_phone`, `primary_contact_email`, `notes`, `message_to_hosts` a null; `checkin_walkins.name/note`, `event_album_photos.uploader_name`, `content_reports.comment` y `reporter_ip_hash` a null. Se conservan `rsvp_status`, `age_category`, `needs_seat`, `max_guests`, mesa y asiento, `checked_in_at`.
- **Se rotan los tokens**: `guests.guest_token`, `guest_groups.invitation_token` y `checkin_credentials.credential` se regeneran con su DEFAULT. Los enlaces viejos de invitación, pase y QR dejan de abrir (`found: false`). Aplica también a eventos cancelados o archivados.
- Implicaciones: un evento con más de 8 días ya NO muestra nombres reales ni contactos de invitados (verás "Invitado"); no es un bug y no es recuperable. "Ver como usuario" (`admin_view_as`) mostrará datos anonimizados.

---

## 3. Mecánicas de negocio nuevas que el panel debe respetar y mostrar

### 3.1 Planes y precios

| Plan | Precio de lanzamiento (pago hasta 30 nov 2026 y evento hasta 2027-12-31) | Desde 1 dic 2026 | `guest_limit` | Fotos del álbum | Equipo extra | Cambios de colección |
|---|---|---|---|---|---|---|
| Esencial | $0 | $0 | 75 | 50 | 1 | 1 |
| Signature | $749 MXN | $1,290 MXN | 250 | 350 | 3 | 3 |
| Atelier | $999 MXN | $1,690 MXN | 1,500 ("uso justo"; la app dice "Lugares ilimitados (uso justo)") | sin tope (1000000) | sin tope | sin tope |

- Precios con IVA incluido. La fuente de verdad es `plan_prices`, no `plans.price_cents`. Una compra nueva anónima sin evento recibe el precio de lanzamiento (riesgo aceptado por el coordinador: fuga máxima $541 en Signature y $691 en Atelier).
- Complementos: ver 2.4. +50 y +100 invitados suman al límite; un override de panel lo reemplaza.
- `tour` y `basico` ya no se venden ni se asignan; solo aparecen en datos viejos (`basico` cuenta como Signature; `tour` como Esencial). Ya no existe la "prueba" para cuentas nuevas.
- Colecciones: Esencial `basic8` (9 colecciones provisionales; se quedan las 9 actuales), Signature `all29`, Atelier `all29_plus_premium`.

### 3.2 Upgrade = diferencia contra lo pagado

Ver 2.3. En la ficha del evento conviene mostrar: total pagado de plan, reembolsos, plan efectivo y origen (compra, cortesía, asignado, gratis).

### 3.3 Candado de 15 días, sin excepción por pago

Decisión de producto (PENDIENTES_HUMANOS, sección 0): nadie edita la invitación en los 15 días previos al evento, aunque tenga cambios de colección disponibles o quiera pagar. Matiz confirmado en SQL: el candado cae en el más tardío de (fecha - 15 días a las 23:59:59 en la zona del evento) y (primera publicación, o creación si no se publicó, + 72 h), para que publicar al final siga siendo posible. La app dice "Se bloquea el 9 de abril a las 23:59".

**La ÚNICA excepción es el desbloqueo manual del superadmin** (`set_event_edit_unlock`). El usuario decidió el 22 oct 2026 **conservarlo** como herramienta de soporte (en PENDIENTES_HUMANOS todavía aparece como "pregunta abierta"; esta decisión la cierra). Reglas:
- No lo elimines ni lo muevas a otro rol sin que el usuario lo pida. Sigue exigiendo motivo (>= 3 caracteres) y queda en `admin_audit_log` como `event.unlock` / `event.relock`.
- El panel lo ofrece hoy por 1, 3 o 7 días y "Restablecer" (`setEditUnlock`); permiso `eventos.desbloquear` (solo superadmin).
- El desbloqueo salta TODAS las reglas del candado, incluidos el sello permanente `content_locked_at` y la identidad (`events_guard_identity`). Ninguna compra, upgrade o cambio de colección extra desbloquea.
- Debe verse en la ficha quién desbloqueó, cuándo, hasta cuándo y con qué motivo (hoy el motivo solo está en Actividad).

### 3.4 Retención de datos

- Fotos del álbum: 7 días después del evento, o 12 meses con "Conservar recuerdos" (`album_retention_months`). Se borran del Storage y de la tabla; `events.media_purged_at` marca la purga. Los archivos de la invitación (portada, galería, logo, audio, fuentes) se borran con ellas.
- Datos personales de invitados: anonimizados a los 7 días (siempre, con o sin Conservar recuerdos); tokens rotados. El evento, los pagos y los conteos se conservan. Cuánto tiempo más conservar `events` y `guests` anonimizados: decisión legal pendiente.

### 3.5 Cancelación y baja

- Cancelar (cliente, owner o admin del evento): `cancelled_at` + `archived_at`; el público ve "ya no se realizará". Archivar y borrar por el cliente: igual, owner o admin del evento.
- Baja por moderación desde el panel: aún no existe (4.4).

### 3.6 Reportes de contenido

Motivos `inappropriate`, `impersonation`, `spam`, `other`; origen invitación o álbum; comentario hasta 500 caracteres; hash de IP, nunca la IP; estados `open`, `reviewed`, `dismissed`; máximo 3 reportes abiertos por enlace por 24 h; un correo a `REPORT_NOTIFY_EMAIL` por reporte.

### 3.7 Alertas

Las 6 del cron (2.14), por correo; la pantalla del panel falta (4.6).

### 3.8 Límites de invitados

75 / 250 / uso justo 1,500, medidos en lugares reservados (`max_guests`). Importar archivos es todo o nada (`import_guest_groups`, una transacción). Los lugares reservados sin nombre no son filas y no cuentan en el check-in.

### 3.9 Facturas

La solicitud se guarda (ventana de 30 días desde el pago) y avisa por correo si `INVOICE_NOTIFY_EMAIL` existe. **Nadie emite automáticamente la factura** y quién la emite sigue sin decidirse (D6). El panel debe presentarla como una lista de pendientes manuales y no prometer CFDI.

### 3.10 Otras reglas que verás reflejadas

- Límite de intentos por IP en la app (Upstash en `proxy.ts`: checkout 10/min, etc.; falla abierto) y por pase en RSVP. No afecta al panel.
- Candado de identidad (2.12): cambios de fecha, tipo y nombres tras publicar; 2 o más cambios de fecha o nombres distintos generan alerta por correo.
- Crons de la app en Vercel Hobby: `purge-album-photos` (9:00 UTC, diario, lotes de 25 eventos; también anonimiza) y `event-notifications` (15:00 UTC, incluye alertas). El `vercel.json` de ESTE panel tiene su propio cron (`/api/cron/promociones`, cada hora); no los confundas.

---

## 4. Lo que le toca construir al panel (P-6 y Fase 8), contrastado con lo que YA tiene

Referencias: P-6 (PLAN.md) pide "regalar un plan con motivo; cambiar precio de Esencial; override de invitados por evento; dar de baja un evento; cupones (Stripe promotion codes) con límite de usos, vencimiento y uno por cliente; bitácora de cada acción de admin". Fase 8: pantalla de alertas. PENDIENTES_HUMANOS sección 3 añade ver los reportes de contenido. Las RPC de superadmin ya existen en `20260929160000_super_admin_tools.sql`.

Convención para toda migración nueva (en `Celebraloo/supabase/migrations/`): cabecera con el porqué y casos de prueba manuales; `security definer`; `set search_path = ''`; primera línea `perform private.require_admin_permission('<permiso>')` y fila nueva en `admin_role_permissions` (`on conflict do nothing`); motivo obligatorio (>= 3) en acciones que cambian datos, con `private.log_admin_action(...)` hacia `admin_audit_log`; `revoke ... from public, anon` y `grant execute ... to authenticated` (el chequeo está adentro) o `to service_role` si solo la usa un cron o servidor; nunca editar una migración existente.

Resumen:

| Función | Estado en el panel | Migración nueva |
|---|---|---|
| Regalar planes | Existe (`admin_assign_to_event`); falta compatibilidad v3 | Opcional (4.1) |
| Precio de Esencial / `plan_prices` | No existe; `/catalogo` edita `plans.price_cents`, que ya no cobra | Sí (4.2) |
| Override de límite de invitados | Existe como override genérico; falta UX y contexto | No |
| Ver reportes y dar de baja eventos | No existe | Sí (4.4) |
| Cupones | Existe completo; falta "uno por cliente" (por confirmar) | No (o chica) |
| Pantalla de alertas de la app | `/alertas` existe, solo pagos; falta lo de la app | Recomendada (4.6) |
| Desbloquear / rebloquear | Existe; el espejo del candado está desactualizado | No (opcional) |
| Aceptación de términos | No existe | No |
| Solicitudes de factura | No existe | Sí (4.9) |

### 4.1 Regalar planes

- **Ya existe**: `admin_assign_to_event(p_event_id, p_kind ('plan'|'complemento'|'acceso_total'), p_item_key, p_courtesy, p_reason, p_remove_others)` (`20261005150000`): una transacción, crea grants `admin_override` con motivo, nunca crea compras (no cuenta como venta ni ingreso), guarda en `admin_event_assignments` y `admin_audit_log`. Permisos `eventos.asignar_plan` y `eventos.cortesia` (superadmin y administración). UI en la ficha del cliente (`components/customer-actions.tsx`, `clientes/actions.ts`) y del evento (`eventos/[id]/actions.ts`). También `reset_free_plan` (plan gratis una vez por correo, permiso `clientes.plan_gratis`).
- **Falta o hay que verificar**:
  1. `private.admin_event_plan` solo devuelve `tour`, compras o asignaciones: un Esencial gratis aparece sin plan. Debe devolver `esencial` (origen `gratis`) cuando `event_entitlements.collections_tier = 'basic8'` y no hay compra, igual que `public.event_current_plan_key`.
  2. La lista de planes a regalar debe ser `esencial`, `signature`, `atelier` activos; ocultar `tour` y `basico`.
  3. `acceso_total` copia Atelier + todos los complementos activos; ahora incluye `album_memories_12m`. Probar con un evento de prueba (**por confirmar** el resultado).
  4. Un plan regalado no cuenta como pagado: el texto de la acción debe avisar que un upgrade posterior se calcula contra el precio de catálogo del plan actual (2.3).
  5. `p_remove_others` baja capabilities; los complementos comprados se conservan salvo que se apaguen. Probar en un evento con compras.
- **Migración (solo para el punto 1)**: `YYYYMMDDHHMMSS_admin_event_plan_v3.sql`. Redefine `private.admin_event_plan(uuid)` con la misma firma y `returns table (plan_key text, origin text)`: primero compra pagada o asignación más reciente (como hoy); si no hay y el evento tiene `collections_tier = 'basic8'`, devuelve `('esencial', 'gratis')`; si `choose_plan` (legado), `('tour', 'prueba')`. `security definer`, `search_path = ''`, sin grants (queda en `private`). No toca `admin_assign_to_event`. Verificar que `private.admin_event_plan_key` y sus consumidores (`admin_events`, `admin_customer_card`) tratan el nuevo origen `gratis`.

### 4.2 Cambiar el precio de Esencial y gestionar `plan_prices`

- **Lo que el panel tiene**: `/catalogo` con `update_catalog_item(p_kind, p_key, p_name, p_price_cents, p_is_active, p_reason)` (permiso `planes.write`, solo superadmin), que cambia `plans.price_cents` y `addons.price_cents`. **Para planes esto ya no afecta el cobro** (el checkout lee `plan_prices`): el superadmin creería haber cambiado el precio sin que cambie nada. Tampoco valida la regla de precios de complementos.
- **Falta**: CRUD de `plan_prices`; mostrar el precio vigente por plan (lógica de la app, `resolveCheckoutPriceCents`: fila con `valid_from <= ahora < valid_until` y `event_date_until` nulo o >= fecha del evento; si no, la siguiente vigente), el calendario de cambio del 1 dic, y alertar si un plan de pago no tiene fila vigente (la app lo oculta y `/api/checkout` responde 503).
- **Pregunta abierta para el usuario (no implementar sin confirmar)**: Esencial es gratis y su alta no pasa por checkout (`/register`); `/api/checkout` rechaza montos <= 0 y el onboarding crea Esencial sin pago. Un precio > 0 en Esencial probablemente no se cobraría a quien se registra (**por confirmar**). Hay que decidir qué significa "cambiar el precio de Esencial": ¿habilitar un Esencial de pago, o solo gestionar Signature y Atelier?
- **Migración requerida**: `YYYYMMDDHHMMSS_admin_plan_prices.sql`.
  - `public.admin_upsert_plan_price(p_id uuid, p_plan_key text, p_price_cents integer, p_valid_from timestamptz, p_valid_until timestamptz, p_event_date_until date, p_reason text)`: `require_admin_permission('planes.write')`; motivo; `price_cents >= 0`; plan existente en `plans`; `valid_until > valid_from` cuando ambos existen; sin traslape ambiguo con otra fila del mismo plan y misma condición de `event_date_until`; un plan de pago nunca queda sin precio vigente hoy; no rompe la regla de complementos (diferencia Signature a Atelier mayor que el complemento activo más caro). Escribe con `security definer` (la tabla no tiene grant de escritura para authenticated). `log_admin_action('plan_price.set', ...)` con antes y después en `detail`.
  - `public.admin_delete_plan_price(p_id uuid, p_reason text)`: mismas protecciones; auditoría.
  - Lectura: `plan_prices` ya es legible por authenticated; no hace falta RPC.
  - Decisión pendiente: sincronizar `plans.price_cents` con el precio vigente como respaldo, o dejarlo obsoleto. Si no se sincroniza, `update_catalog_item` debe dejar de editarlo para planes.
- **Cambio de panel (sin migración)**: en `/catalogo`, para planes ocultar el campo de precio de `plans.price_cents` y mostrar `plan_prices`; mantener nombre y `is_active`. Para complementos seguir editando `addons.price_cents`, con validación de la regla.
- Stripe cobra con `price_data` (no con `stripe_price_id`), así que el precio de Stripe no hay que sincronizarlo; los Products de Promociones (`stripe_product_id`) no cambian con el precio.

### 4.3 Override de límite de invitados por evento

- **Ya existe**: `set_event_capability_override(p_event_id, p_capability_key, p_value_boolean, p_value_integer, p_value_text, p_reason)` y `clear_event_capability_override(p_event_id, p_capability_key, p_reason)` (permiso `eventos.permisos`, superadmin y administración); el editor de la ficha (`components/permissions-editor.tsx`, `eventos/[id]/actions.ts`, tope de 1,000,000) soporta capabilities enteras. Sirve para `guest_limit`.
- **Falta**: una acción dedicada "Subir límite de invitados" con contexto: límite efectivo, origen (plan 75/250/1500 + complementos, u override), lugares reservados actuales (`sum(guest_groups.max_guests)` de grupos no archivados), y aviso de que **el override reemplaza el total, no suma** (poner 300 a un Signature con +100 comprado deja 300, no 350). Sugerir "límite actual + N".
- Sin migración. (Opcional, **por confirmar** con el usuario: una RPC `admin_set_guest_limit` que valide valor >= lugares reservados y un tope; hoy el editor genérico no valida eso.)

### 4.4 Ver reportes de contenido y dar de baja eventos reportados

- **El panel no tiene nada** (no lee `content_reports`). Hoy solo un superadmin con sesión puede leerla por RLS; administración y soporte no, y nadie puede cambiar `status`.
- **Qué hay**: tabla y RPC de reporte público (2.11); `admin_delete_event` (borrado permanente, `eventos.borrar`); `cancel_event` / `archive_event` solo para owner o admin del evento (no sirven a un admin de plataforma).
- **Falta**: (1) pantalla de cola de reportes (usa un nombre distinto de `/reportes`, que es el reporte mensual) con filtro por estado y tipo, conteo por `source_id`, motivo, comentario, fecha y enlace al evento; (2) cambiar estado a `reviewed` o `dismissed`; (3) "dar de baja" un evento sin borrarlo.
- **Decisión de producto (por confirmar con el usuario)**: qué es "dar de baja". Opciones:
  - (a) Archivar (`archived_at`): invitación, álbum y OG públicos pasan a 404; el cliente no puede desarchivar (no encontré RPC). La más simple.
  - (b) Cancelar (`cancelled_at`): igual, pero el público ve "Este evento ya no se realizará", mensaje incorrecto para moderación.
  - (c) Borrado permanente con `admin_delete_event` (superadmin).
  - Recomendación: (a) para baja inmediata y (c) para casos graves, con motivo en la auditoría.
- **Migración requerida**: `YYYYMMDDHHMMSS_admin_content_moderation.sql`.
  - Permisos nuevos: `contenido.read` y `contenido.write` (superadmin y administración; soporte solo lectura si el usuario lo quiere).
  - `public.admin_content_reports(p_status text default 'open', p_limit integer default 200)`: `require_admin_permission('contenido.read')`; une con `events` (nombre) y cuenta reportes del mismo `source_id`; nunca devuelve `reporter_ip_hash`.
  - `public.admin_resolve_content_report(p_report_id uuid, p_status text, p_reason text)`: `contenido.write`; `p_status in ('reviewed','dismissed')`; actualiza `content_reports.status`; `log_admin_action('content_report.review' / '.dismiss', ...)`.
  - `public.admin_takedown_event(p_event_id uuid, p_reason text)`: `contenido.write`; motivo obligatorio; evento existente; `archived_at = coalesce(archived_at, now())` (y `archived_by` solo si el tipo lo permite; ver cómo lo hace `archive_event` en `20261021110000`); marca `reviewed` los reportes abiertos del evento; `log_admin_action('event.takedown', ...)`; idempotente.
  - Grants: `revoke ... from public, anon; grant execute ... to authenticated` en las tres.
- Archivar no borra archivos de Storage (solo `admin_delete_event` + `removeFolder` del panel lo hace); decidir con el usuario si la baja debe retirar también el contenido físico. Pasados 7 días tras el evento, comentarios y hashes de los reportes se anulan solos (2.19).

### 4.5 Desbloquear y rebloquear el candado (actualizar lo que ya existe)

- **Ya existe**: `setEditUnlock(eventId, days|null, reason)` (`eventos/[id]/super-actions.ts`), `components/event-super-tools.tsx`, RPC `set_event_edit_unlock` con `eventos.desbloquear` (solo superadmin). Queda en Actividad como `event.unlock` / `event.relock`.
- **Falta (sin romper lo existente)**:
  1. Actualizar `lib/edit-lock.ts` al algoritmo nuevo: 15 días, 23:59:59 en la zona del evento, `max(...)` con `coalesce(first_published_at, created_at) + 72 h`, y el sello `content_locked_at`. Leer de `events`: `event_date`, `timezone`, `first_published_at`, `created_at`, `content_locked_at`, `edit_unlocked_until`, `date_changes_count`, `cancelled_at`. Referencias: `Celebraloo/lib/events/lock.ts` (`computeLockAt`) y `private.event_lock_at` en `Celebraloo/supabase/migrations/20261019230000_event_timezone_lock.sql`. Manda siempre la BD; el panel solo muestra.
  2. Mostrar en la ficha: "Se bloquea el DD de mes a las 23:59 (zona)" o "Bloqueado desde ...", sello permanente, cambios de fecha, y el desbloqueo vigente con quién, motivo y vencimiento.
  3. Textos de UI con "2 semanas" o "14 días" deben decir 15 días.
- **Migración**: no requerida. Opcional, para no duplicar la fórmula en TS: `public.admin_event_lock_status(p_event_id)` con `require_admin_permission('eventos.read')` que devuelva `lock_at`, `locked`, `sealed`, `unlocked_until` usando `private.event_lock_at` y `private.event_content_locked`. Si se hace, no tocar `set_event_edit_unlock`.

### 4.6 Pantalla de alertas (Fase 8)

- **Ya existe**: `/alertas` con `admin_alerts(p_kind, p_limit)` y `admin_alert_counts()` (vista `private.admin_alerts`, `20261005150000`): pago_fallido, contracargo, pago_duplicado, pago_sin_plan, error_webhook, evento_sin_publicar, evento_sin_invitados, pago_sin_reclamar, reembolso_pendiente, registrado_sin_evento, evento_sin_publicar_usuario, venta_sin_comision. Permiso `alertas.read` (todos los roles).
- **Falta**: las de la app (2.14): cambios de identidad, lista archivada, cuentas con más de 5 eventos en 30 días, fotos fuera de ventana, reportes de contenido abiertos. Pagos anómalos, contracargos y reembolsos ya están casi cubiertos por las alertas del panel.
- **Opciones**:
  - (A) Sin migración: llamar las 4 RPC `admin_alert_*` con `service_role` en servidor tras `requirePermission("alertas.read")` y combinarlas con las del panel. Funciona, pero se salta el permiso en SQL y no deja auditoría; no es lo preferible.
  - (B) Recomendada: migración `YYYYMMDDHHMMSS_admin_app_alerts.sql` que extienda `private.admin_alerts` con nuevos `kind` (mismo formato `kind, severity, title, detail, occurred_at, target_type, target_id`) o cree `public.admin_app_alerts(p_limit integer default 200)` con `require_admin_permission('alertas.read')`, consultando directamente `events`, `guests`/`guest_groups`, `event_album_photos` y `content_reports` con los mismos umbrales. `grant execute ... to authenticated`. Revisar con `auditor-sql`.
  - Umbrales de la app (en `Celebraloo/lib/admin-alerts/`): identidad 2 o más cambios; archivo más de la mitad (mínimo 4 personas, la mitad exacta no alerta); cuentas más de 5 eventos en 30 días (5 no, 6 sí); fotos fuera de [día del evento, +7 días]; reportes y pagos 72 h.
- `admin_alerts_sent` no sirve para mostrar.

### 4.7 Cupones

- **Ya existe (completo)**: `/promociones` con Stripe como fuente de verdad: crea Coupon + Promotion Code (porcentaje o monto, `max_redemptions`, `expires_at`, `applies_to` productos de planes y complementos), `admin_promotions`, RPC `admin_save_promotion`, `admin_sync_promotion`, `admin_set_stripe_product`, `admin_promotions_list`, `lib/stripe/promotions.ts`, `lib/stripe/sync-promotions.ts`, cron `/api/cron/promociones`. Permisos `promociones.read` y `promociones.write` (superadmin y finanzas). El checkout de la app acepta códigos (`allow_promotion_codes: true`).
- **Falta (verificar)**: el requisito "uno por cliente": no encontré en `lib/stripe/promotions.ts` ninguna restricción (como `restrictions.first_time_transaction`) ni límite por cliente: **por confirmar**. Si se quiere, se agrega al Promotion Code de Stripe y se guarda el flag en `admin_promotions` (esto último sería una migración chica).
- Verificar con v3: `applies_to` usa `plans.stripe_product_id`; los planes v3 pueden no tener Product aún (`ensureStripeProducts` los crea al primer uso). Probar un cupón sobre un upgrade en modo test de Stripe. Efecto de un cupón en el "total pagado" de D2: ver 2.3.

### 4.8 Ver aceptación de términos

- **Falta**: `profiles.terms_accepted_at` y `profiles.terms_version` no se muestran. Mostrarlos en la ficha del cliente (`clientes/[id]`) y opcionalmente como columna ("Aceptó v2026-10-21 el ..." o "Sin registro: cuenta anterior al 21 oct").
- **Sin migración**: leerlos con service role en la página, después de `requirePermission('clientes.read')`, como ya se hace con otros datos de `profiles`. La alternativa (agregarlos a `admin_customer_card` / `admin_customers`) obliga a redefinir esas RPC y no vale la pena si la lectura directa basta.
- Comparar con la versión vigente (hoy `2026-10-21`) sin codificarla a mano si es posible (**por confirmar** de dónde leerla; p. ej. `admin_settings`).

### 4.9 Ver solicitudes de factura

- **Falta (todo)**: `invoice_requests` no se lee desde el panel. RLS solo deja ver al solicitante y a owner/admin del evento; un admin de plataforma no entra por RLS. Cambiar `status` solo es posible con `service_role` (escritura directa sin auditoría: **no recomendado**).
- **Migración recomendada**: `YYYYMMDDHHMMSS_admin_invoice_requests.sql`.
  - Permisos nuevos `facturas.read` y `facturas.write` (superadmin y finanzas; administración solo lectura si el usuario lo quiere; soporte sin acceso: RFC y razón social son datos fiscales). **Por confirmar** con el usuario.
  - `public.admin_invoice_requests(p_status text default null, p_limit integer default 200)`: `require_admin_permission('facturas.read')`; une con `purchases` (folio de 8 caracteres del id, total, `paid_at`), `events` (nombre) y correo del solicitante.
  - `public.admin_set_invoice_request_status(p_id uuid, p_status text, p_reason text)`: `facturas.write`; `p_status in ('issued','rejected')` (no regresar a `pending`); motivo obligatorio al rechazar; `log_admin_action('invoice_request.issued' / '.rejected', ...)`.
  - Opcional: columnas `issued_at timestamptz` e `invoice_reference text` (folio del CFDI), escritas solo por esa RPC.
  - `revoke ... from public, anon; grant execute ... to authenticated`.
- Mostrar antigüedad de pendientes; puede volverse una alerta del panel. D6 sigue pendiente: no automatices nada que prometa factura.

### 4.10 Ajustes menores detectados al leer

- Ficha del evento: mostrar `timezone`, `cancelled_at`, `first_published_at`, `media_purged_at`, `guest_data_purged_at`, `date_changes_count`, `collection_changes_used` frente a `collection_changes`, y opcionalmente `important_notices` y el contador de walk-ins.
- Listados de clientes y eventos: marcar eventos anonimizados (`guest_data_purged_at` no nulo).
- Mostrar "IVA incluido" junto a precios de planes.

---

## 5. Riesgos y cosas a no romper

- **RPC de la app que el panel no debe llamar**: `report_public_content`, `submit_public_rsvp`, `get_public_invitation_by_token`, `prepare_public_album_upload`, `confirm_public_album_upload`, `consume_collection_change`, `events_pending_purge`, `events_pending_guest_purge`, `anonymize_event_guest_data`, `admin_alert_*` (solo `service_role` y cron de la app, salvo la opción A de 4.6), `hostess_*`, `check_in_guests`, `register_walkin`, `log_event_export`, `create_invoice_request`, `set_event_notices`, `cancel_event` / `delete_event` / `archive_event` (rol por evento; el panel usa `admin_delete_event`).
- **Rutas y crons de la app que el panel no debe tocar ni llamar**: `/api/checkout`, `/api/webhooks/stripe` (idempotente por `stripe_webhook_events`; reembolsa duplicados), `/api/report`, `/api/cron/purge-album-photos`, `/api/cron/event-notifications`, `/i/[token]`, `/album/[token]`, `/check-in/...`.
- **Tokens que rotan**: a los 7 días del evento cambian `guests.guest_token`, `guest_groups.invitation_token` y `checkin_credentials.credential`. No guardes ni compartas enlaces de invitados desde el panel ni los uses como identificador estable. Los tokens de hostess y de álbum no rotan.
- **`plans.price_cents` ya no es el precio vigente**: usa `plan_prices`. Editarlo desde `/catalogo` no cambia nada y desde el 1 dic quedaría desfasado.
- **Un plan de pago sin fila vigente en `plan_prices`** se oculta de la oferta y `/api/checkout` responde 503. Antes del 1 dic comprobar que existan las filas de $1,290 y $1,690 (están sembradas).
- **Regla de precios de complementos**: el panel no la valida al editar `addons.price_cents`; una edición inocente puede violar lo que la app prueba en tests.
- **Override de `guest_limit` reemplaza, no suma.** Un `admin_override` gana sobre plan y complementos para cualquier capability y no se limpia solo tras un upgrade o compra: revisa overrides activos en la ficha.
- **Regalar un plan no crea compra**: no hay venta, ingreso ni factura; el upgrade posterior se calcula contra el catálogo.
- **Candado**: no cambies la regla de 15 días ni agregues excepciones por pago, upgrade o cambio de colección. Solo el desbloqueo manual del superadmin (conservado el 22 oct). Todo cambio de acceso también en SQL.
- **Archivar y cancelar son de un solo sentido** para el cliente (sin RPC de restauración; por confirmar). Confirma el evento antes de dar de baja; la acción debe ser idempotente y auditada.
- **Borrar un evento**: `admin_delete_event` borra filas en cascada pero no archivos; el panel limpia Storage de mejor esfuerzo (`removeFolder` en `super-actions.ts`; buckets `event-album-photos` e `invitation-assets`). Revisa que no rompa referencias de `purchases.event_id`.
- **Permisos fail-closed**: toda pantalla nueva va en `PERMISSIONS` y `AREA_PERMISSIONS` (`lib/auth/permissions.ts`) y en `admin_role_permissions` (SQL). Si falta en SQL, la UI mostrará el botón pero la RPC lo negará.
- **Migraciones del panel vs. de la app**: las del panel redefinen vistas y funciones que dependen de `purchases`, `purchase_items`, `purchase_refunds`, `purchase_disputes`, `event_entitlement_grants` y `admin_audit_log`. Una migración de la app que cambie esas tablas puede romper el panel; probar `/ventas`, `/finanzas`, `/alertas`, `/promociones` después. Además, la migración `20261005160000` del panel define `record_stripe_payment_success`, que usa el webhook de la app: no la cambies sin coordinar con la app.
- **Adquisición duplicada** (2.7): dos triggers, columnas distintas; no los mezcles.
- **Datos anonimizados**: "Ver como usuario" y fichas de eventos viejos mostrarán "Invitado"; es lo correcto.
- **Versión de términos**: si el usuario la sube, hay que cambiarla en la app (`lib/legal/terms.ts`) y en SQL (`private.valid_terms_versions()`); el panel no debe fijarla a mano.
- **Plan de Vercel**: Hobby prohíbe uso comercial; vale también para el panel si está en Hobby (**por confirmar**).
- `.env.local` existe en este repo: no lo muestres ni lo copies.

---

## 6. Lista de verificación para el usuario después de cada cambio

1. Si hay migración nueva: abrir el `.sql` en `Celebraloo/supabase/migrations/`, leer la cabecera, pedir revisión a `auditor-sql`, aplicarla **a mano** en el SQL Editor y correr los casos de prueba con un evento de prueba. Luego `Celebraloo/supabase/scripts/diagnostico_migraciones.sql` para confirmar que no falta ninguna. Desplegar el panel después, no antes.
2. `pnpm lint` y `npx tsc --noEmit` en `panelAdmin`: 0 errores. Este repo no tiene pruebas automáticas (**por confirmar**).
3. Probar con cada rol (superadmin, administración, soporte, finanzas): la pantalla nueva aparece o da 404 según el permiso y la acción devuelve "Tu rol no tiene permiso para hacer esto." cuando corresponde (la BD debe negarla aunque se fuerce la llamada).
4. Cada acción que cambie datos deja una fila en `admin_audit_log` (pantalla Actividad) con el motivo.
5. Candado: en un evento de prueba, la ficha muestra la hora correcta (15 días, zona del evento); desbloquear 1 día, comprobar en la app que se puede editar, rebloquear, y que ambos quedan en Actividad.
6. Precios (si se tocó `plan_prices`): abrir `/` y `/checkout?plan=signature` de la app y comprobar el precio; con un cupón de prueba en modo test de Stripe, el monto final; que ningún plan de pago quede sin precio vigente.
7. Regalo de plan: en un evento de prueba el plan aparece en la ficha con origen "cortesía", `/ventas` no cambia y las capabilities (invitados, equipo, colecciones) quedan según el plan.
8. Override de invitados: en la app (módulo Invitados) el nuevo límite se aplica y pasarse falla con mensaje en español.
9. Baja de evento reportado: generar un reporte desde la invitación pública de un evento de prueba, verlo en la cola, darlo de baja y comprobar que `/i/<token>` y `/album/<token>` ya no abren, que el reporte quedó `reviewed` y que consta en Actividad.
10. Facturas y términos: crear una solicitud de factura desde la app con una cuenta de prueba y verla en el panel; la ficha de una cuenta nueva muestra versión y fecha de términos.
11. Regresión: abrir Inicio, Ventas, Finanzas, Alertas, Clientes, Eventos, Promociones y Métricas sin errores; ningún rol sin permiso ve datos fiscales ni llaves.
12. No hacer commit ni push hasta que el usuario lo ordene.

---

## 7. Cambios de la app del 24 oct 2026 en adelante (plan de pendientes oct-nov)

Fuente: el plan de pendientes oct-nov (ya borrado; el resumen quedó en `Celebraloo/CHANGELOG.md`) y las ramas `feat/bloque-*` (PRs encadenados #3 en adelante). Ninguna migración nueva está aplicada todavía; las aplica el usuario a mano.

### 7.1 Bloque A · Seguridad (`feat/bloque-a-seguridad`)
- `20261024100000_stripe_webhook_events_rls.sql`: RLS activado en `stripe_webhook_events`, sin policies. Las RPC y vistas del panel que la leen son `security definer` y no cambian. Panel: si alguna consulta nueva la lee con la sesión del admin (no por RPC), dejará de ver filas.
- `20261024110000_rsvp_server_only.sql`: `submit_public_rsvp` ya no la ejecuta `anon`; la app la llama desde `/api/invitation/rsvp` con service role. Panel: nada.
- Captcha (Cloudflare Turnstile) en registro, login y reportar invitación. Panel: nada.

### 7.2 Bloque B · Planes y cobro (`feat/bloque-b-planes`)
- **Promoción**: Esencial es gratis hasta `FREE_PLAN_UNTIL` (variable de la app, `2026-11-30`, hora de CDMX). Después, Esencial se vende por checkout con su precio de `plan_prices`; mientras no exista una fila de `esencial` con `price_cents > 0` vigente, la app la oculta. Panel (4.2): al definir el precio de Esencial, crear la fila nueva con `valid_from = '2026-12-01 00:00:00-06'` y cerrar la de $0 con `valid_until = '2026-11-30 23:59:59-06'`.
- **Invitados fijos por plan**: el cliente ya no elige rango; `events.guest_range` se asigna según el plan y es solo informativo. El límite real sigue siendo la capability `guest_limit`.
- **Códigos de wedding planner** (`20261024130000_planner_referrals.sql`). Descuento personalizado por planner para sus referidos, **sin comisión**.
  - Tablas `public.planners` (`id, name, email, active, created_at`) y `public.planner_referrals` (`purchase_id` único, `planner_id`, `promotion_code_id`, `promotion_code`, `amount_discount_cents`, `created_at`). RLS sin policies; solo `service_role` escribe.
  - El webhook de la app, al registrar un pago con código de promoción, lee el `promotion_code` en Stripe y su `metadata.planner_id`; si es un planner activo, guarda la atribución. Un planner inactivo no atribuye.
  - Panel debe: (1) alta, edición y baja (`active = false`) de planners, con RPC `security definer` y `private.require_admin_permission('promociones.editar')` o el permiso que corresponda; (2) por planner, crear en Stripe un cupón (`percent_off` o `amount_off`) y un `promotion_code` legible (p. ej. `ANAPLANNER15`) con `metadata.planner_id = <uuid>`; desactivarlo en Stripe al dar de baja; (3) pantalla de ventas por planner uniendo `planner_referrals`, `purchases` y `planners` (código, descuento, monto, fecha, evento). Sin comisión.

### 7.3 Bloque C · Legal y privacidad (`feat/bloque-c-legal`)
- **Solicitudes ARCO** (`20261024140000_arco_requests.sql`). Tabla `public.arco_requests`: `right_type` (acceso, rectificacion, cancelacion, oposicion, revocacion, limitacion), `requester_role` (cuenta, invitado, otro), `full_name`, `email`, `phone`, `event_reference`, `description`, `profile_id` (si venía con sesión), `ip_hash`, `status` (pendiente, en_proceso, respondida, rechazada), `due_at` (20 días hábiles, sin feriados), `created_at`. RLS sin policies; solo `service_role`. La app manda acuse al solicitante y aviso a `PRIVACY_NOTIFY_EMAIL`. Panel debe: lista ordenada por `due_at` con filtro por estado y alerta de las que vencen en 3 días o ya vencieron; detalle; cambiar estado (RPC `security definer` con permiso de admin y registro en `admin_audit_log`). Dato personal sensible: limitarlo a superadmin y a quien atienda privacidad. Política de conservación de solicitudes respondidas: pendiente del abogado.
- **Versión de términos** `2026-10-24` (`20261024150000`): `private.valid_terms_versions()` acepta `2026-10-21` y `2026-10-24`. La ficha de cuenta del panel (4.8) puede mostrar ambas.
- **Eliminar cuenta** (`20261024160000_account_deletion.sql`). RPC solo de service role `account_owned_events` y `delete_account_data`: borra el perfil, las organizaciones donde era la única propietaria con todos sus eventos, y quita sus membresías; conserva `purchases`, `purchase_items`, `invoice_requests` y `arco_requests` con `profile_id`/`event_id` en null. Cambios de esquema que el panel debe conocer:
  - `invoice_requests.event_id` ahora es nullable y `on delete set null` (antes NOT NULL + cascade).
  - `purchases_claim_consistency` ahora es `profile_id is null or claimed_at is not null`: una compra reclamada puede quedar con `profile_id` null (cuenta eliminada).
  - `uploaded_by`, `submitted_by`, `approved_by` y `requested_by` del flujo de diseñador pasan a nullable.
  - **Falsas alertas a corregir en el panel:** tras borrar una cuenta, sus compras quedan `paid`, con `claimed_at` lleno, `event_id` null y `profile_id` null. La alerta `pago_sin_reclamar` ("Pagó y no tiene evento") se dispararía para siempre (`20261005130000_admin_alerts.sql` ~83-89, y las consultas equivalentes de `20261001120000_admin_metrics.sql` ~796 y `20261005150000_admin_clientes_gastos.sql` ~892). Excluir `claimed_at is not null and profile_id is null and event_id is null` y mostrar esas compras como "cuenta eliminada".

### 7.4 Bloque D · Correos, avisos y borrado automático (`feat/bloque-d-correos`)
- `20261024170000_notifications_reminders_event_purge.sql`: `event_notifications_sent.kind` admite `capacity_90`, `capacity_100` y `backup_48h`, y tiene una columna nueva `delivered_at` (Resend aceptó el correo). Tabla nueva `event_reminder_deliveries` (recordatorios 7 y 1 día antes, por destinatario con hash; solo service role).
- **Borrado automático del evento completo** (cron diario de la app): al terminar el 7º día después del evento, o al vencer "Conservar recuerdos", siempre que el dueño haya recibido un aviso `delete_1` entregado hace 24 h o más. Se conservan compras, facturas y ARCO con `event_id` null. Panel debe:
  - Mostrar en la ficha del evento la fecha de borrado (`private.album_expiry`), si ya se avisó (`delete_3`/`delete_1` con `delivered_at`) y si está pendiente.
  - Contar como "evento borrado por vencimiento", no como alerta, las compras con `event_id` null cuyo evento se borró (igual que en 7.3 para cuentas eliminadas). Hoy `pago_sin_reclamar` usa `p.claimed_at is null or p.event_id is null` y se dispararía por cada evento vencido.
  - `admin_event_assignments` (cascade) desaparece con el evento: si hace falta historial, guardarlo antes en otra tabla del panel.
- Opcional: contadores de recordatorios enviados y de avisos por kind para soporte.

### 7.5 Bloque E · Marca, idioma y URL personalizada (`feat/bloque-e-invitaciones`, en `main`)
- `20261024180000_branding_watermark_caps.sql`: capabilities `branding_badge` y `album_watermark` (Esencial) y RPC `accept_terms` para quien entra con Google. Si el panel muestra o edita capabilities de un plan, debe conocer estas dos.
- `20261024190000_invitation_language_slugs.sql`: `events.invitation_language` (`es`/`en`, con candado de 15 días) y la tabla `invitation_slugs` de `invita.celebraloo.com/{nombres}/{código}`. El slug es decorativo y no da acceso.

## 8. Cambios del 4 nov 2026 (QA del 3 nov)

- **Aplicada:** `20261104090000_plan_key_admin_assignments.sql`. `event_current_plan_key` ahora toma lo más reciente entre la última compra pagada y la última asignación de plan del panel (`admin_event_assignments`, `kind = 'plan'`). Antes, un Atelier regalado desde el panel salía en la app como "prueba gratis". **Para el panel:** asignar un plan ya cambia el plan que ve el cliente; no hace falta crear una compra de $0.
- **Permiso temporal:** `submit_public_rsvp` volvió a tener `grant execute` para `anon` porque producción no tiene publicada la ruta `/api/invitation/rsvp`. Se revoca cuando se publique `main` (ver `Celebraloo/docs/PENDIENTES_HUMANOS.md`, 5.1).
- `panelAdmin/supabase/crear-admin.sql` (sin commitear) ahora crea el perfil si falta y deja al usuario como `superadmin`.
