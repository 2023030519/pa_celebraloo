import "server-only";
import Link from "next/link";
import { AlertTriangle, CalendarHeart, ChevronLeft, ChevronRight, CircleX, CreditCard, KeyRound, Shield, Undo2, UserPlus, type LucideIcon } from "lucide-react";
import { getActivity, type ActivityItem } from "@/lib/data/admin";
import { Nil, PageTitle, Select, Table, formatDate, ui } from "@/components/ui";
import { DataError } from "@/components/finance";
import { ADMIN_ACTION_LABELS } from "@/lib/format";
import { Field, FilterBar } from "@/components/filters";

const PAGE = 50;

// Color solo donde pide atención o confirma dinero; las categorías rutinarias van en tinta (R4, R13).
type Kind = { label: string; tone: "neutral" | "ok" | "danger" | "info"; icon: LucideIcon };
const KINDS: Record<string, Kind> = {
  registro: { label: "Registro", tone: "neutral", icon: UserPlus },
  evento: { label: "Evento", tone: "neutral", icon: CalendarHeart },
  pago: { label: "Pago", tone: "ok", icon: CreditCard },
  pago_fallido: { label: "Pago fallido", tone: "danger", icon: CircleX },
  pago_rechazado: { label: "Rechazado", tone: "danger", icon: CircleX },
  reembolso: { label: "Reembolso", tone: "info", icon: Undo2 },
  contracargo: { label: "Contracargo", tone: "danger", icon: CircleX },
  error: { label: "Error", tone: "danger", icon: AlertTriangle },
  permiso: { label: "Permiso", tone: "neutral", icon: KeyRound },
  admin: { label: "Admin", tone: "neutral", icon: Shield },
};

const KIND_TEXT: Record<Kind["tone"], string> = {
  neutral: "text-ink-600",
  ok: "text-ok-700",
  danger: "text-danger-700",
  info: "text-info-700",
};

