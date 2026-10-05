"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

/** Banner fijo de "ver como usuario" con la cuenta regresiva de la sesión. */
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
    <div
      role="status"
      className="sticky top-0 z-20 -mx-4 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-info-300 bg-info-100 px-4 py-3 text-info-700 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
    >
      <p className="flex items-center gap-2 font-semibold">
        <Eye size={16} aria-hidden="true" />
        Viendo como {who} · solo lectura
      </p>
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tabular-nums">
          {expired ? "La vista expiró" : `Expira en ${minutes}:${String(seconds).padStart(2, "0")}`}
        </span>
        <form action={exitAction}>
          <button className="h-8 rounded-md bg-info-700 px-3 text-xs font-semibold text-surface hover:opacity-90">Salir de la vista</button>
        </form>
      </div>
    </div>
  );
}
