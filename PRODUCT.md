# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
El staff interno de Celebraloo, en cuatro roles con permisos por sección: **superadmin** (todo), **administración** (operación de clientes y eventos), **soporte** (atender cuentas y eventos de clientes) y **finanzas** (ventas, ingresos, gastos, reportes). Trabajan sobre todo desde escritorio de oficina; consultan desde el celular cuando están fuera. *(Inferido del código y de los roles; el uso por dispositivo no está medido.)*

## Product Purpose
Operar el negocio de Celebraloo, un SaaS mexicano para organizar eventos sociales (bodas, XV años y similares): ver si el negocio va bien (ventas, ingresos en MXN con IVA, comisiones de Stripe, gastos, métricas), atender a clientes y sus eventos, dar cortesías y permisos por evento, mantener precios y promociones, y dejar rastro de cada cambio. El éxito es que cualquier persona del staff haga su tarea sin pedir ayuda, sin errores con dinero ni permisos, y que siempre se sepa quién cambió qué y por qué.

## Positioning
Es la trastienda de un producto de eventos mexicano: cada acción sensible lleva un motivo escrito y queda firmada en la bitácora, y los permisos de un evento se leen como su contrato (plan, complementos, cortesías y excepciones, cada uno con su origen).

## Operating Context
- 14 áreas: Inicio, Alertas, Ventas, Finanzas, Gastos (con suscripciones), Clientes, Eventos, Planes, Promociones, Reportes, Métricas, Actividad, Configuración, Cuentas y roles; fichas de detalle de cliente, evento, venta, gasto, promoción y usuario; "Ver como usuario".
- Tareas frecuentes: revisar alertas, buscar un cliente o evento, dar una cortesía o un complemento, desbloquear la edición de un evento, revisar ingresos del mes, registrar un gasto, descargar un reporte CSV.
- Toda acción sensible pide motivo (mínimo 3 caracteres) y aparece en Actividad con el antes y el después.
- Hoy hay muy pocos datos reales (4 eventos, 3 compras): los estados vacíos son la vista más común.

## Capabilities and Constraints
- Stack fijo: Next.js 16.3 (App Router, Server Actions), React 19.2, Tailwind v4 (tokens en `app/globals.css`), lucide-react. Sin librería de animación.
- Los permisos se validan en servidor y en la BD; la UI solo oculta. El rediseño no cambia flujos, permisos, rutas, nombres de campos de formulario ni RPCs.
- Montos en MXN, IVA incluido en precios; la BD guarda centavos.
- Es producción: el panel lee y escribe la base real.

## Brand Commitments
- Nombre: Celebraloo. Español de México, de tú. Mensajes de error que dicen el problema y cómo salir.
- La marca de la app del cliente usa tinta, oro y crema y la familia Kumbh Sans. Para el panel es evidencia, no obligación: el usuario pidió un rediseño completo.
- Decisión del usuario (8 nov 2026, ronda de dirección): el panel sigue el **estándar de la categoría** (nivel Stripe Dashboard, Linear, Shopify Polaris) **con la barra de menú lateral oscura**. El oro de Celebraloo es el único acento.

## Evidence on Hand
- Capturas del panel actual: `.bunshin/harvest/current/` (17 pantallas, escritorio y móvil).
- Reporte del QA y su revisión: `docs/QA_HALLAZGOS.md`, `docs/QA_REVISION_FASES.md`.
- No hay métricas de uso, testimonios ni volumen real: no se inventan. Los datos de demostración se marcan como sintéticos.

## Product Principles
1. Dinero y permisos primero claros, después bonitos: un monto o un permiso nunca se malinterpreta.
2. Cada cambio deja rastro visible: quién, cuándo, qué cambió y por qué.
3. El rol ve solo lo suyo, sin pantallas rotas ni botones muertos.
4. El vacío es el estado normal hoy: debe orientar, no parecer un error.
5. Rápido para quien lo usa a diario: densidad, teclado y búsqueda antes que adornos.

## Accessibility & Inclusion
Contraste AA (texto ≥4.5:1), foco visible en todo control, navegación con teclado, `prefers-reduced-motion` respetado, estados que nunca dependen solo del color.
