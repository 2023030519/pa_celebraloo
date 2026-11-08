import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight, CircleCheck, CircleX, Info } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Clases de los controles compartidos, para que todas las secciones se vean igual. */
export const ui = {
  field:
    "h-9 rounded-md border border-ink-250 bg-surface px-3 text-base sm:text-sm text-ink-950 placeholder:text-ink-400 transition-[border-color,box-shadow] duration-[var(--dur-fast)] hover:border-ink-400 focus:border-gold-600 focus:ring-2 focus:ring-gold-600/25 focus:outline-none disabled:bg-surface-2 disabled:text-ink-400",
  buttonPrimary:
    "inline-flex h-9 max-md:h-11 items-center justify-center gap-2 rounded-md bg-gold-800 px-4 text-sm font-medium text-surface transition-colors duration-[var(--dur-fast)] hover:bg-gold-900 disabled:border disabled:border-ink-250 disabled:bg-surface-2 disabled:text-ink-400 disabled:cursor-not-allowed",
  buttonSecondary:
    "inline-flex h-9 max-md:h-11 items-center justify-center gap-2 rounded-md border border-ink-250 bg-surface px-4 text-sm font-medium text-ink-950 transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 disabled:border disabled:border-ink-250 disabled:bg-surface-2 disabled:text-ink-400 disabled:cursor-not-allowed",
  buttonDanger:
    "inline-flex h-9 max-md:h-11 items-center justify-center gap-2 rounded-md bg-danger-700 px-4 text-sm font-medium text-surface transition-colors duration-[var(--dur-fast)] hover:bg-danger-800 disabled:border disabled:border-ink-250 disabled:bg-surface-2 disabled:text-ink-400 disabled:cursor-not-allowed",
  link: "font-medium text-gold-800 underline-offset-[3px] hover:underline",
  // M6: todo botón mide 44 px debajo de md. Variantes chicas (h-8 en escritorio): cn solo concatena, así que el tamaño va en su propia cadena.
  buttonPrimarySm:
    "inline-flex h-8 max-md:h-11 items-center justify-center gap-1.5 rounded-md bg-gold-800 px-3 text-xs font-medium text-surface transition-colors duration-[var(--dur-fast)] hover:bg-gold-900 disabled:border disabled:border-ink-250 disabled:bg-surface-2 disabled:text-ink-400 disabled:cursor-not-allowed",
  buttonSecondarySm:
    "inline-flex h-8 max-md:h-11 items-center justify-center gap-1.5 rounded-md border border-ink-250 bg-surface px-3 text-xs font-medium text-ink-950 transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 disabled:border disabled:border-ink-250 disabled:bg-surface-2 disabled:text-ink-400 disabled:cursor-not-allowed",
  buttonDangerSm:
    "inline-flex h-8 max-md:h-11 items-center justify-center gap-1.5 rounded-md bg-danger-700 px-3 text-xs font-medium text-surface transition-colors duration-[var(--dur-fast)] hover:bg-danger-800 disabled:border disabled:border-ink-250 disabled:bg-surface-2 disabled:text-ink-400 disabled:cursor-not-allowed",
  fieldSm:
    "h-8 max-md:h-11 rounded-md border border-ink-250 bg-surface px-2.5 text-base sm:text-xs text-ink-950 placeholder:text-ink-400 transition-[border-color,box-shadow] duration-[var(--dur-fast)] hover:border-ink-400 focus:border-gold-600 focus:ring-2 focus:ring-gold-600/25 focus:outline-none disabled:bg-surface-2 disabled:text-ink-400",
} as const;

/** La "C" dorada de app/icon.svg (sin el fondo), decorativa: el nombre va en texto junto a ella. */
export function BrandMark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="-2 19 68 68" width={size} height={size} aria-hidden="true" focusable="false" className={cn("shrink-0", className)}>
      <path
        fill="#c8a96a"
        d="M22.17,74.49c5.59,6.27,14.02,8.66,21.93,6.3,6.2-1.85,9.75-6.45,11.82-12.5.51-.11.93-.09,1.51,0l-1.47,10.81c-16.81,8.63-39.48,5.53-46.69-13.34-3.36-8.81-3.14-18.87.65-27.49,4.86-11.08,15.4-17.72,27.45-17.65,6.29.04,12.16,1.52,17.91,4.12l.88,11.02-1.17.17c-2.49-7.93-9.65-13.01-17.96-13.34-13.2-.53-21.26,9.57-22.86,22.12-1.31,10.23.9,21.84,7.99,29.78Z"
      />
    </svg>
  );
}

