import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink-950">{title}</h1>
        {subtitle && <div className="mt-1 text-ink-600">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-ink-150 bg-surface shadow-sm", className)}>
      {title && <h2 className="border-b border-ink-150 px-4 py-3 text-[13px] font-semibold">{title}</h2>}
      <div className="p-4">{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "gold" | "ok" | "warn" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-800",
  gold: "bg-gold-100 text-gold-800",
  ok: "bg-ok-100 text-ok-700",
  warn: "bg-warn-100 text-warn-700",
  danger: "bg-danger-100 text-danger-700",
  info: "bg-info-100 text-info-700",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", toneClass[tone])}>
      {children}
    </span>
  );
}

export function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold text-ink-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </>
  );
  const className = "rounded-xl border border-ink-150 bg-surface p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-gold-600")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Tabla con scroll horizontal propio: en pantallas angostas no desborda la página. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-150 bg-surface shadow-sm">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead className="bg-surface-2 text-[11px] uppercase tracking-[0.08em] text-ink-600">
          <tr>
            {head.map((cell, index) => (
              <th key={index} className="px-3 py-2.5 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-150">{children}</tbody>
      </table>
      {empty && <p className="px-3 py-6 text-center text-ink-600">{empty}</p>}
    </div>
  );
}

export function SearchForm({ defaultValue, placeholder }: { defaultValue: string; placeholder: string }) {
  return (
    <form className="mb-4 flex gap-2" role="search">
      <input
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full max-w-sm rounded-md border border-ink-250 bg-surface px-3 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30"
      />
      <button className="h-9 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800">Buscar</button>
    </form>
  );
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}
