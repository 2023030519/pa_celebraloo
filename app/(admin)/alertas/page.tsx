import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-admin";
import { getAlertCounts, getAlerts, type AlertCount } from "@/lib/data/admin";
import { ALERT_KINDS, AlertList, SEVERITIES, SEVERITY_META, SeverityIcon, SeverityTotals } from "@/components/alerts";
import { DataError } from "@/components/finance";
import { PageTitle, cn, zeroClass } from "@/components/ui";
import { formatInt } from "@/lib/format";

export const metadata: Metadata = { title: "Alertas" };

const KIND = /^[a-z_]{3,40}$/;

/** Filtro por tipo: chip en móvil, renglón de la columna de filtros en escritorio. Seleccionado = oro. */
function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-8 max-md:min-h-11 items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-[13px] whitespace-nowrap transition-colors duration-[var(--dur-fast)] lg:flex lg:w-full lg:border-transparent lg:whitespace-normal",
        active
          ? "border-gold-600 bg-gold-100 font-medium text-gold-800 lg:border-transparent"
          : "border-ink-150 bg-surface text-ink-800 hover:bg-surface-2 hover:text-ink-950 lg:bg-transparent"
      )}
    >
      {children}
    </Link>
  );
}

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await requirePermission("alertas.read");
  const { tipo } = await searchParams;
  const kind = tipo && KIND.test(tipo) ? tipo : null;

  // Cada parte con su propio error: si el conteo se agota (statement timeout), la lista igual carga.
  const [countsR, itemsR] = await Promise.allSettled([getAlertCounts(), getAlerts(kind, 500)]);
  const counts: AlertCount[] = countsR.status === "fulfilled" ? countsR.value : [];

  const total = counts.reduce((sum, count) => sum + count.total, 0);
  const shown = kind ? counts.find((count) => count.kind === kind)?.total ?? 0 : total;
  const kindLabel = kind ? ALERT_KINDS[kind] ?? kind : "Todas";

  return (
    <>
      <PageTitle
        title="Alertas"
        subtitle="Ordenadas por severidad y fecha; cada una lleva a su venta, evento o cliente."
      />

      <div className="mb-5">
        {countsR.status === "rejected" ? <DataError error={countsR.reason} /> : <SeverityTotals counts={counts} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <nav aria-label="Filtrar por tipo" className="flex flex-col gap-3 lg:sticky lg:top-8">
          <div className="flex flex-wrap gap-2">
            <FilterLink href="/alertas" active={!kind}>
              <span>Todas</span>
              {countsR.status === "fulfilled" && <span className={cn("tabular-nums", zeroClass(total, "text-ink-600"))}>{formatInt(total)}</span>}
            </FilterLink>
          </div>
          {SEVERITIES.map((severity) => {
            const ofSeverity = counts.filter((count) => count.severity === severity);
            if (ofSeverity.length === 0) return null;
            return (
              <div key={severity} className="flex flex-col gap-1.5 lg:gap-0.5">
                <p className={cn("flex items-center gap-1.5 text-xs font-medium lg:px-2.5 lg:pb-1", SEVERITY_META[severity].text)}>
                  <SeverityIcon severity={severity} size={13} /> {SEVERITY_META[severity].label}
                </p>
                {/* Móvil: un renglón por severidad que se desliza, para que la lista no quede hasta abajo. */}
                <div className="flex flex-wrap gap-2 max-md:-mx-4 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 lg:flex-col lg:gap-0.5">
                  {ofSeverity.map((count) => (
                    <FilterLink key={count.kind} href={`/alertas?tipo=${count.kind}`} active={kind === count.kind}>
                      <span>{ALERT_KINDS[count.kind] ?? count.kind}</span>
                      <span className={cn("tabular-nums", zeroClass(count.total, "text-ink-600"))}>{formatInt(count.total)}</span>
                    </FilterLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <section aria-labelledby="alert-list" className="min-w-0 rounded-lg border border-ink-150 bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-150 px-4 py-3">
            <h2 id="alert-list" className="text-base font-semibold text-ink-950">
              {kindLabel}
              {countsR.status === "fulfilled" && <span className={cn("font-normal tabular-nums", zeroClass(shown, "text-ink-600"))}> · {formatInt(shown)}</span>}
            </h2>
          </div>
          <div className="px-4 py-1">
            {itemsR.status === "rejected" ? (
              <div className="py-3">
                <DataError error={itemsR.reason} />
              </div>
            ) : (
              <AlertList items={itemsR.value} empty={kind ? "No hay alertas de este tipo." : "Sin alertas: todo en orden."} />
            )}
          </div>
          {itemsR.status === "fulfilled" && itemsR.value.length < shown && (
            <p className="border-t border-ink-150 px-4 py-2.5 text-xs text-ink-600">
              Se muestran las primeras {formatInt(itemsR.value.length)}. Filtra por tipo para ver el resto.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
