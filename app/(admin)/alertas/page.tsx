import Link from "next/link";
import { requirePermission } from "@/lib/auth/require-admin";
import { getAlertCounts, getAlerts, type AlertCount } from "@/lib/data/admin";
import { ALERT_KINDS, AlertList, SEVERITIES, SEVERITY_META, SeverityIcon, SeverityTotals } from "@/components/alerts";
import { DataError } from "@/components/finance";
import { Card, PageTitle, cn } from "@/components/ui";
import { formatInt } from "@/lib/format";

const KIND = /^[a-z_]{3,40}$/;

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        active ? "border-ink-950 bg-ink-950 text-surface" : "border-ink-250 bg-surface text-ink-800 hover:bg-paper"
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

  let counts: AlertCount[];
  let items;
  try {
    [counts, items] = await Promise.all([getAlertCounts(), getAlerts(kind, 500)]);
  } catch (error) {
    return (
      <>
        <PageTitle title="Alertas" />
        <DataError error={error} />
      </>
    );
  }

  const total = counts.reduce((sum, count) => sum + count.total, 0);
  const shown = kind ? counts.find((count) => count.kind === kind)?.total ?? 0 : total;

  return (
    <>
      <PageTitle
        title="Alertas"
        subtitle="Ordenadas por severidad y luego por fecha. Cada alerta lleva a la venta, el evento o el cliente."
      />

      <div className="mb-4">
        <SeverityTotals counts={counts} />
      </div>

      <nav aria-label="Filtrar por tipo" className="mb-4 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <FilterChip href="/alertas" active={!kind}>
            Todas <span className="tabular-nums">{formatInt(total)}</span>
          </FilterChip>
        </div>
        {SEVERITIES.map((severity) => {
          const ofSeverity = counts.filter((count) => count.severity === severity);
          if (ofSeverity.length === 0) return null;
          return (
            <div key={severity} className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex w-24 items-center gap-1 text-xs font-semibold", SEVERITY_META[severity].text)}>
                <SeverityIcon severity={severity} size={13} /> {SEVERITY_META[severity].label}
              </span>
              {ofSeverity.map((count) => (
                <FilterChip key={count.kind} href={`/alertas?tipo=${count.kind}`} active={kind === count.kind}>
                  {ALERT_KINDS[count.kind] ?? count.kind} <span className="tabular-nums">{formatInt(count.total)}</span>
                </FilterChip>
              ))}
            </div>
          );
        })}
      </nav>

      <Card title={kind ? `${ALERT_KINDS[kind] ?? kind} · ${formatInt(shown)}` : `Todas · ${formatInt(shown)}`}>
        <AlertList
          items={items}
          empty={kind ? "No hay alertas de este tipo." : "Sin alertas: todo en orden."}
        />
        {items.length < shown && (
          <p className="mt-2 text-xs text-ink-600">
            Se muestran las primeras {formatInt(items.length)}. Filtra por tipo para ver el resto.
          </p>
        )}
      </Card>
    </>
  );
}
