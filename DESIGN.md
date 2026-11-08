---
name: Celebraloo Admin
description: Panel interno de Celebraloo, estándar de la categoría con la barra lateral oscura y un solo acento oro.
colors:
  paper: "#f6f7f9"
  surface: "#ffffff"
  surface-2: "#f2f4f7"
  ink-950: "#1a1d23"
  ink-800: "#3a3f4a"
  ink-600: "#545a66"
  ink-400: "#6b7280"
  ink-250: "#8a909c"
  ink-150: "#e4e7ec"
  gold-800: "#6a5938"
  gold-900: "#574828"
  gold-200: "#eadfc6"
  gold-600: "#957637"
  gold-100: "#f7f1e4"
  gold-chart: "#a67c2e"
  gold-brand: "#c8a96a"
  ok-700: "#067647"
  ok-800: "#05603a"
  ok-300: "#abefc6"
  ok-100: "#ecfdf3"
  warn-700: "#93370d"
  warn-300: "#fedf89"
  warn-100: "#fffaeb"
  danger-700: "#b42318"
  danger-800: "#912018"
  danger-300: "#fecdca"
  danger-100: "#fef3f2"
  info-700: "#175cd3"
  info-300: "#b2ddff"
  info-100: "#eff8ff"
  nav-bg: "#15171c"
  nav-hover: "#20232a"
  nav-active: "#2a2e37"
  nav-rule: "#2c3038"
  nav-fg: "#eceef2"
  nav-muted: "#a3a9b5"
  nav-accent: "#d4b578"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
    letterSpacing: "-0.015em"
  figure-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "28px"
    letterSpacing: "-0.015em"
    fontFeature: "tnum"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  body-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
  nav-group:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  segment: "5px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.gold-800}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.gold-800-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-950}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-danger:
    backgroundColor: "{colors.danger-700}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-danger-hover:
    backgroundColor: "{colors.danger-700-hover}"
  button-disabled:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-400}"
  button-sm:
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-950}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  field-sm:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-950}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  surface-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  table-head:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-600}"
    typography: "{typography.label}"
    height: "40px"
    padding: "0 12px"
  table-cell:
    typography: "{typography.body}"
    padding: "10px 12px"
  badge-neutral:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-800}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  badge-ok:
    backgroundColor: "{colors.ok-100}"
    textColor: "{colors.ok-700}"
    rounded: "{rounded.full}"
  badge-warn:
    backgroundColor: "{colors.warn-100}"
    textColor: "{colors.warn-700}"
    rounded: "{rounded.full}"
  badge-danger:
    backgroundColor: "{colors.danger-100}"
    textColor: "{colors.danger-700}"
    rounded: "{rounded.full}"
  badge-info:
    backgroundColor: "{colors.info-100}"
    textColor: "{colors.info-700}"
    rounded: "{rounded.full}"
  nav-item:
    backgroundColor: "{colors.nav-bg}"
    textColor: "{colors.nav-fg}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  nav-item-hover:
    backgroundColor: "{colors.nav-hover}"
  nav-item-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.surface}"
  figure-lg:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-950}"
    typography: "{typography.display}"
    padding: "16px 20px"
---

# Design System: Celebraloo Admin

## Overview

**Creative North Star: "La trastienda en orden"**

El panel juega en serio el estándar de las herramientas de operación (nivel Stripe Dashboard, Linear, Shopify Polaris) con una sola desviación pedida por el usuario: la barra de menú lateral oscura. El área de trabajo es gris muy claro, las superficies son blancas con divisores finos y radios pequeños, y la tabla es el lienzo. No hay decoración: la jerarquía sale del peso tipográfico, de las cifras tabulares y de dónde aparece (o no aparece) el color.

Es una interfaz densa para quien la usa a diario. El color se gana: el oro de Celebraloo, oscurecido para pasar contraste, es el único acento y marca acción primaria, ítem activo, enlaces, foco y selección. Los cuatro colores de estado solo aparecen cuando algo pide atención o confirma algo real, y siempre con ícono o texto. Hoy el vacío es la vista más común, así que el vacío está diseñado como un sistema (raya `Nil`, mensajes de una línea, tablas plegadas) y nunca parece un error.

Se rechaza explícitamente el panel anterior: tarjetas blancas iguales sobre crema y el KPI con ícono en círculo. Las cifras viven en una franja con divisores, no en tarjetas sueltas.

