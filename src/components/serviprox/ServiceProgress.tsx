import React from "react";

const steps = [
  { title: "Solicitud", detail: "Servicio y detalles" },
  { title: "Confirmación", detail: "Respuesta del profesional" },
  { title: "Visita", detail: "Llegada y trabajo" },
  { title: "Cierre", detail: "Resumen del servicio" },
];

/** Orientación visual basada en el estado real; no modifica las transiciones. */
const ServiceProgress: React.FC<{ status?: string }> = ({ status = "draft" }) => {
  if (status === "cancelled" || status === "rejected") {
    return <div className="sf-journey-note">Este servicio se cerró sin completar todas las etapas.</div>;
  }
  const finished = status === "completed" || status === "closed";
  const current = finished ? 3 : ["traveling", "arrived", "in_progress", "break", "lunch", "other_service"].includes(status)
    ? 2 : ["open", "requested", "matched", "accepted", "scheduled"].includes(status) ? 1 : 0;

  return <section className="sf-journey" aria-label="Etapas del servicio">
    <ol>{steps.map((step, index) => {
      const done = finished || index < current;
      return <li key={step.title} data-state={done ? "done" : index === current ? "current" : "upcoming"} aria-current={index === current ? "step" : undefined}>
        <span className="sf-step-number" aria-hidden="true">{done ? "✓" : index + 1}</span>
        <span className="sf-step-text"><strong>{step.title}</strong><small>{step.detail}</small></span>
      </li>;
    })}</ol>
  </section>;
};

export default ServiceProgress;