/** El tipo es texto con ícono, sin píldora (R13). */
function KindLabel({ meta }: { meta: Kind }) {
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${KIND_TEXT[meta.tone]}`}>
      <Icon size={12} aria-hidden="true" /> {meta.label}
    </span>
  );
}

// El día va en la fila de encabezado; cada movimiento muestra solo la hora.
const timeFormat = new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: "America/Mexico_City" });

/**
 * shortcut: admin_activity aún no devuelve el motivo ni el antes/después que
 * admin_audit_log guarda (reason, detail jsonb); se pintan en cuanto lleguen
 * (pedido en lib/data/admin.ts). Mientras, la fila se ve como hoy.
 */
type ActivityRow = ActivityItem & {
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

const show = (value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : typeof value === "object" ? JSON.stringify(value) : String(value);

/** Solo los campos que cambiaron, como Vercel (previous / next). */
function changes(row: ActivityRow): { field: string; before: string | null; after: string | null }[] {
  const before = row.before ?? {};
  const after = row.after ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ field: key, before: show(before[key]), after: show(after[key]) }));
}

function href(item: ActivityItem): string | null {
  if (!item.target_id) return null;
  switch (item.target_type) {
    case "customer":
    case "user":
      return `/clientes/${item.target_id}`;
    case "event":
      return item.title === "event.delete" ? null : `/eventos/${item.target_id}`;
    case "purchase":
      return `/ventas/${item.target_id}`;
    case "admin_expenses":
      return item.title === "admin_expenses.delete" ? null : `/gastos/${item.target_id}`;
    case "admin_recurring_expenses":
    case "expense":
      return "/gastos/suscripciones";
    case "admin_settings":
    case "admin_set_aside_rules":
      return "/configuracion";
    case "plan":
    case "addon":
      return "/catalogo";
    case "admin_promotions":
      return item.title === "admin_promotions.delete" ? null : `/promociones/${item.target_id}`;
    default:
      return null;
  }
}

const FIELD_LABELS: Record<string, string> = {
  cancelled_at: "Cancelada",
  status: "Estado",
  next_charge_date: "Próximo cobro",
  anchor_date: "Fecha base",
  start_date: "Inicio",
  occurrences_generated: "Cobros generados",
  tax_cents: "IVA",
  total_cents: "Total",
  subtotal_cents: "Subtotal",
  amount_cents: "Monto",
  notes: "Notas",
};

/** Cambia nombres de columna y fechas ISO del detalle por texto legible. */
function readable(text: string) {
  return text
    .replace(/\b([a-z]+(?:_[a-z]+)+|status|notes):/g, (_, key: string) => `${FIELD_LABELS[key] ?? key.replace(/_cents$/, "").replaceAll("_", " ")}:`)
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+(?:[+-]\d{2}:\d{2}|Z)/g, (iso) => formatDate(iso, true));
}

function Diff({ rows }: { rows: { field: string; before: string | null; after: string | null }[] }) {
  return (
    <details className="group mt-1.5">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-gold-800 hover:underline [&::-webkit-details-marker]:hidden">
        <ChevronRight size={12} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] group-open:rotate-90" />
        Antes y después ({rows.length})
      </summary>
      {/* Lado a lado en escritorio, apilado en móvil. */}
      <dl className="mt-2 flex flex-col gap-2 rounded-md border border-ink-150 bg-surface-2/50 p-2.5 text-xs">
        <div aria-hidden="true" className="hidden gap-3 font-medium text-ink-600 sm:grid sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1fr)]">
          <span>Campo</span>
          <span>Antes</span>
          <span>Después</span>
        </div>
        {rows.map((row) => (
          <div key={row.field} className="grid gap-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
            <dt className="font-medium break-words text-ink-800">{row.field}</dt>
            <dd className="break-words text-ink-600">
              <span className="sr-only">Antes: </span>
              <span aria-hidden="true" className="text-ink-600 sm:hidden">Antes: </span>
              {row.before ?? <Nil />}
            </dd>
            <dd className="break-words text-ink-950">
              <span className="sr-only">Después: </span>
              <span aria-hidden="true" className="text-ink-600 sm:hidden">Después: </span>
              {row.after ?? <Nil />}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Actividad del Panel V1 (sección 11): une lo que ya existe, sin tabla nueva. */
export async function SuperActivity({ params }: { params: { antes?: string; id?: string; tipo?: string } }) {
  const before = params.antes && !Number.isNaN(Date.parse(params.antes)) ? params.antes : null;
  const beforeId = before && params.id && params.id.length <= 200 ? params.id : null;
  const kind = params.tipo && params.tipo in KINDS ? params.tipo : null;
  const title = (
    <PageTitle
      title="Actividad"
      subtitle="Quién hizo qué y cuándo, en la app y en el panel."
    />
  );

  let items: ActivityRow[];
  let filtered: boolean;
  try {
    ({ items, filtered } = await getActivity(PAGE, before, beforeId, kind));
  } catch (error) {
    return (
      <>
        {title}
        <DataError error={error} />
      </>
    );
  }
  // Sin la migración 20261107310000 el filtro solo cubre la página traída.
  const shown = filtered ? items : items.filter((item) => item.kind === kind);
  const oldest = items[items.length - 1];
  const empty = kind
    ? `Ningún movimiento de tipo ${KINDS[kind].label.toLowerCase()}${before ? " antes de esta página" : ""}.`
    : before
      ? "No hay movimientos anteriores."
      : "Sin movimientos todavía.";

  return (
    <>
      {title}
      <FilterBar resetHref="/actividad" active={Boolean(kind)} activeCount={kind ? 1 : 0}>
        <Field label="Tipo">
          <Select name="tipo" defaultValue={kind ?? ""} size="sm" className="w-44">
            <option value="">Todos</option>
            {Object.entries(KINDS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </Select>
        </Field>
        {before && <input type="hidden" name="antes" value={before} />}
        {beforeId && <input type="hidden" name="id" value={beforeId} />}
      </FilterBar>
      <Table
        head={["Hora", "Tipo", "Qué pasó", "Sobre qué", "Quién"]}
        caption="Actividad"
        mobileHide={[0, 1, 3, 4]}
        mobileCards
        empty={shown.length === 0 ? empty : undefined}
      >
        {shown.flatMap((item, index) => {
          const meta: Kind = KINDS[item.kind] ?? { label: item.kind, tone: "neutral", icon: Shield };
          const link = href(item);
          const label = item.kind === "admin" ? ADMIN_ACTION_LABELS[item.title] ?? item.title : item.title;
          const diff = changes(item);
          const detail = item.detail ? readable(item.detail) : null;
          const who = item.actor ?? (item.kind === "registro" ? "La propia cuenta" : null);
          const time = timeFormat.format(new Date(item.occurred_at));
          const day = formatDate(item.occurred_at);
          const rows = [];
          if (index === 0 || formatDate(shown[index - 1].occurred_at) !== day) {
            rows.push(
              <tr key={`dia-${day}`} className="bg-surface-2/50 max-sm:py-2!">
                {/* table-cell!: la columna 1 se oculta en móvil, pero el día se queda; en tarjetas ocupa todo el renglón. */}
                <th colSpan={5} scope="rowgroup" className="h-8 px-3 text-left text-xs font-semibold text-ink-800 max-sm:col-span-full! max-sm:h-auto max-sm:table-cell! max-sm:justify-self-stretch! max-sm:text-left!">
                  {day}
                </th>
              </tr>
            );
          }
          rows.push(
            <tr key={item.row_id ?? `${item.occurred_at}-${item.kind}-${item.target_id}-${index}`} className="align-top">
              <td className="px-3 py-2.5 whitespace-nowrap text-ink-600 tabular-nums">{time}</td>
              <td className="px-3 py-2.5">
                <KindLabel meta={meta} />
              </td>
              <td className="px-3 py-2.5 sm:min-w-[14rem]">
                {link ? (
                  <Link href={link} className="font-medium text-ink-950 underline-offset-[3px] hover:text-gold-800 hover:underline">
                    {label}
                  </Link>
                ) : (
                  <span className="font-medium text-ink-950">{label}</span>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-600 sm:hidden">
                  <span className="whitespace-nowrap tabular-nums">{time}</span>
                  <KindLabel meta={meta} />
                  {detail && <span className="[overflow-wrap:anywhere]">{detail}</span>}
                  {who && (
                    <span title={who} className="max-w-full truncate">
                      · {who}
                    </span>
                  )}
                </p>
                {item.reason && (
                  <p className="mt-0.5 text-xs text-ink-800">
                    <span className="text-ink-600">Motivo: </span>
                    {item.reason}
                  </p>
                )}
                {diff.length > 0 && <Diff rows={diff} />}
              </td>
              <td className="px-3 py-2.5 break-words text-ink-800">{detail ?? <Nil />}</td>
              <td className="max-w-[16rem] px-3 py-2.5 text-ink-800">
                {who ? (
                  <span title={who} className="block truncate">
                    {who}
                  </span>
                ) : (
                  <Nil />
                )}
              </td>
            </tr>
          );
          return rows;
        })}
      </Table>
      <nav className="mt-3 flex flex-wrap items-center gap-2 text-xs" aria-label="Paginación">
        {before && (
          <Link href={kind ? `/actividad?tipo=${kind}` : "/actividad"} className={ui.buttonSecondarySm}>
            <ChevronLeft size={14} aria-hidden="true" /> Más recientes
          </Link>
        )}
        {items.length === PAGE && oldest && (
          <Link
            href={`/actividad?antes=${encodeURIComponent(oldest.occurred_at)}${oldest.row_id ? `&id=${encodeURIComponent(oldest.row_id)}` : ""}${kind ? `&tipo=${kind}` : ""}`}
            className={ui.buttonSecondarySm}
          >
            Anteriores <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
      </nav>
    </>
  );
}
