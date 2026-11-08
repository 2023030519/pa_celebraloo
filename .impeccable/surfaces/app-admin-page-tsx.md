---
version: 1
slug: "app-admin-page-tsx"
primary_target: "app/(admin)/page.tsx"
related_targets: ["app/(admin)/actividad/page.tsx","app/(admin)/alertas/page.tsx","app/(admin)/catalogo/page.tsx","app/(admin)/clientes/[id]/page.tsx","app/(admin)/clientes/page.tsx","app/(admin)/configuracion/page.tsx","app/(admin)/eventos/[id]/page.tsx","app/(admin)/eventos/page.tsx","app/(admin)/finanzas/page.tsx","app/(admin)/gastos/[id]/page.tsx","app/(admin)/gastos/nuevo/page.tsx","app/(admin)/gastos/page.tsx","app/(admin)/gastos/suscripciones/[id]/page.tsx","app/(admin)/gastos/suscripciones/nueva/page.tsx","app/(admin)/gastos/suscripciones/page.tsx","app/(admin)/metricas/page.tsx","app/(admin)/promociones/[id]/page.tsx","app/(admin)/promociones/nueva/page.tsx","app/(admin)/promociones/page.tsx","app/(admin)/reportes/page.tsx","app/(admin)/usuarios/[id]/page.tsx","app/(admin)/usuarios/page.tsx","app/(admin)/ventas/[id]/page.tsx","app/(admin)/ventas/page.tsx","app/(admin)/ver-como/[sessionId]/page.tsx","app/login/page.tsx"]
---

## Direction contract

THESIS: el panel es el estándar de las mejores herramientas de operación (Stripe Dashboard, Linear, Shopify Polaris), jugado en serio y sin ironía, con una sola desviación pedida por el usuario: la barra de menú lateral oscura. Rechaza el panel actual de tarjetas blancas iguales sobre crema y el KPI con ícono en círculo; la tabla es el lienzo.

OWN-WORLD: sidebar tinta oscura (casi negro azulado, texto claro, grupos con títulos pequeños, ítem activo con fondo levemente más claro y marca oro); área de trabajo gris muy claro con superficies blancas, divisores finos, radios pequeños (6-8px), sombras mínimas; Inter con cifras tabulares, escala 12/13/14/16/20/24; un solo acento: el oro de Celebraloo oscurecido para texto y botón primario (#6a5938 sobre blanco), y el oro claro (#c8a96a) solo como marca o sobre el sidebar oscuro; estados ok/aviso/error/info con ícono y texto, nunca solo color.

STORY: quien abre el panel ve primero lo que requiere atención y cuánto dinero entró, encuentra cualquier cliente, evento o venta en segundos, y cada acción sensible le pide motivo y le muestra que quedó firmada en Actividad.

FIRST VIEWPORT: (Inicio, 1440x900) sidebar oscuro de 240px a la izquierda con las áreas agrupadas (Inicio y Alertas arriba; Operación: Clientes, Eventos; Dinero: Ventas, Finanzas, Gastos; Catálogo: Planes, Promociones; Análisis: Reportes, Métricas; Control: Actividad, Configuración, Cuentas y roles) y la cuenta abajo; barra superior blanca con búsqueda global; en el contenido: título y periodo, bandeja "Requiere atención" arriba, franja de cifras con divisores finos (no tarjetas iguales), gráfica de ingresos de 30 días, y tablas de últimas ventas y eventos próximos. La acción primaria de cada página va en la esquina superior derecha de su encabezado.

FORM: canon (la puerta estándar de la categoría), elegido por el usuario con la barra lateral oscura; referencias de nivel: Stripe Dashboard, Linear, Shopify Polaris. seed:63a1ae696db07f2a

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Interaction thesis: 120-200 ms, ease-out cubic-bezier(0.2,0,0,1). Hover de fila con fondo sutil; hover del sidebar aclara el fondo del ítem. Diálogos y menús aparecen con opacidad + 4px de desplazamiento (160 ms) y salen en 120 ms. Toast de confirmación corto tras guardar. Sin animaciones al hacer scroll, sin entradas por sección, sin rebote ni parallax. prefers-reduced-motion: todo instantáneo.

Allowed patterns: sidebar (oscuro, por decisión del usuario), barra superior con búsqueda, franja de cifras, tablas con encabezado gris claro y orden por columna, un acento oro, badges de estado con ícono, Inter como cara de interfaz.
