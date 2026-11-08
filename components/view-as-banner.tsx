"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

/**
 * Banner de "ver como usuario" con la cuenta regresiva de la sesión. Va pegado
 * arriba del contenido y se queda fijo al hacer scroll (en móvil, debajo de la
 * barra oscura de 56 px).
 */
export function ViewAsBanner({
  who,
  expiresAt,
  exitAction,
}: {
  who: string;
  expiresAt: string;
  exitAction: () => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const expired = left === 0;

  return (
    <section
      aria-label="Vista como usuario"
      className="sticky top-14 z-20 -mx-4 -mt-5 mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-info-300 bg-info-100 px-4 py-2.5 text-info-700 md:top-0 md:-mx-8 md:-mt-8 md:px-8"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm">
        <Eye size={16} aria-hidden="true" className="shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          Viendo como <strong className="font-semibold">{who}</strong> · solo lectura
        </span>
      </p>
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium tabular-nums">
          {expired ? "La vista expiró" : `Expira en ${minutes}:${String(seconds).padStart(2, "0")}`}
        </span>
        {/* La cuenta cambia cada segundo y no se anuncia; solo se anuncia cuando expira. */}
        <span role="status" className="sr-only">
          {expired ? "La vista expiró. Ábrela de nuevo desde la ficha del cliente." : ""}
        </span>
        <form action={exitAction}>
          <button className="inline-flex h-11 items-center justify-center rounded-md border border-info-300 bg-surface px-3 text-[13px] font-medium text-info-700 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-info-700 md:h-8">
            Salir de la vista
          </button>
        </form>
      </div>
    </section>
  );
}
