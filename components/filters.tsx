import Link from "next/link";
import type { ReactNode } from "react";

export const fieldClass =
  "h-9 rounded-md border border-ink-250 bg-surface px-2.5 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30";

/** Filtros en una sola fila arriba de la tabla (GET: la URL se puede compartir). */
export function FilterBar({ children, resetHref }: { children: ReactNode; resetHref: string }) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
      {children}
      <button className="h-9 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800">Filtrar</button>
      <Link href={resetHref} className="flex h-9 items-center rounded-md px-3 font-semibold text-ink-800 hover:bg-surface">
        Limpiar
      </Link>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600">{label}</span>
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
}: {
  page: number;
  pageSize: number;
  total: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-3 text-xs text-ink-600">{total} resultados</p>;
  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "pagina") query.set(key, value);
    if (target > 1) query.set("pagina", String(target));
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  const linkClass = "rounded-md px-3 py-1.5 font-semibold hover:bg-surface";
  return (
    <nav className="mt-3 flex items-center gap-2 text-xs" aria-label="Paginación">
      <span className="text-ink-600">
        {total} resultados · página {page} de {pages}
      </span>
      {page > 1 && (
        <Link href={href(page - 1)} className={linkClass}>
          ← Anterior
        </Link>
      )}
      {page < pages && (
        <Link href={href(page + 1)} className={linkClass}>
          Siguiente →
        </Link>
      )}
    </nav>
  );
}

export function pageFrom(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
