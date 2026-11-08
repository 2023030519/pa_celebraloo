/** Esqueleto mientras carga la sección: señal de que el clic en el menú sí hizo algo. */
export default function Loading() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Cargando…</span>
      <div className="mb-6 h-6 w-[200px] rounded bg-surface-2" />
      <div className="rounded-lg border border-ink-150 bg-surface">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex h-10 items-center border-b border-ink-150 px-4 last:border-b-0">
            <div className="h-3 w-3/5 rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
