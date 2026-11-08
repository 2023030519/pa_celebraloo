import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { requirePermission } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getFinanceSummary } from "@/lib/data/admin";
import { EXPENSE_CATEGORIES, formatDay, formatInt, formatMxn, monthLabel, monthOrCurrent, monthRange, shiftMonth } from "@/lib/format";
import { Badge, HowCalculated, Nil, PageTitle, Select, Table, cn, ui, zeroClass } from "@/components/ui";
import { DataError } from "@/components/finance";
import { Figure, FigureRow, FigureStrip } from "@/components/kpi";
import { FilterBar } from "@/components/filters";

export const metadata: Metadata = { title: "Gastos" };

type Search = { mes?: string; categoria?: string };

const right = (text: string) => <span className="block text-right">{text}</span>;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePermission("gastos.read");
  const params = await searchParams;
  const month = monthOrCurrent(params.mes);
  const range = monthRange(month);
  const category = params.categoria && params.categoria in EXPENSE_CATEGORIES ? params.categoria : null;

  const supabase = await createClient();
  let query = supabase
    .from("admin_expenses")
    .select("id, expense_date, concept, category, vendor, subtotal_cents, tax_cents, total_cents, expense_type, periodicity, payment_method, recurring_expense_id")
    .gte("expense_date", range.from)
    .lt("expense_date", range.to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (category) query = query.eq("category", category);

  const [{ data: expenses, error }, summary] = await Promise.all([
    query,
    getFinanceSummary(range.from, range.to).catch((summaryError: unknown) => summaryError),
  ]);
  if (error) return <DataError error={new Error(error.message)} />;
  if (summary instanceof Error) return <DataError error={summary} />;
  const totals = summary as Awaited<ReturnType<typeof getFinanceSummary>>;
  const rows = expenses ?? [];
  const navClass =
    "inline-flex size-9 max-md:size-11 items-center justify-center rounded-md text-ink-800 transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 hover:text-ink-950";
  const monthHref = (target: string) => `/gastos?mes=${target}${category ? `&categoria=${category}` : ""}`;

  return (
    <>
      <PageTitle
        title="Gastos"
        subtitle="Gastos de Celebraloo. Cuentan en Finanzas por su fecha."
        actions={
          <Link href="/gastos/suscripciones" className={ui.buttonSecondary}>
            <Repeat size={16} aria-hidden="true" /> Suscripciones y servicios
          </Link>
        }
        primaryAction={
          <Link href="/gastos/nuevo" className={ui.buttonPrimary}>
            <Plus size={16} aria-hidden="true" /> Registrar gasto
          </Link>
        }
      />

      <nav className="mb-4 inline-flex items-center rounded-md border border-ink-150 bg-surface text-sm" aria-label="Mes">
        <Link href={monthHref(shiftMonth(month, -1))} className={navClass} aria-label="Mes anterior">
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
        <span className="min-w-36 px-2 text-center font-medium text-ink-950">{monthLabel(month)}</span>
        <Link href={monthHref(shiftMonth(month, 1))} className={navClass} aria-label="Mes siguiente">
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </nav>

      <h2 className="sr-only">Cifras de {monthLabel(month)}</h2>
      <div className="mb-6">
        <FigureStrip>
          <FigureRow cols={3} label={`Cifras de ${monthLabel(month)}`}>
            {/* R20: etiquetas cortas para caber en una línea a 390 px; el mes ya está arriba. */}
            <Figure label="Gastos con IVA" value={formatMxn(totals.gastos_total_cents)} hint="Lo que salió de caja por gastos." />
            <Figure label="Gastos sin IVA" value={formatMxn(totals.gastos_subtotal_cents)} hint="Es lo que resta al resultado operativo." />
            <Figure label="Retiros" value={formatMxn(totals.retiros_cents)} hint="Restan del disponible, no del resultado." />
          </FigureRow>
        </FigureStrip>
      </div>

      <FilterBar
        resetHref={`/gastos?mes=${month}`}
        active={Boolean(category)}
        activeCount={category ? 1 : 0}
        count={`${formatInt(rows.length)} ${rows.length === 1 ? "gasto" : "gastos"}`}
      >
        <Select name="categoria" aria-label="Categoría" defaultValue={category ?? ""} size="sm" className="max-md:w-full md:w-56">
          <option value="">Todas las categorías</option>
          {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <input type="hidden" name="mes" value={month} />
      </FilterBar>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-ink-150 bg-surface px-4 py-10 text-center">
          {category ? (
            <>
              <p className="text-sm font-medium text-ink-950">Ningún gasto de esta categoría en {monthLabel(month).toLowerCase()}.</p>
              <Link href={`/gastos?mes=${month}`} className={cn(ui.buttonSecondary, "mt-4")}>
                Limpiar filtro
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink-950">Sin gastos registrados en {monthLabel(month).toLowerCase()}.</p>
              <p className="mt-1 text-[13px] text-ink-600">Las suscripciones activas se registran solas en su fecha de cobro.</p>
              <Link href="/gastos/nuevo" className={cn(ui.buttonPrimary, "mt-4 max-md:hidden")}>
                <Plus size={16} aria-hidden="true" /> Registrar gasto
              </Link>
            </>
          )}
        </div>
      ) : (
        <Table
          head={[
            "Fecha",
            "Concepto",
            "Categoría",
            "Proveedor",
            right("Subtotal"),
            right("IVA"),
            right("Total (con IVA)"),
            "Tipo",
          ]}
          mobileHide={[0, 2, 3, 4, 5, 7]}
          mobileCards
          caption={`Gastos de ${monthLabel(month)}`}
        >
          {rows.map((expense) => (
            <tr key={expense.id} className="relative align-top">
              <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDay(expense.expense_date)}</td>
              <td className="px-3 py-2.5">
                <Link href={`/gastos/${expense.id}`} className="font-medium text-ink-950 hover:underline max-sm:after:absolute max-sm:after:inset-0">
                  {expense.concept}
                </Link>
                <p className="text-xs whitespace-nowrap text-ink-600 sm:hidden">{formatDay(expense.expense_date)}</p>
                {expense.payment_method && <p className="text-xs text-ink-600">{expense.payment_method}</p>}
                {expense.recurring_expense_id && (
                  <Link href="/gastos/suscripciones" className="relative z-10 mt-1 inline-block">
                    <Badge>
                      <Repeat size={12} aria-hidden="true" />
                      Recurrente
                    </Badge>
                  </Link>
                )}
              </td>
              <td className="px-3 py-2.5 text-ink-800">
                {expense.category === "retiro" ? <Badge>Retiro</Badge> : EXPENSE_CATEGORIES[expense.category]?.split(" (")[0]}
              </td>
              <td className="px-3 py-2.5 text-ink-800">{expense.vendor ?? <Nil label="Sin proveedor" />}</td>
              <td className={cn("px-3 py-2.5 text-right whitespace-nowrap tabular-nums", zeroClass(expense.subtotal_cents, "text-ink-800"))}>{formatMxn(expense.subtotal_cents)}</td>
              <td className={cn("px-3 py-2.5 text-right whitespace-nowrap tabular-nums", zeroClass(expense.tax_cents, "text-ink-800"))}>{formatMxn(expense.tax_cents)}</td>
              <td className={cn("px-3 py-2.5 text-right font-medium whitespace-nowrap tabular-nums", zeroClass(expense.total_cents, "text-ink-950"))}>{formatMxn(expense.total_cents)}</td>
              <td className="px-3 py-2.5 text-xs whitespace-nowrap text-ink-800">
                {expense.expense_type === "fijo" ? "Fijo" : "Variable"} ·{" "}
                {{ unico: "Único", mensual: "Mensual", anual: "Anual" }[expense.periodicity as string]}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <HowCalculated>
        <p>Los que se repiten se registran solos desde Suscripciones y servicios.</p>
      </HowCalculated>
    </>
  );
}
