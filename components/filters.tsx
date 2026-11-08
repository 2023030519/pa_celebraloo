import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { Children, isValidElement, type ReactNode } from "react";
import { cn, ui } from "@/components/ui";

// Controles de 32 px: los filtros son la barra de herramientas de la tabla, no un formulario.
export const fieldClass = ui.fieldSm;

/**
 * Filtros en una barra compacta pegada a la tabla (GET: la URL se puede compartir).
 * active: hay algún filtro aplicado (si no se pasa, "Limpiar" se muestra siempre).
 * count: conteo de resultados, a la derecha.
 * Orden fijo (R23): los hijos van como <SearchField> primero, luego los <Select>, luego las
 * fechas (<Field> con input date) y al final los ocultos; Filtrar/Limpiar y el conteo los pone FilterBar.
 * M5: en móvil (debajo de md) la búsqueda queda a la vista y el resto se pliega tras "Filtros";
 * activeCount (cuántos filtros, sin contar la búsqueda, están aplicados) se muestra en ese botón.
 */
export function FilterBar({
  children,
  resetHref,
  active,
  activeCount,
  count,
}: {
  children: ReactNode;
  resetHref: string;
  active?: boolean;
  activeCount?: number;
  count?: ReactNode;
}) {
  const items = Children.toArray(children);
  const search = isValidElement(items[0]) && items[0].type === SearchField ? items[0] : null;
  const rest = search ? items.slice(1) : items;
  // Los ocultos (input type=hidden) no necesitan pliegue: solo cuenta lo que se ve.
  const foldable = rest.some((item) => !(isValidElement<{ type?: string }>(item) && item.type === "input" && item.props.type === "hidden"));
  return (
    <form className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 md:flex md:flex-wrap" role="search">
      {search}
      {foldable && (
        // Casilla sin name (no viaja en la URL): abre y cierra el pliegue solo con CSS.
        <label
          data-filters-toggle
          className={cn(ui.buttonSecondarySm, "cursor-pointer has-[:checked]:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-600 md:hidden")}
        >
          <input type="checkbox" className="sr-only" />
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filtros
          {activeCount ? (
            <span className="rounded-full bg-gold-100 px-1.5 text-gold-800 tabular-nums ring-1 ring-gold-200 ring-inset">
              {activeCount}
              <span className="sr-only"> activos</span>
            </span>
          ) : null}
        </label>
      )}
      <div className="col-span-2 flex flex-col gap-2 max-md:hidden max-md:[form:has([data-filters-toggle]_:checked)_&]:flex md:contents">{rest}</div>
      {/* Filtrar y Limpiar comparten renglón. En móvil, Filtrar solo aparece con el pliegue abierto:
          la búsqueda se envía con la tecla Buscar del teclado y no deja un botón suelto. */}
      <div className="col-span-2 flex items-center gap-3 empty:hidden md:col-auto">
        <button
          className={cn(
            ui.buttonSecondarySm,
            "max-md:hidden max-md:flex-1 max-md:[form:has([data-filters-toggle]_:checked)_&]:inline-flex"
          )}
        >
          Filtrar
        </button>
        {active !== false && (
          <Link href={resetHref} className="flex h-11 items-center rounded-md px-2 text-xs font-medium text-ink-600 hover:bg-surface-2 hover:text-ink-950 md:h-8">
            Limpiar
          </Link>
        )}
      </div>
      {count !== undefined && <p className="col-span-2 text-xs text-ink-600 tabular-nums md:ml-auto md:flex md:h-8 md:items-center">{count}</p>}
    </form>
  );
}

/**
 * R23: la búsqueda de toda lista, primer hijo de FilterBar. El ícono y el texto de ejemplo
 * explican el campo: la etiqueta (label) queda para lectores de pantalla.
 */
export function SearchField({
  label,
  placeholder,
  defaultValue,
  name = "q",
}: {
  label: string;
  placeholder: string;
  defaultValue?: string;
  name?: string;
}) {
  return (
    // Sin botón "Filtros" a su lado (nada que plegar), la búsqueda ocupa todo el renglón móvil.
    <div className="relative min-w-0 max-md:[&:not(:has(+[data-filters-toggle]))]:col-span-2">
      <Search size={14} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        name={name}
        aria-label={label}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={cn(fieldClass, "w-full pl-8 md:w-64")}
      />
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // En móvil el ancho que fije la página (w-56…) cede a la celda de la rejilla.
    <label className="flex min-w-0 flex-col gap-1 max-sm:[&>div]:w-full max-sm:[&>input]:w-full max-sm:[&>select]:w-full">
      <span className="text-xs font-medium text-ink-800">{label}</span>
      {children}
    </label>
  );
}

/** Paginación por página; conserva los demás parámetros de la URL. */
export function Pagination({
  page,
  pageSize,
  total,
  params,
  basePath,
  hideTotal = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
  basePath: string;
  /** true cuando FilterBar ya muestra el conteo (count): el pie no lo repite. */
  hideTotal?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return hideTotal ? null : <p className="mt-3 text-xs text-ink-600">{total} resultados</p>;
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "pagina") query.set(key, value);
    if (target > 1) query.set("pagina", String(target));
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  const linkClass = ui.buttonSecondarySm;
  return (
    <nav className="mt-3 flex items-center gap-2 text-xs" aria-label="Paginación">
      <span className="text-ink-600">
        {hideTotal ? `Página ${page} de ${pages}` : `${total} resultados · página ${page} de ${pages}`}
      </span>
      {page > 1 && (
        <Link href={href(page - 1)} className={linkClass}>
          <ChevronLeft size={14} aria-hidden="true" />
          Anterior
        </Link>
      )}
      {page < pages && (
        <Link href={href(page + 1)} className={linkClass}>
          Siguiente
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}

export function pageFrom(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
