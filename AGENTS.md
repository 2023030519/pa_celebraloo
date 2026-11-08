<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Diseño del panel (rediseño de noviembre de 2026)

Dirección validada por el usuario: **panel estándar de la categoría (nivel Stripe Dashboard, Linear, Shopify Polaris) con la barra lateral oscura**. El sistema completo está en `DESIGN.md`; el contrato en `.impeccable/surfaces/app-admin-page-tsx.md`; la verdad del producto en `PRODUCT.md`.

## Dónde se hace cada cambio
- Colores, tipografía, movimiento: tokens en `app/globals.css` (`--paper`, `--surface`, `--ink-*`, `--gold-*`, estados `ok/warn/danger/info`, barra `--nav-*`, `--dur-*`, `--ease-out`). Nunca un hex suelto en un componente.
- Shell (barra oscura, menú móvil, marca, enlace "Saltar al contenido"): `app/(admin)/layout.tsx` y `components/nav-links.tsx`.
- Piezas compartidas: `components/ui.tsx` (`ui.*` botones y campos, `PageTitle`, `Breadcrumb`, `Card`, `Badge`, `Table`, `Select`, `Segmented`, `Nil`, `HowCalculated`, `BrandMark`), `components/kpi.tsx` (`FigureStrip`, `Figure`, `KpiTile`), `components/filters.tsx` (`FilterBar`, `Field`, `Pagination`), `components/finance.tsx` (`SalesTable`), `components/confirm-action.tsx` (acción con motivo).
- Una sección nueva: copia la composición de una existente (lista: `PageTitle` + `FilterBar` + `Table`; ficha: `Breadcrumb` + dos columnas `lg:grid-cols-[minmax(0,1fr)_320px]`).

## Reglas de diseño (no se negocian)
- Un solo acento, el oro: acción primaria, ítem activo, enlaces, foco y selección. Los colores de estado solo cuando el estado pide atención, siempre con ícono o texto.
- Encabezado de página = una línea de estado o propósito. Definiciones y fórmulas van en `<HowCalculated>` (máximo dos por página).
- Todo valor vacío es `<Nil />`. Chips solo para excepciones (no para el estado normal).
- Listas en móvil: nombre + lo que decide (monto o estado) con `mobileHide`; nada se corta ni desborda a 390 px.
- Lo destructivo va al final y pide motivo; toda acción sensible pide motivo (mínimo 3 caracteres) y queda en Actividad.
- Movimiento: 120–200 ms con `--ease-out`; nada al hacer scroll; `prefers-reduced-motion` ya está global.
- Español de México, de tú. Nada de raya larga (U+2014) en textos nuevos salvo el glifo de `Nil`.

## Antes de subir un cambio
- `npx tsc --noEmit` y `pnpm lint` sin errores; `./node_modules/.bin/next build` con exit 0.
- Revisa la pantalla a 1440 y 390 px: sin scroll horizontal, sin badges cortados, foco visible con teclado. En móvil usa los contratos de la sección "Mobile" de DESIGN.md (barra inferior, `Table mobileCards`, `PageTitle primaryAction`, `SectionNav`, `FilterBar` plegado).
