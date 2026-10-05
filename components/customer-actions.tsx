"use client";

import { useState } from "react";
import { Eye, Gift, MailCheck, UserX } from "lucide-react";
import { assignToEvent, resendConfirmation, setAccountSuspended, startViewAs, type AssignKind } from "@/app/(admin)/clientes/actions";
import { ConfirmAction } from "@/components/confirm-action";

type Option = { key: string; name: string };

const selectClass =
  "h-9 w-full rounded-md border border-ink-250 bg-surface px-2.5 outline-none focus:border-gold-600 focus:ring-2 focus:ring-gold-600/30";
const cardClass = "flex flex-col gap-2 rounded-xl border border-ink-150 bg-surface p-4 shadow-sm";

function Section({ icon: Icon, title, children }: { icon: typeof Gift; title: string; children: React.ReactNode }) {
  return (
    <section className={cardClass}>
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
        <Icon size={14} aria-hidden="true" /> {title}
      </h3>
      {children}
    </section>
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

  if (events.length === 0) return <p className="text-xs text-ink-600">El cliente aún no tiene eventos: no hay a qué asignarle un plan.</p>;

  const itemKey = kind === "plan" ? planKey : kind === "complemento" ? addonKey : null;
  const itemName =
    kind === "plan" ? plans.find((plan) => plan.key === planKey)?.name : kind === "complemento" ? addons.find((addon) => addon.key === addonKey)?.name : "Acceso total";
  const eventName = events.find((event) => event.key === eventId)?.name;

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-800">
        Evento
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} className={selectClass}>
          {events.map((event) => (
            <option key={event.key} value={event.key}>
              {event.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-800">
        Qué asignar
        <select value={kind} onChange={(event) => setKind(event.target.value as AssignKind)} className={selectClass}>
          <option value="plan">Plan</option>
          <option value="complemento">Complemento</option>
          <option value="acceso_total">Acceso total (Atelier + todos los complementos)</option>
        </select>
      </label>
      {kind === "plan" && (
        <select aria-label="Plan" value={planKey} onChange={(event) => setPlanKey(event.target.value)} className={selectClass}>
          {plans.map((plan) => (
            <option key={plan.key} value={plan.key}>
              {plan.name}
            </option>
          ))}
        </select>
      )}
      {kind === "complemento" && (
        <select aria-label="Complemento" value={addonKey} onChange={(event) => setAddonKey(event.target.value)} className={selectClass}>
          {addons.map((addon) => (
            <option key={addon.key} value={addon.key}>
              {addon.name}
            </option>
          ))}
        </select>
      )}
      {kind === "plan" && (
        <label className="flex items-center gap-2 text-xs text-ink-800">
          <input type="checkbox" checked={removeOthers} onChange={(event) => setRemoveOthers(event.target.checked)} />
          Quitar lo que el plan no incluye
        </label>
      )}
      {canCourtesy && canAssign && (
        <label className="flex items-center gap-2 text-xs text-ink-800">
          <input type="checkbox" checked={courtesy} onChange={(event) => setCourtesy(event.target.checked)} />
          Es cortesía
        </label>
      )}
      <ConfirmAction
        tone="primary"
        label={courtesy ? "Dar cortesía" : "Asignar"}
        confirmLabel={courtesy ? "Dar cortesía" : "Asignar"}
        description={
          <>
            {courtesy ? "Cortesía" : "Asignación"}: <strong>{itemName ?? "—"}</strong> en <strong>{eventName ?? "—"}</strong>. Se
            guarda como override de admin. No es una venta ni cuenta como ingreso.
          </>
        }
        onConfirm={(reason) => assignToEvent({ eventId, kind, itemKey, courtesy, reason, removeOthers: kind === "plan" && removeOthers })}
      />
    </div>
  );
}

export function CustomerActions({
  customer,
  events,
  plans,
  addons,
  can,
}: {
  customer: { id: string; email: string; emailConfirmed: boolean; disabled: boolean; isStaff: boolean; isSelf: boolean };
  events: Option[];
  plans: Option[];
  addons: Option[];
  can: { resend: boolean; assign: boolean; courtesy: boolean; suspend: boolean; viewAs: boolean };
}) {
  const sections = [can.resend, can.assign || can.courtesy, can.suspend, can.viewAs].filter(Boolean).length;
  if (sections === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {(can.assign || can.courtesy) && (
        <Section icon={Gift} title={can.assign ? "Plan, complemento o cortesía" : "Cortesía"}>
          <AssignForm events={events} plans={plans} addons={addons} canAssign={can.assign} canCourtesy={can.courtesy} />
        </Section>
      )}

      {can.resend && (
        <Section icon={MailCheck} title="Confirmación de correo">
          <p className="text-xs text-ink-600">
            {customer.emailConfirmed ? "Ya confirmó su correo." : "Todavía no confirma su correo. Se le enviará de nuevo el enlace."}
          </p>
          <ConfirmAction
            label="Reenviar confirmación"
            confirmLabel="Reenviar"
            tone="primary"
            disabledReason={customer.emailConfirmed ? "No hace falta: ya está confirmado." : null}
            description={<>Se enviará a {customer.email}.</>}
            onConfirm={(reason) => resendConfirmation(customer.id, reason)}
          />
        </Section>
      )}

      {can.suspend && (
        <Section icon={UserX} title={customer.disabled ? "Cuenta suspendida" : "Suspender cuenta"}>
          <p className="text-xs text-ink-600">
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
        </Section>
      )}

      {can.viewAs && (
        <Section icon={Eye} title="Ver como usuario">
          <p className="text-xs text-ink-600">
            Vista de solo lectura de lo que el cliente ve en su cuenta. Dura 15 minutos y queda en Actividad.
          </p>
          <ConfirmAction
            label="Ver como usuario"
            confirmLabel="Abrir vista"
            tone="primary"
            disabledReason={customer.isStaff ? "No disponible para cuentas de staff." : null}
            onConfirm={(reason) => startViewAs(customer.id, reason)}
          />
        </Section>
      )}
    </div>
  );
}