**Key Characteristics:**
- Barra lateral oscura de 240 px (`#15171c`) contra un área de trabajo clara (`#f6f7f9`).
- Un solo acento: oro `#6a5938` (6.8:1 sobre blanco); el oro claro de marca solo sobre la barra oscura.
- Plano: bordes de 1 px `#e4e7ec`, casi sin sombras.
- Inter con cifras tabulares; escala corta de 11 a 28 px.
- Movimiento corto y funcional (120 a 200 ms, `cubic-bezier(0.2, 0, 0, 1)`), nada al hacer scroll.
- Cada acción sensible pide motivo y queda firmada en Actividad.

## Colors

Grises fríos casi neutros con un oro terroso como única voz; los estados son una paleta aparte que solo habla cuando hace falta. Todos los tokens viven en `app/globals.css` (`:root` y su espejo `@theme inline`).

### Primary
- **Oro tinta** (gold-800 #6a5938): texto en oro, enlaces (`ui.link`), botón primario, etiqueta de la cifra con énfasis. 6.8:1 sobre blanco, 6.0:1 sobre `gold-100`.
- **Oro tinta profundo** (gold-900 #574828): hover del botón primario (`hover:bg-gold-900`). Token en `app/globals.css` desde la ronda 5. **Oro claro de anillo** (gold-200 #eadfc6): anillo del Badge oro.
- **Oro de foco** (gold-600 #957637): anillo de foco global (2 px, desplazado 2 px), borde de campo enfocado, borde de la cifra con énfasis. 4.3:1 sobre blanco: solo bordes y anillos (mínimo de UI 3:1), nunca texto.
- **Oro de selección** (gold-100 #f7f1e4): fondo de `::selection` y del badge `gold`.
- **Oro de gráfica** (gold-chart #a67c2e): barras de `components/metric-chart.tsx` (3.8:1 sobre blanco). Literal en ese archivo.
- **Oro de marca** (gold-brand #c8a96a): solo la "C" de `BrandMark` y `app/icon.svg`, siempre sobre la barra oscura o el fondo del login.

### Neutral
- **Papel** (paper #f6f7f9): fondo del área de trabajo (`body`).
- **Superficie** (surface #ffffff): tarjetas, tablas, franja de cifras, campos.
- **Superficie 2** (surface-2 #f2f4f7): encabezado de tabla, fondo del control segmentado, hover de botón secundario y de fila, campo deshabilitado.
- **Tinta** (ink-950 #1a1d23): texto principal, títulos y cifras. 16.9:1 sobre blanco, 15.8:1 sobre papel.
- **Tinta media** (ink-800 #3a3f4a): etiquetas de campo, valores secundarios de dinero (IVA, comisión, neto), badge neutral.
- **Tinta secundaria** (ink-600 #545a66): subtítulos, encabezados de tabla, ayudas, conteos, la raya de `Nil`. 6.9:1 sobre blanco, 6.3:1 sobre `surface-2`.
- **Tinta tenue** (ink-400 #6b7280): placeholders, chevrons e íconos auxiliares, texto deshabilitado. 4.8:1 sobre blanco.
- **Borde de campo** (ink-250 #8a909c): borde de campos y botones secundarios, borde de lo deshabilitado. 3.2:1 sobre blanco, el mínimo de UI.
- **Divisor** (ink-150 #e4e7ec): bordes de superficie, divisores de fila y de la franja de cifras. 1.2:1: decorativo, nunca el único límite de un control.

### Estados
Cada estado tiene fondo tenue (100), borde (300) y texto o ícono (700). Verde = correcto, amarillo = atención, rojo = problema, azul = información. Texto 700 sobre su 100: ok 5.4:1, warn 7.2:1, danger 6.1:1, info 5.6:1.
- **Verde correcto** (ok-700 #067647 / ok-300 #abefc6 / ok-100 #ecfdf3); hover de botón `ok` (ok-800 #05603a, `hover:bg-ok-800`).
- **Ámbar de atención** (warn-700 #93370d / warn-300 #fedf89 / warn-100 #fffaeb): callouts de aviso y badge "Sin confirmar".
- **Rojo de problema** (danger-700 #b42318 / danger-300 #fecdca / danger-100 #fef3f2): botón de peligro, error de datos (`DataError`), bloque de borrar; hover danger-800 #912018 (`hover:bg-danger-800`).
- **Azul informativo** (info-700 #175cd3 / info-300 #b2ddff / info-100 #eff8ff): alertas informativas.

### Barra oscura
- **Fondo de barra** (nav-bg #15171c): barra lateral de escritorio, encabezado móvil, menú móvil y fondo del login.
- **Hover / activo** (nav-hover #20232a, nav-active #2a2e37): fondo del ítem al pasar y del ítem actual.
- **Regla** (nav-rule #2c3038): divisor de la cuenta al pie y del menú móvil.
- **Texto de barra** (nav-fg #eceef2): 15.4:1 sobre `nav-bg`, 11.7:1 sobre `nav-active`.
- **Texto apagado de barra** (nav-muted #a3a9b5): títulos de grupo, rol, íconos inactivos. 7.6:1.
- **Oro de barra** (nav-accent #d4b578): ícono y raya de 2 px del ítem activo, y su foco. 9.1:1.

### Named Rules
**The One Accent Rule.** El oro es para la acción primaria, el ítem activo, los enlaces, el foco y la selección. Nunca para un badge de categoría rutinaria (`.bunshin/decisions/round-1.md`, R4).

**The Earned Color Rule.** Verde, ámbar, rojo y azul solo cuando el estado pide atención o confirma algo real, y siempre con ícono o texto. Un conteo en cero va en tinta, sin color (`components/ui.tsx`, `Badge` y `TONE_ICON`).

**The Light Gold Stays Dark Rule.** El oro claro (`#c8a96a`, `#d4b578`) solo vive sobre la barra oscura; sobre blanco el oro es siempre `gold-800`.

## Typography

**Display Font:** Inter (con ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica Neue, Arial)
**Body Font:** Inter, la misma familia.
**Label/Mono Font:** sin mono propia; los IDs técnicos usan la mono del sistema puntualmente.

Inter se autoaloja con `next/font/google` en `app/layout.tsx` (variable `--font-inter`, `display: swap`) y entra como `--font-sans` en `app/globals.css`. El `body` arranca en 14 px.

**Character:** una sola cara neutra y precisa; la jerarquía la dan el peso 600 y el tracking negativo en títulos y cifras, no el tamaño ni una segunda familia.

### Hierarchy
- **Display** (600, 28 px / 36 px en `sm` y más; 22 px / 32 px en móvil, -0.015em, tabular): la cifra principal de dinero de cada página, tamaño `lg` de `Figure`, `KpiTile` y `MoneyTile` (`components/kpi.tsx`, `components/finance.tsx`).
- **Headline** (600, 24 px, -0.015em, `text-balance`): título de página en `PageTitle` (`components/ui.tsx`).
- **Figure md** (600, 20 px, tabular): cifras de la segunda fila de la franja. También el título del login (20 px).
- **Title** (600, 16 px): título de `Card` y de `Table`.
- **Body** (400 / 500, 14 px): texto de tabla, subtítulo de página, campos y botones (los campos suben a 16 px en móvil para evitar el zoom de iOS).
- **Body sm** (13 px): ítems de navegación (500), etiquetas de cifra, `Breadcrumb`, `HowCalculated`, motivo.
- **Label** (500, 12 px): encabezados de tabla, badges, botones chicos, conteos, segunda línea de persona.
- **Nav group** (500, 11 px, mayúsculas, 0.08em): solo los títulos de grupo de la barra lateral ("Operación", "Dinero").

El contrato pedía 12/13/14/16/20/24; el build añade 11 (grupos de barra), 15 (nombre de marca) y 22/28 (cifra principal). Se registra lo que se envía.

### Named Rules
**The Tabular Money Rule.** Toda cifra, monto, conteo y fecha en columna lleva `tabular-nums`; los montos se alinean a la derecha (`Table` prop `align`).

**The Same Money Size Rule.** La cifra principal de dinero de una página usa el tamaño `lg` en todas las páginas; `md` solo para la segunda fila. Las etiquetas de cifra caben en una línea (`truncate` con `title`) para compartir línea base (`components/kpi.tsx`, `FigureBody`; R17).

**The No Eyebrow Rule.** Las mayúsculas espaciadas existen solo en los títulos de grupo de la barra lateral. En el área de trabajo no hay etiquetas sobre el título.

## Layout

- **Shell** (`app/(admin)/layout.tsx`): desde `md` (768 px) una rejilla `240px | 1fr`; la barra lateral es `sticky` a toda la altura con marca arriba, navegación con scroll propio y la cuenta al pie. Debajo de `md`, la misma barra oscura se vuelve un encabezado `sticky` de 56 px con marca y botón "Menú". Hay enlace "Saltar al contenido".
- **Área de trabajo**: `main` con 16 px laterales y 20 px arriba en móvil; 32 px desde `md`. Contenido centrado con ancho máximo de 1280 px.
- **Encabezado de página**: `PageTitle` con 24 px de margen inferior; título y subtítulo a la izquierda, acciones a la derecha, que bajan de renglón si no caben.
- **Lista**: `PageTitle` + `FilterBar` + `Table`, en ese orden.
- **Ficha**: `Breadcrumb` sobre el título y dos columnas desde `lg` (1024 px), contenido `minmax(0,1fr)` y lateral de 320 px (`eventos/[id]`, `clientes/[id]`, `ventas/[id]`). En móvil se apilan y lo destructivo va al final (`max-lg:order-last`).
- **Franja de cifras**: filas de 2, 3 (desde `sm`) o 4 columnas (desde `xl`, 1280 px); en móvil una cifra impar final ocupa las dos columnas.
- **Ritmo**: base de 4 px. Celdas de tabla 12 px laterales y 10 px verticales; encabezado de tabla de 40 px; tarjetas con 16 px de relleno y cabecera de 12 x 16 px; separaciones de 8, 12, 16 y 24 px.
- **Breakpoints** (Tailwind por defecto): `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- **Tablas angostas**: cada tabla tiene su propio scroll horizontal (mínimo 640 px); con `mobileHide` se ocultan columnas debajo de `sm` en lugar de desplazar. A 390 px no hay scroll horizontal de página.

### Named Rules
**The Primary Top Right Rule.** La acción primaria de cada página va en la esquina superior derecha de su encabezado (`PageTitle` prop `actions`).

## Elevation & Depth

El sistema es plano: la profundidad la dan el contraste papel / superficie, los bordes de 1 px `ink-150` y el fondo `surface-2` del encabezado de tabla. La barra oscura es el único plano de color fuerte.

### Shadow Vocabulary
- **Segmento elegido** (`box-shadow: 0 1px 2px rgba(16,24,40,0.08)`): la opción activa de `Segmented`, junto con un anillo `ink-150`.
- **Capa flotante** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): el tooltip de `components/metric-chart.tsx`, la única capa que flota sobre contenido.
- **Velo de menú** (fondo `rgb(0 0 0 / 0.4)`): detrás del menú móvil.

### Named Rules
**The Flat By Default Rule.** Superficies, tarjetas, cifras y tablas no llevan sombra. Una sombra solo marca algo que flota (tooltip) o una opción elegida dentro de un control.

## Shapes

Radios pequeños y constantes. Controles (campos, botones, ítems de navegación) con esquinas suaves de 6 px; superficies (tarjetas, tablas, franja de cifras, callouts, login) de 8 px; badges en píldora completa; el segmento interior de `Segmented` de 5 px para asentar dentro de su carril de 6 px; 4 px en el resumen de `HowCalculated`. Bordes de 1 px siempre; el énfasis se marca con borde `gold-600`, no con relleno. Un hueco vacío dentro de un grupo (p. ej. "Sin añadidos" en la ficha de evento) usa borde punteado `ink-250`.

## Components

Refinados y contenidos: controles de 32 a 40 px, bordes en lugar de rellenos, el color solo en la acción.

### Buttons
`ui.*` en `components/ui.tsx`.
- **Shape:** esquinas suaves (6 px).
- **Primary** (`ui.buttonPrimary`): fondo `gold-800`, texto blanco, 14 px 500, 16 px laterales; 36 px de alto en escritorio y 40 px en móvil. Hover a `gold-800-hover`.
- **Secondary** (`ui.buttonSecondary`): fondo blanco, borde `ink-250`, texto `ink-950`; hover `surface-2`.
- **Danger** (`ui.buttonDanger`): fondo `danger-700`, texto blanco; hover `danger-700-hover`. Solo en fichas, nunca en filas de lista.
- **Small** (`*Sm`): 32 px en escritorio y 36 px en móvil, 12 px de texto, 12 px laterales. Para barras de filtro, paginación y acciones dentro de tablas.
- **Disabled:** estado neutro único para todas las variantes: fondo `surface-2`, texto `ink-400`, borde `ink-250`, cursor no permitido. Nunca opacidad sobre el color de marca o de peligro.
- **Hover / Focus:** transición de color en 120 ms con la curva de la casa; foco global de 2 px `gold-600` desplazado 2 px.

### Chips (Badge)
`Badge` en `components/ui.tsx`; `PaymentStatusBadge` y `EventStatusBadge` en `components/finance.tsx`.
- **Style:** píldora, 12 px 500, 2 x 8 px, fondo 100, texto 700 y anillo interior 300 del tono. Tonos: `neutral`, `gold`, `ok`, `warn`, `danger`, `info`.
- **Ícono:** con texto plano, `ok`, `warn`, `danger` e `info` añaden su ícono de 12 px (CircleCheck, AlertTriangle, CircleX, Info). Los estados neutros que lo necesitan pasan el suyo (Clock para pendiente, CircleSlash para cancelado).
- **Celda:** los badges nunca se cortan; su celda es `flex flex-wrap gap-1`.

### Cards / Containers
`Card` en `components/ui.tsx`.
- **Corner Style:** 8 px.
- **Background:** `surface` sobre `paper`.
- **Shadow Strategy:** ninguna (ver Elevation & Depth).
- **Border:** 1 px `ink-150`; la cabecera opcional lleva divisor inferior.
- **Internal Padding:** 16 px; cabecera de 12 x 16 px con título de 16 px 600.
- **Callout de aviso:** `rounded-lg`, borde `warn-300`, fondo `warn-100`, texto `warn-700` con ícono (`promociones/page.tsx`, `finanzas/page.tsx`). Error de datos: `DataError` en `components/finance.tsx` con los tonos danger y `role="alert"`.

### Inputs / Fields
`ui.field`, `ui.fieldSm`, `Select` en `components/ui.tsx`; `Field` en `components/filters.tsx`.
- **Style:** fondo blanco, borde `ink-250`, 6 px de radio, 36 px (`field`) o 32 px (`fieldSm`), placeholder `ink-400`. Texto a 16 px en móvil, 14 o 12 px desde `sm`.
- **Hover:** borde a `ink-400`.
- **Focus:** borde `gold-600` y anillo de 2 px `gold-600` al 25 %.
- **Disabled:** fondo `surface-2`, texto `ink-400`.
- **Select:** sin flecha nativa; chevron de 16 px `ink-400` a la derecha y 32 px de relleno derecho. Mismas props que `<select>` más `size` `sm` o `md`. Nunca a todo el ancho de una columna ancha en escritorio.
- **Fecha:** `lang="es-MX"` y el formato en la etiqueta cuando no es obvio.
- **Etiqueta:** 12 px 500 `ink-800`, encima del control.

### Navigation
`app/(admin)/layout.tsx` y `components/nav-links.tsx`.
- **Barra:** 240 px, `nav-bg`. Marca arriba (`BrandMark` de 24 px + "Celebraloo" 15 px 600 blanco + rol en 12 px `nav-muted`). Cuenta al pie tras una regla `nav-rule`.
- **Grupos:** sin título para Inicio y Alertas; luego Operación, Dinero, Catálogo, Análisis, Control con título de 11 px. Un grupo sin ítems permitidos para el rol no se muestra.
- **Ítem:** 36 px, 6 px de radio, 13 px 500, ícono lucide de 16 px. Reposo `nav-fg` al 85 % con ícono `nav-muted`; hover `nav-hover` y texto blanco; activo `nav-active`, texto blanco, ícono `nav-accent` y una raya de 2 px `nav-accent` a la izquierda (la única aparición del acento en la barra). Foco en `nav-accent`.
- **Móvil:** encabezado oscuro de 56 px con "Menú"; el menú es un `<details>` que entra con `animate-enter`, se cierra al navegar, con Escape o tocando el velo, e incluye la cuenta y "Cerrar sesión" (44 px).

### Table
`Table` en `components/ui.tsx`; `SalesTable` en `components/finance.tsx`.
- Superficie de 8 px con cabecera opcional (título 16 px + `aside` a la derecha), encabezado `surface-2` de 40 px con texto 12 px `ink-600`, filas divididas por `ink-150`, celdas de 10 x 12 px. Las filas con enlace se aclaran a `surface-2` al 50 % en hover; el enlace del total cubre la fila completa.
- `caption` solo para lectores de pantalla, `align` para montos a la derecha, `mobileHide` para las columnas que se ocultan en móvil, `empty` para el vacío centrado (32 px de alto, `ink-600`).

### Figure Strip
`FigureStrip`, `FigureRow`, `Figure`, `KpiTile`, `Delta` en `components/kpi.tsx`; `MoneyTile` en `components/finance.tsx`.
- Un solo panel con divisores de 1 px (el fondo `ink-150` asoma por `gap-px`) en lugar de tarjetas iguales. Cada fila tiene su peso: `lg` (28 px), `md` (20 px), `sm` (16 px).
- Etiqueta 13 px `ink-600` en una línea; con `emphasis`, etiqueta `gold-800` 500 y (en `KpiTile`/`MoneyTile`) borde `gold-600`, nunca fondo de color.
- `Delta`: flecha + texto + color tenue (`ok-700` sube, `danger-700` baja, `ink-600` igual). Sin dato anterior no se dibuja nada; la página pone una sola nota.
- `KpiTile` y `MoneyTile` son la variante suelta para cuando una cifra va sola.

### Segmented
`Segmented` en `components/ui.tsx`: enlaces en un carril `surface-2` con anillo `ink-150`; la opción actual en blanco con la sombra de segmento. La elección vive en la URL. Sin `wrap`, un solo renglón con scroll propio (el control de métrica de Inicio no se parte en móvil).

### Confirm Action
`ConfirmAction` en `components/confirm-action.tsx`: el botón abre en su lugar un panel `surface-2` al 60 % con el campo "Motivo" (mínimo 3 caracteres, máximo 500), confirmar y cancelar. Tonos `neutral`, `primary`, `danger`, `ok`. Con `disabledReason`, botón deshabilitado neutro y la razón debajo en 12 px. El resultado se anuncia en un `role="status"` siempre montado; al cerrar, el foco vuelve al botón.

### Patrones

**Encabezado de una línea** (`PageTitle`, `components/ui.tsx`). El subtítulo es una línea de estado o propósito (unos 80 caracteres): "15 clientes · 7 de prueba". Nada de fórmulas ni explicaciones de columnas en el encabezado. Las fichas añaden `Breadcrumb` encima del título.

**Cómo se calcula** (`HowCalculated`, `components/ui.tsx`). Definiciones y fórmulas plegadas en un `<details>` debajo de la cifra o tabla que explican: 13 px `ink-600`, ícono Info de 14 px, chevron de 14 px que gira 90° al abrir, sin triángulo nativo. Máximo dos visibles por página; si hay más, se fusionan en uno al final. Todo `<summary>` del panel sigue la misma forma (`list-none [&::-webkit-details-marker]:hidden` + chevron que gira).

**Ceros atenuados** (`zeroClass`, `components/ui.tsx`). Un monto o conteo igual a cero va en `ink-400` (4.8:1): `cn(base, zeroClass(valor, "text-ink-800"))`. `Figure`/`KpiTile` lo aplican solos cuando reciben un valor formateado; `SeverityTotals` muestra los contadores en cero sin color de estado. Un cero pesa menos que una cifra real porque el vacío es el estado normal.

**Búsqueda de lista** (`SearchField`, `components/filters.tsx`). Toda lista busca con el mismo campo (ícono, `type=search`, `name="q"`), siempre primero dentro de `FilterBar`; después los `Select`, luego las fechas.

**Vacíos con Nil** (`Nil`, `components/ui.tsx`). Todo valor vacío es una raya `ink-600` visible y "Sin dato" (o la etiqueta dada) para lectores de pantalla. Una tabla vacía dice qué falta en una línea ("Aún no hay ventas cobradas."). Una tabla con todas las filas en cero se resume en una línea con la tabla detrás de "Ver meses" o "Ver filas" (`reportes/page.tsx`, `configuracion/page.tsx`); si solo algunas filas son cero, se atenúan. Una gráfica en cero no dibuja ejes: una franja compacta con el mensaje.

**Chips solo para excepciones** (`clientes/page.tsx`, `usuarios/page.tsx`). El estado normal no se dibuja. Clientes muestra De pago, Suspendida, Sin confirmar o Staff; Usuarios solo Suspendida o Sin confirmar; Catálogo solo Inactivo; Actividad muestra el tipo como texto `ink-600` con su ícono.

**Filtros como barra de tabla** (`FilterBar`, `components/filters.tsx`). Formulario GET sin caja propia, pegado encima de la tabla: controles de 32 px (`ui.fieldSm`), etiqueta visible solo donde el campo no se explica, "Filtrar" como botón secundario chico, "Limpiar" solo con un filtro activo (`active`), conteo de resultados a la derecha (`count`). En móvil, rejilla de dos columnas con Filtrar y Limpiar en el mismo renglón. `Pagination` no repite el conteo (`hideTotal`).

**Listas en móvil** (`Table` `mobileHide`, `SalesTable`). Debajo de 640 px la fila muestra lo que identifica (nombre) y lo que decide (monto o estado). La fecha oculta baja como segunda línea de 12 px `ink-600` bajo el nombre; los chips de excepción bajan bajo el correo dentro de la primera celda.

**Persona** (`SalesTable`, `clientes/page.tsx`). Nombre 14 px `ink-950` con el correo debajo 12 px `ink-600`, en una celda; sin nombre, el correo sube. Correos e IDs nunca se parten: `truncate` con el valor completo en `title`.

**Ficha como contrato** (`app/(admin)/eventos/[id]/page.tsx`, `components/permissions-editor.tsx`). La franja de arriba lleva Plan, Invitación y Edición, y debajo Invitados, QR, Check-ins y Fotos. Motivo y acciones en una barra compacta (motivo + plan + "Aplicar plan" + complemento + "Sumar complemento"; "Acceso total" secundario). Los permisos se separan en Añadidos / Del plan (o "Permisos base (sin plan)", con origen "Base") / Sin activar; cada fila es Permiso · Valor · Origen (badge) · acción. En móvil: encabezado, franja, permisos, compras y bitácora; después dueño, edición y notas; borrar al final.

**Bitácora por día** (`app/(admin)/actividad/page.tsx`). Páginas de 50, una fila de encabezado de día a todo el ancho cuando cambia la fecha, solo la hora en cada fila, tipo con ícono (Shield, UserPlus, CalendarHeart) en tono neutral.

**Formulario bloqueado** (`promociones/nueva/page.tsx`). El aviso va como callout de advertencia arriba del formulario y el `<fieldset>` va deshabilitado; el subtítulo queda neutro.

### Motion
Tokens en `app/globals.css`: `--dur-fast` 120 ms (hover, color, borde, chevrons; es la duración por defecto de toda `transition-*`), `--dur-base` 160 ms (la única entrada, `.animate-enter`: opacidad + 4 px hacia arriba, en el menú móvil y el panel de `ConfirmAction`), `--dur-slow` 200 ms (definido, sin uso hoy). Curva `--ease-out` `cubic-bezier(0.2, 0, 0, 1)` por defecto. Con `prefers-reduced-motion: reduce`, toda animación y transición dura 0.01 ms.

## Do's and Don'ts

### Haz:
- **Haz** que cada color salga de un token de `app/globals.css`; los componentes usan las clases `ink-*`, `gold-*`, `ok/warn/danger/info-*` y `nav-*`.
- **Haz** el texto en oro siempre en `gold-800` (6.8:1) y deja `gold-600` para bordes, anillos y foco (`app/globals.css`).
- **Haz** los botones y campos con `ui.*` y `Select` de `components/ui.tsx`; los chicos (32 px) en barras de filtro y tablas.
- **Haz** el subtítulo de `PageTitle` de una sola línea y lleva las fórmulas a `HowCalculated`, máximo dos por página (`components/ui.tsx`).
- **Haz** todo vacío con `<Nil />` (`components/ui.tsx`) y todo `<summary>` con chevron que gira, sin triángulo nativo.
- **Haz** las cifras en una `FigureStrip` con divisores y la cifra principal de dinero en tamaño `lg` (`components/kpi.tsx`).
- **Haz** que cada tabla declare `mobileHide` para quedarse con nombre y lo que decide a 390 px (`components/ui.tsx`, `Table`).
- **Haz** que toda acción sensible pase por `ConfirmAction` con motivo de 3 caracteres o más (`components/confirm-action.tsx`).
- **Haz** que la acción primaria viva en `actions` de `PageTitle`, arriba a la derecha (`components/ui.tsx`).
- **Haz** los estados con ícono y texto, nunca solo color (`components/ui.tsx`, `Badge`; `components/kpi.tsx`, `Delta`).
- **Haz** las transiciones en 120 a 200 ms con `--ease-out`, y las entradas solo con `.animate-enter` (`app/globals.css`).

### No hagas:
- **No hagas** un hex suelto en un componente (`AGENTS.md`); si falta un color, se agrega como token en `app/globals.css`.
- **No hagas** tarjetas blancas iguales para cada KPI ni el KPI con ícono en círculo (`components/kpi.tsx`, comentario de `FigureStrip`).
- **No hagas** chips para el estado normal de cada fila (`app/(admin)/clientes/page.tsx`, `app/(admin)/usuarios/page.tsx`).
- **No hagas** badges de categoría rutinaria en oro ni en color de estado; van en tono `neutral` (`components/ui.tsx`, `Badge`).
- **No hagas** botones deshabilitados con opacidad sobre oro o rojo; el deshabilitado es el estado neutro de `ui.*` (`components/ui.tsx`).
- **No hagas** una acción destructiva repetida en cada fila; vive en la ficha, al final en móvil (`app/(admin)/eventos/[id]/page.tsx`, `max-lg:order-last`).
- **No hagas** "Sin dato", "—" o "-" escritos a mano, ni en monoespaciada (`components/ui.tsx`, `Nil`).
- **No hagas** claves internas (slugs, claves de producto) como texto visible; van en `title` (`.bunshin/decisions/round-1.md`, R2).
- **No hagas** sombras en superficies; solo el segmento elegido y las capas flotantes (`components/ui.tsx`, `Segmented`; `components/metric-chart.tsx`).
- **No hagas** el oro claro (`#c8a96a`, `#d4b578`) sobre fondo blanco (`components/ui.tsx`, `BrandMark`; `components/nav-links.tsx`).
- **No hagas** animaciones al hacer scroll, entradas por sección, rebote ni parallax (`app/globals.css`).
- **No hagas** etiquetas en mayúsculas espaciadas fuera de los títulos de grupo de la barra (`components/nav-links.tsx`).

## Mobile

Debajo de `md` (768 px) el panel es una herramienta de celular, no el escritorio acomodado. En escritorio nada de esto se ve. Reglas en `.bunshin/decisions/mobile.md`.

- **Barra inferior** (`BottomTabs`, `components/nav-links.tsx`): Inicio, Alertas (con conteo), Clientes, Eventos y "Más", filtradas por permiso; "Más" abre una hoja desde abajo (`<dialog>`) con todas las áreas, la cuenta y "Cerrar sesión". El encabezado móvil solo lleva la marca y el área actual. `<main>` reserva el alto de la barra con `env(safe-area-inset-bottom)`.
- **Listas como tarjetas** (`Table mobileCards` + `mobileHide`, clase `.table-cards` en `app/globals.css`): debajo de `sm`, cada fila es una tarjeta con lo que identifica a la izquierda y el monto o estado a la derecha; la fila completa abre la ficha.
- **Acción principal al pulgar** (`PageTitle primaryAction`, `components/ui.tsx`): en escritorio va a la derecha del título; en móvil es un botón ancho fijo arriba de la barra inferior.
- **Fichas navegables** (`SectionNav`, `components/ui.tsx`): chips con anclas a las secciones de la ficha (Resumen, Permisos, Compras, Bitácora, Notas); `scroll-margin` global para que la sección no quede bajo el encabezado.
- **Filtros plegados** (`FilterBar`, `components/filters.tsx`): la búsqueda siempre visible; el resto detrás de "Filtros" (con el conteo de activos); "Filtrar" solo aparece con el pliegue abierto, la búsqueda se envía con la tecla del teclado.
- **Tacto**: botones, selects, campos chicos, pestañas y filas tocables miden al menos 44 px en móvil (`max-md:h-11` en `ui.*`).
