"use client";

import { useState, type ReactNode } from "react";
import { Eye, Gift, MailCheck, UserX } from "lucide-react";
import { assignToEvent, resendConfirmation, setAccountSuspended, startViewAs, type AssignKind } from "@/app/(admin)/clientes/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { Field } from "@/components/filters";
import { Select, cn } from "@/components/ui";

type Option = { key: string; name: string };

// Ningún select se estira en escritorio (R7): llena la columna en móvil y se queda en max-w-sm.
const selectClass = "w-full sm:max-w-sm";
const checkClass = "flex min-h-6 max-md:min-h-11 items-center gap-2 text-[13px] text-ink-800";

/** Un bloque del panel de acciones: separado por divisor, sin tarjeta propia. */
function Item({
  icon: Icon,
  title,
  id,
  className,
  children,
}: {
  icon: typeof Gift;
  title: string;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className={cn("flex flex-col gap-2.5 px-4 py-4", className)}>
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink-950">
        <Icon size={14} aria-hidden="true" className="text-ink-600" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function AssignForm({
  events,
  plans,
  addons,
  canAssign,
  canCourtesy,
}: {
  events: Option[];
  plans: Option[];
  addons: Option[];
  canAssign: boolean;
  canCourtesy: boolean;
}) {
  const [eventId, setEventId] = useState(events[0]?.key ?? "");
  const [kind, setKind] = useState<AssignKind>("plan");
  const [planKey, setPlanKey] = useState(plans.find((plan) => plan.key !== "tour")?.key ?? plans[0]?.key ?? "");
  const [addonKey, setAddonKey] = useState(addons[0]?.key ?? "");
  // Sin permiso de asignar, todo lo que da es cortesía.
  const [courtesy, setCourtesy] = useState(!canAssign);
  const [removeOthers, setRemoveOthers] = useState(false);

  if (events.length === 0) return <p className="text-[13px] text-ink-600">El cliente aún no tiene eventos: no hay a qué asignarle un plan.</p>;

  const itemKey = kind === "plan" ? planKey : kind === "complemento" ? addonKey : null;
  const itemName =
    kind === "plan" ? plans.find((plan) => plan.key === planKey)?.name : kind === "complemento" ? addons.find((addon) => addon.key === addonKey)?.name : "Acceso total";
  const eventName = events.find((event) => event.key === eventId)?.name;

  return (
    <div className="flex flex-col gap-3">
      <Field label="Evento">
        <Select value={eventId} onChange={(event) => setEventId(event.target.value)} className={selectClass}>
          {events.map((event) => (
            <option key={event.key} value={event.key}>
              {event.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Qué asignar">
        <Select value={kind} onChange={(event) => setKind(event.target.value as AssignKind)} className={selectClass}>
          <option value="plan">Plan</option>
          <option value="complemento">Complemento</option>
          <option value="acceso_total">Acceso total (Atelier + todos los complementos)</option>
        </Select>
      </Field>
      {kind === "plan" && (
        <Field label="Plan">
          <Select value={planKey} onChange={(event) => setPlanKey(event.target.value)} className={selectClass}>
            {plans.map((plan) => (
              <option key={plan.key} value={plan.key}>
                {plan.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {kind === "complemento" && (
        <Field label="Complemento">
          <Select value={addonKey} onChange={(event) => setAddonKey(event.target.value)} className={selectClass}>
            {addons.map((addon) => (
              <option key={addon.key} value={addon.key}>
                {addon.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {(kind === "plan" || (canCourtesy && canAssign)) && (
        <div className="flex flex-col gap-1">
          {kind === "plan" && (
            <label className={checkClass}>
              <input type="checkbox" checked={removeOthers} onChange={(event) => setRemoveOthers(event.target.checked)} className="size-4 accent-gold-800" />
              Quitar lo que el plan no incluye
            </label>
          )}
          {canCourtesy && canAssign && (
            <label className={checkClass}>
              <input type="checkbox" checked={courtesy} onChange={(event) => setCourtesy(event.target.checked)} className="size-4 accent-gold-800" />
              Es cortesía
            </label>
          )}
        </div>
      )}
      <ConfirmAction
        tone="primary"
        label={courtesy ? "Dar cortesía" : "Asignar"}
        confirmLabel={courtesy ? "Dar cortesía" : "Asignar"}
        description={
          <>
            {courtesy ? "Cortesía" : "Asignación"}: <strong>{itemName ?? "Sin elegir"}</strong> en <strong>{eventName ?? "Sin elegir"}</strong>. Se
            suma igual que una compra y lo que el cliente compre después se suma encima. No es una venta ni cuenta como ingreso.
          </>
        }
        onConfirm={(reason) => assignToEvent({ eventId, kind, itemKey, courtesy, reason, removeOthers: kind === "plan" && removeOthers })}
      />
    </div>
  );
}

/**
 * Acciones de cuenta de la ficha de cliente, en un solo panel lateral. Cada una
 * pide motivo (ConfirmAction) y queda en Actividad. Sin permiso, no se muestra.
 */
export function CustomerActions({
  customer,
  events,
  plans,
  addons,
  can,
  id,
  className,
}: {
  id?: string;
  className?: string;
  customer: { id: string; email: string; emailConfirmed: boolean; disabled: boolean; isStaff: boolean; isSelf: boolean };
  events: Option[];
  plans: Option[];
  addons: Option[];
  can: { resend: boolean; assign: boolean; courtesy: boolean; suspend: boolean; viewAs: boolean };
}) {
  if (!(can.resend || can.assign || can.courtesy || can.suspend || can.viewAs)) return null;

  return (
    <section id={id} aria-labelledby="customer-actions" className={cn("min-w-0 rounded-lg border border-ink-150 bg-surface", className)}>
      <div className="border-b border-ink-150 px-4 py-3">
        <h2 id="customer-actions" className="text-base font-semibold text-ink-950">
          Acciones de cuenta
        </h2>
        <p className="mt-0.5 text-xs text-ink-600">Cada acción pide un motivo y queda en Actividad.</p>
      </div>
      <div className="divide-y divide-ink-150">
        {(can.assign || can.courtesy) && (
          <Item icon={Gift} title={can.assign ? "Plan, complemento o cortesía" : "Cortesía"}>
            <AssignForm events={events} plans={plans} addons={addons} canAssign={can.assign} canCourtesy={can.courtesy} />
          </Item>
        )}

        {can.resend && (
          <Item icon={MailCheck} title="Confirmación de correo">
            <p className="text-[13px] text-ink-600">
              {customer.emailConfirmed ? "Ya confirmó su correo." : "Todavía no confirma su correo. Se le enviará de nuevo el enlace."}
            </p>
            {/* Ya confirmado: el texto de arriba lo dice y el servidor rechazaría el reenvío, así que no hay botón. */}
            {!customer.emailConfirmed && (
              <ConfirmAction
                label="Reenviar confirmación"
                confirmLabel="Reenviar"
                description={<>Se enviará a {customer.email}. Supabase puede tardar hasta 30 segundos en responder.</>}
                pendingLabel="Enviando…"
                onConfirm={(reason) => resendConfirmation(customer.id, reason)}
              />
            )}
          </Item>
        )}

        {can.viewAs && (
          <Item icon={Eye} title="Ver como usuario" id="ver-como" className="scroll-mt-6">
            <p className="text-[13px] text-ink-600">Vista de solo lectura de lo que el cliente ve en su cuenta. Dura 15 minutos y queda en Actividad.</p>
            <ConfirmAction
              label="Ver como usuario"
              confirmLabel="Abrir vista"
              disabledReason={customer.isStaff ? "No disponible para cuentas de staff." : null}
              onConfirm={(reason) => startViewAs(customer.id, reason)}
            />
          </Item>
        )}

        {can.suspend && (
          <Item icon={UserX} title={customer.disabled ? "Cuenta suspendida" : "Suspender cuenta"}>
            <p className="text-[13px] text-ink-600">
              {customer.disabled
                ? "No puede iniciar sesión. Sus eventos e invitaciones siguen igual."
                : "Impide iniciar sesión (una sesión abierta dura hasta 1 h). No toca sus eventos ni invitaciones."}
            </p>
            {customer.disabled ? (
              <ConfirmAction label="Reactivar" confirmLabel="Reactivar cuenta" tone="ok" onConfirm={(reason) => setAccountSuspended(customer.id, false, reason)} />
            ) : (
              <ConfirmAction
                label="Suspender"
                confirmLabel="Suspender cuenta"
                tone="danger"
                disabledReason={customer.isSelf ? "Es tu cuenta." : customer.isStaff ? "Es staff: quítale el rol primero." : null}
                onConfirm={(reason) => setAccountSuspended(customer.id, true, reason)}
              />
            )}
          </Item>
        )}
      </div>
    </section>
  );
}
