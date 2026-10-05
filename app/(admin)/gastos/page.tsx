import Link from "next/link";
import { Plus } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { getFinanceSummary } from "@/lib/data/admin";
import { EXPENSE_CATEGORIES, formatDay, formatMxn, monthLabel, monthOrCurrent, monthRange, shiftMonth } from "@/lib/format";
import { Badge, PageTitle, Table } from "@/components/ui";
import { DataError, MoneyTile } from "@/components/finance";
import { Field, FilterBar, fieldClass } from "@/components/filters";
import { DeleteExpenseButton } from "@/components/delete-expense-button";

type Search = { mes?: string; categoria?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireSuperAdmin();
  const params = await searchParams;
  const month = monthOrCurrent(params.mes);
  const range = monthRange(month);
  const category = params.categoria && params.categoria in EXPENSE_CATEGORIES ? params.categoria : null;

  const supabase = await createClient();
  let query = supabase
    .from("admin_expenses")
    .select("id, expense_date, concept, category, vendor, subtotal_cents, tax_cents, total_cents, expense_type, periodicity, payment_method")
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
  const navClass = "rounded-md px-3 py-1.5 font-semibold text-ink-800 hover:bg-surface";

  return (
    <>
      <PageTitle
        title="Gastos"
        subtitle="Gastos de Celebraloo registrados a mano. Cuentan en Finanzas por su fecha."
        actions={
          <Link
            href="/gastos/nuevo"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink-950 px-4 font-semibold text-surface hover:bg-ink-800"
          >
            <Plus size={16} aria-hidden="true" /> Registrar gasto
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-1" aria-label="Mes">
          <Link href={`/gastos?mes=${shiftMonth(month, -1)}`} className={navClass}>
            ←
          </Link>
          <span className="px-2 font-semibold">{monthLabel(month)}</span>
          <Link href={`/gastos?mes=${shiftMonth(month, 1)}`} className={navClass}>
            →
          </Link>
        </nav>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MoneyTile label="Gastos del mes (con IVA)" cents={totals.gastos_total_cents} />
        <MoneyTile label="Gastos del mes (sin IVA)" cents={totals.gastos_subtotal_cents} hint="Es lo que resta al resultado operativo." />
        <MoneyTile label="Retiros del mes" cents={totals.retiros_cents} hint="Restan del disponible, no del resultado." />
      </div>

      <FilterBar resetHref={`/gastos?mes=${month}`}>
        <input type="hidden" name="mes" value={month} />
        <Field label="Categoría">
          <select name="categoria" defaultValue={category ?? ""} className={fieldClass}>
            <option value="">Todas</option>
            {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </FilterBar>

      <Table
        head={["Fecha", "Concepto", "Categoría", "Proveedor", "Subtotal", "IVA", "Total", "Tipo", ""]}
        empty={(expenses ?? []).length === 0 ? "Sin gastos en este mes." : undefined}
      >
        {(expenses ?? []).map((expense) => (
          <tr key={expense.id} className="hover:bg-paper">
            <td className="px-3 py-2.5 whitespace-nowrap text-ink-600">{formatDay(expense.expense_date)}</td>
            <td className="px-3 py-2.5">
              <Link href={`/gastos/${expense.id}`} className="font-medium hover:underline">
                {expense.concept}
              </Link>
              {expense.payment_method && <p className="text-xs text-ink-600">{expense.payment_method}</p>}
            </td>
            <td className="px-3 py-2.5">
              {expense.category === "retiro" ? <Badge tone="info">Retiro</Badge> : EXPENSE_CATEGORIES[expense.category]?.split(" (")[0]}
            </td>
            <td className="px-3 py-2.5 text-ink-800">{expense.vendor ?? "—"}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(expense.subtotal_cents)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums">{formatMxn(expense.tax_cents)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums font-medium">{formatMxn(expense.total_cents)}</td>
            <td className="px-3 py-2.5 text-xs text-ink-800">
              {expense.expense_type === "fijo" ? "Fijo" : "Variable"} ·{" "}
              {{ unico: "Único", mensual: "Mensual", anual: "Anual" }[expense.periodicity as string]}
            </td>
            <td className="px-3 py-2.5">
              <span className="flex items-center gap-3">
                <Link href={`/gastos/${expense.id}`} className="text-xs font-semibold text-gold-800 hover:underline">
                  Editar
                </Link>
                <DeleteExpenseButton id={expense.id as string} />
              </span>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
