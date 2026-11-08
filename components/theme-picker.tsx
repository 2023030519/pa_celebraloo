"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/components/ui";
import type { Theme } from "@/lib/theme";

const OPTIONS = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
] as const;

/** Guarda el tema en la cookie que app/layout.tsx lee (pinta sin parpadeo) y lo aplica ya. */
function applyTheme(next: Theme) {
  document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  if (next === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", next);
}

/** Tema del panel en este navegador. */
export function ThemePicker({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <fieldset className="p-4">
      <legend className="sr-only">Tema</legend>
      <div className="flex w-fit max-w-full flex-wrap rounded-md bg-surface-2 p-0.5 ring-1 ring-ink-150 ring-inset">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-[5px] px-3 text-[13px] font-medium max-md:h-11 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-600",
              theme === value ? "bg-surface text-ink-950 shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-ink-150" : "text-ink-600 hover:text-ink-950"
            )}
          >
            <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => choose(value)} className="sr-only" />
            <Icon size={14} aria-hidden="true" />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-600">Se guarda en este navegador. Sistema sigue el modo claro u oscuro de tu equipo.</p>
    </fieldset>
  );
}