/**
 * Correo en un solo renglón: se achica hasta 3/4 de su tamaño para caber en el ancho
 * disponible (unidades de contenedor); solo si aun así no cabe, se parte.
 * className va al contenedor (bloque): ahí van el tamaño de letra y el color.
 */
export function Email({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("block min-w-0 [container-type:inline-size]", className)}>
      {/* 0.62: ancho medio de un carácter de Inter en em, con holgura. */}
      <span style={{ fontSize: `max(0.75em, min(1em, calc(100cqi / ${(value.length * 0.62).toFixed(2)})))` }} className="[overflow-wrap:anywhere]">
        {value}
      </span>
    </span>
  );
}

/** Ruta de regreso arriba del título de una ficha ("Eventos › Boda Ana y Luis"). */
export function Breadcrumb({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav aria-label="Ruta" className="mb-1 flex flex-wrap items-center gap-1 text-[13px] text-ink-600">
      {items.map((item, index) => (
        <span key={item.href} className="flex items-center gap-1">
          {index > 0 && <ChevronRight size={14} aria-hidden="true" className="text-ink-400" />}
          <Link href={item.href} className="-my-3 inline-flex min-h-11 items-center font-medium hover:text-ink-950 hover:underline sm:my-0 sm:min-h-0">
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

/**
 * Select con estilo del panel: sin flecha nativa, chevron propio a la derecha.
 * Mismas props que un <select>; size cambia la altura (sm = 32 px, md = 36 px).
 * className va al envoltorio (ancho, márgenes): el <select> lo llena.
 */
export function Select({
  size = "md",
  className,
  ...props
}: Omit<ComponentProps<"select">, "size"> & { size?: "sm" | "md" }) {
  return (
    <div className={cn("relative inline-flex max-w-full", className)}>
      <select {...props} className={cn(size === "sm" ? ui.fieldSm : ui.field, "w-full min-w-0 cursor-pointer appearance-none pr-8 disabled:cursor-not-allowed max-md:h-11")} />
      <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

/**
 * Control segmentado por enlaces (rango, métrica, periodo). La URL guarda la elección.
 * Sin wrap: un solo renglón que se desplaza en su lugar si no cabe. Con wrap: las opciones bajan de renglón.
 */
export function Segmented<K extends string>({
  label,
  options,
  current,
  href,
  wrap = false,
}: {
  label: string;
  options: [K, string][];
  current: K;
  href: (key: K) => string;
  wrap?: boolean;
}) {
  const group = (
    <div
      role="group"
      aria-label={label}
      className={cn(wrap ? "flex w-fit max-w-full flex-wrap" : "inline-flex", "rounded-md bg-surface-2 p-0.5 ring-1 ring-ink-150 ring-inset")}
    >
      {options.map(([key, text]) => (
        <Link
          key={key}
          href={href(key)}
          scroll={false}
          aria-current={key === current ? "true" : undefined}
          className={cn(
            "rounded-[5px] px-2.5 py-1 text-xs max-md:py-3.5 font-medium whitespace-nowrap transition-colors duration-[var(--dur-fast)]",
            key === current ? "bg-surface text-ink-950 shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-ink-150" : "text-ink-600 hover:text-ink-950"
          )}
        >
          {text}
        </Link>
      ))}
    </div>
  );
  return wrap ? group : <div className="max-w-full overflow-x-auto">{group}</div>;
}

/**
 * primaryAction (M3): la acción principal de la página (un Link o botón con ui.buttonPrimary).
 * En escritorio va a la derecha del título, después de actions; en móvil, botón ancho fijo
 * arriba de la barra inferior. Se renderiza una sola vez: solo cambia de lugar con CSS.
 */
export function PageTitle({
  title,
  subtitle,
  actions,
  primaryAction,
  breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  primaryAction?: ReactNode;
  breadcrumb?: { href: string; label: string }[];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      {/* grow: un <Email> en el título o el subtítulo mide su contenedor, no su texto. */}
      <div className="min-w-0 grow basis-72">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        <h1 className="text-2xl font-semibold tracking-[-0.015em] text-balance break-words text-ink-950">{title}</h1>
        {subtitle && <div className="mt-1 max-w-[75ch] text-sm text-ink-600">{subtitle}</div>}
      </div>
      {(actions || primaryAction) && (
        <div className={cn("flex flex-wrap items-center gap-2", !actions && "max-md:contents")}>
          {actions}
          {primaryAction && (
            <div
              data-primary-action
              className="max-md:fixed max-md:inset-x-4 max-md:bottom-[calc(72px+env(safe-area-inset-bottom,0px))] max-md:z-20 max-md:[&>*]:w-full max-md:[&>*]:shadow-md"
            >
              {primaryAction}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * M4: chips de navegación interna de una ficha larga, solo en móvil, debajo del encabezado.
 * Cada id debe existir en la página (las secciones con id ya llevan scroll-margin en globals.css).
 */
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="En esta página" className="-mx-4 mb-4 overflow-x-auto px-4 md:hidden">
      <ul className="flex w-max gap-2">
        {items.map(({ id, label }) => (
          <li key={id}>
            <a href={`#${id}`} className="group flex h-11 items-center">
              <span className="rounded-full border border-ink-150 bg-surface px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-ink-800 group-active:bg-surface-2">
                {label}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Card({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-ink-150 bg-surface", className)}>
      {title && <h2 className="border-b border-ink-150 px-4 py-3 text-base font-semibold text-ink-950">{title}</h2>}
      <div className="p-4">{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "gold" | "ok" | "warn" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-800 ring-ink-150",
  gold: "bg-gold-100 text-gold-800 ring-gold-200",
  ok: "bg-ok-100 text-ok-700 ring-ok-300",
  warn: "bg-warn-100 text-warn-700 ring-warn-300",
  danger: "bg-danger-100 text-danger-700 ring-danger-300",
  info: "bg-info-100 text-info-700 ring-info-300",
};

// Estados con ícono y texto, nunca solo color. Solo para badges de texto: los que traen su propio ícono quedan igual.
const TONE_ICON: Partial<Record<Tone, typeof Info>> = { ok: CircleCheck, warn: AlertTriangle, danger: CircleX, info: Info };

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const Icon = typeof children === "string" ? TONE_ICON[tone] : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        toneClass[tone]
      )}
    >
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Valor vacío (el único del panel): una raya visible y "Sin dato" para lectores de pantalla. */
export function Nil({ label = "Sin dato" }: { label?: string }) {
  return (
    <>
      <span aria-hidden="true" className="font-sans text-ink-600">
        —
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

/**
 * R21: un cero pesa menos que una cifra real. Devuelve "text-ink-400" si el valor es cero
 * y si no, la tinta normal que pases (base). Acepta el número crudo (0) o el texto ya
 * formateado ("$0.00", "0", "0.0 %"); null, undefined y "—" no son cero.
 * Ejemplo: <td className={cn("text-right tabular-nums", zeroClass(row.net_cents, "text-ink-800"))}>
 */
export function zeroClass(value: number | string | null | undefined, base = ""): string {
  const zero = typeof value === "number" ? value === 0 : typeof value === "string" && /\d/.test(value) && !/[1-9]/.test(value);
  return zero ? "text-ink-400" : base;
}

/** Definiciones y fórmulas (decisiones del QA), plegadas debajo de la cifra o tabla que explican. */
export function HowCalculated({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <details className={cn("group mt-2 text-[13px] text-ink-600", className)}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm py-0.5 font-medium transition-colors duration-[var(--dur-fast)] hover:text-ink-950 [&::-webkit-details-marker]:hidden">
        <Info size={14} aria-hidden="true" />
        Cómo se calcula
        <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] group-open:rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="mt-1.5 flex max-w-[75ch] flex-col gap-1 pl-5">{children}</div>
    </details>
  );
}

export function Stat({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const body = (
    <>
      <p className="text-[13px] text-ink-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.015em] text-ink-950 tabular-nums">{value}</p>
    </>
  );
  const className = "rounded-lg border border-ink-150 bg-surface px-4 py-3.5";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors duration-[var(--dur-fast)] hover:border-ink-250 hover:bg-surface-2/60")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// Una cadena completa por columna para que Tailwind las detecte (no se arman con plantillas).
const HIDE = [
  "max-sm:[&_tr>*:nth-child(1)]:hidden",
  "max-sm:[&_tr>*:nth-child(2)]:hidden",
  "max-sm:[&_tr>*:nth-child(3)]:hidden",
  "max-sm:[&_tr>*:nth-child(4)]:hidden",
  "max-sm:[&_tr>*:nth-child(5)]:hidden",
  "max-sm:[&_tr>*:nth-child(6)]:hidden",
  "max-sm:[&_tr>*:nth-child(7)]:hidden",
  "max-sm:[&_tr>*:nth-child(8)]:hidden",
  "max-sm:[&_tr>*:nth-child(9)]:hidden",
  "max-sm:[&_tr>*:nth-child(10)]:hidden",
];

/**
 * Tabla dentro de una superficie con encabezado opcional (title + aside) y
 * scroll horizontal propio: en pantallas angostas no desborda la página.
 */
export function Table({
  head,
  children,
  empty,
  align,
  caption,
  title,
  aside,
  mobileHide,
  mobileCards = false,
}: {
  head: ReactNode[];
  children: ReactNode;
  /** Texto o contenido (por ejemplo, con la acción que resuelve el vacío). */
  empty?: ReactNode;
  /** Alineación de cada encabezado; los números y montos van a la derecha. */
  align?: ("left" | "right")[];
  /** Título de la tabla para lectores de pantalla; si falta, se usa title cuando es texto. */
  caption?: string;
  /** Título visible de la sección (h2), en la fila de encabezado. */
  title?: ReactNode;
  /** Contenido a la derecha del título (enlace "Ver todas", filtros, acción). */
  aside?: ReactNode;
  /** Índices (desde 0) de las columnas que se ocultan en móvil (máx. 10 columnas). */
  mobileHide?: number[];
  /**
   * M2: debajo de sm cada fila es una tarjeta: la primera celda visible a la izquierda y las
   * demás visibles apiladas a la derecha (monto, estado). Las reglas viven en globals.css (.table-cards).
   */
  mobileCards?: boolean;
}) {
  const lead = head.findIndex((_, index) => !mobileHide?.includes(index));
  const label = caption ?? (typeof title === "string" ? title : undefined);
  return (
    <section className="overflow-hidden rounded-lg border border-ink-150 bg-surface">
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-150 px-4 py-3">
          <h2 className="text-base font-semibold text-ink-950">{title}</h2>
          {aside}
        </div>
      )}
      {/* relative: el sr-only de las celdas fuera de vista se posiciona aquí y no ensancha la página. */}
      <div className="relative overflow-x-auto">
        <table
          data-lead={mobileCards ? lead + 1 : undefined}
          className={cn(
            "w-full border-collapse text-left text-sm",
            mobileCards && "table-cards",
            !empty && (mobileHide || mobileCards ? "sm:min-w-[640px]" : "min-w-[640px]"),
            ...(mobileHide ?? []).map((index) => HIDE[index])
          )}
        >
          {label && <caption className="sr-only">{label}</caption>}
          <thead className="border-b border-ink-150 bg-surface-2 text-xs text-ink-600">
            <tr>
              {head.map((cell, index) => (
                <th key={index} scope="col" className={cn("h-10 px-3 font-medium sm:whitespace-nowrap", align?.[index] === "right" && "text-right")}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-150 [&_tr]:transition-colors [&_tr]:duration-[var(--dur-fast)] [&_tr:has(a):hover]:bg-surface-2/50">
            {children}
          </tbody>
        </table>
      </div>
      {empty && <div className="px-3 py-8 text-center text-sm text-ink-600">{empty}</div>}
    </section>
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
