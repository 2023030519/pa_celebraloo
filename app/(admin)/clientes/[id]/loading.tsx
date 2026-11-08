/**
 * Esqueleto de la ficha de cliente: aparece en cuanto tocas un cliente, con la misma
 * forma que la ficha (título, cifras, datos y tablas), mientras llegan los datos.
 * Va en esta carpeta (no basta el de (admin)) para que Next lo muestre también al pasar de la lista a una ficha.
 */
const bar = "animate-pulse rounded bg-surface-2";

function Panel({ rows, title = "w-24" }: { rows: number; title?: string }) {
  return (
    <div className="rounded-lg border border-ink-150 bg-surface">
      <div className="border-b border-ink-150 px-4 py-3.5">
        <div className={`h-4 ${title} ${bar}`} />
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-12 items-center justify-between gap-4 border-b border-ink-150 px-4 last:border-b-0">
          <div className={`h-3 w-2/5 ${bar}`} />
          <div className={`h-3 w-16 ${bar}`} />
        </div>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Cargando cliente…</span>
      <div className={`mb-3 h-3 w-16 ${bar}`} />
      <div className={`mb-2 h-7 w-56 max-w-full ${bar}`} />
      <div className={`mb-6 h-4 w-72 max-w-full ${bar}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-ink-150 bg-ink-150">
            {[0, 1, 2].map((cell) => (
              <div key={cell} className="flex flex-col gap-2 bg-surface p-4">
                <div className={`h-3 w-16 ${bar}`} />
                <div className={`h-5 w-12 ${bar}`} />
              </div>
            ))}
          </div>
          <Panel rows={5} title="w-32" />
        </div>
        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
          <Panel rows={3} />
          <Panel rows={3} />
        </div>
      </div>
    </div>
  );
}
