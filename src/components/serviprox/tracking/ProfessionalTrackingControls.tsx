import React, { useEffect, useId, useRef, useState } from "react";
import { IonButton } from "@ionic/react";
import type { Order } from "../../../types/serviprox";
import { actionLabels, isTerminal, workLabels } from "../../../utils/workflow";
import { priceBounds } from "./priceBounds";

export type TransitionDetails = { arrival_code?: string; scheduled_for?: string };
type Props = {
  order: Order; disabled: boolean;
  onTransition: (status: string, details?: TransitionDetails) => void;
  onPrice: (amount: string) => void;
  onEvidence: (file: File) => void;
};

const ProfessionalTrackingControls: React.FC<Props> = ({ order, disabled, onTransition, onPrice, onEvidence }) => {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [price, setPrice] = useState(order.final_price || "");
  const [code, setCode] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setPrice(order.final_price || ""); setError(""); }, [order.id, order.final_price]);
  useEffect(() => { setCode(""); }, [order.status]);
  const terminal = isTerminal(order.status);
  const bounds = priceBounds(order);
  const canPrice = order.can_set_final_price !== false && order.payment_status === "pending"
    && !["requested", "cancelled"].includes(order.status) && !!bounds;
  const allowed = ["traveling", "arrived", "in_progress", "break", "lunch", "other_service", "completed", "scheduled", "cancelled"]
    .filter((next) => order.available_transitions?.includes(next));
  return <div className="tracking-role-controls" role="region" aria-label="Herramientas del profesional">
    <section className="tracking-card">
      <h2>Confirmar tarifa del trabajo</h2>
      {canPrice ? <form className="tracking-form" onSubmit={(event) => {
        event.preventDefault(); if (disabled) return;
        const amount = Number(price);
        if (!bounds || !Number.isFinite(amount) || !price.trim() || amount < bounds.min || amount > bounds.max) {
          setError("El valor final debe estar dentro del rango publicado."); return;
        }
        setError(""); onPrice(price);
      }}>
        <p>Confirma el valor dentro del rango publicado. El cliente podrá consultarlo y pagarlo.</p>
        <label htmlFor={`${id}-final-price`}>Valor final acordado con el cliente (COP)</label>
        <input id={`${id}-final-price`} name="final-price" type="number" min={bounds!.min} max={bounds!.max} step="0.01" inputMode="decimal" disabled={disabled} required value={price} onChange={(event) => setPrice(event.target.value)} />
        <button disabled={disabled} type="submit">Guardar valor final</button>
      </form> : <p>{!bounds ? "Falta un rango mínimo y máximo publicado válido para confirmar la tarifa." : "La tarifa no admite cambios en el estado actual o mientras exista un pago en proceso."}</p>}
    </section>
    {!terminal && allowed.length > 0 && <section className="tracking-card" aria-label="Acciones del servicio">
      <h2>Gestionar el trabajo</h2>
      {allowed.includes("scheduled") && <form className="tracking-form" onSubmit={(event) => {
        event.preventDefault(); if (disabled) return;
        const visit = new Date(scheduledFor);
        if (!scheduledFor || Number.isNaN(visit.getTime()) || visit <= new Date()) { setError("Selecciona una fecha futura para la visita."); return; }
        setError(""); onTransition("scheduled", { scheduled_for: visit.toISOString() });
      }}>
        <label htmlFor={`${id}-visit-date`}>Fecha y hora acordadas de la visita</label>
        <input id={`${id}-visit-date`} name="visit-date" type="datetime-local" disabled={disabled} required value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
        <button disabled={disabled} type="submit">Agendar visita</button>
      </form>}
      {allowed.includes("arrived") && <div className="tracking-form">
        <label htmlFor={`${id}-arrival-code`}>Código de llegada del cliente</label>
        <input id={`${id}-arrival-code`} name="arrival-code" inputMode="numeric" autoComplete="off" disabled={disabled} maxLength={8} value={code} onChange={(event) => setCode(event.target.value)} />
      </div>}
      <div className="tracking-status-grid">{allowed.filter((next) => next !== "scheduled").map((next) => <button key={next} type="button"
        className={next === "cancelled" ? "tracking-action--cancel" : ["traveling", "arrived", "in_progress", "completed"].includes(next) ? "tracking-action--primary" : undefined}
        disabled={disabled || (next === "arrived" && !code.trim())} onClick={() => onTransition(next, next === "arrived" ? { arrival_code: code.trim() } : undefined)}>
        {actionLabels[next] || workLabels[next] || next}
      </button>)}</div>
      <p className="tracking-hint">Terminar el trabajo conserva por separado cualquier pago pendiente.</p>
    </section>}
    {!terminal && order.status !== "requested" && <section className="tracking-card">
      <h2>Documentar el trabajo</h2>
      <input ref={fileInput} hidden type="file" accept="image/*" capture="environment" onChange={(event) => {
        const file = event.target.files?.[0]; event.target.value = ""; if (file) onEvidence(file);
      }} />
      <IonButton fill="outline" disabled={disabled} onClick={() => fileInput.current?.click()}>Adjuntar evidencia</IonButton>
    </section>}
    {error && <p className="tracking-card tracking-error" role="alert">{error}</p>}
  </div>;
};

export default ProfessionalTrackingControls;
