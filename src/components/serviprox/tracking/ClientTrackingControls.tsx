import React, { useId, useState } from "react";
import { IonButton } from "@ionic/react";
import type { Order } from "../../../types/serviprox";

type Props = { order: Order; disabled: boolean; onCancel: () => void; onReview: (rating: number, comment: string) => void };

const ClientTrackingControls: React.FC<Props> = ({ order, disabled, onCancel, onReview }) => {
  const id = useId();
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  return <div className="tracking-role-controls" role="region" aria-label="Opciones del cliente">
    {["accepted", "scheduled", "traveling"].includes(order.status) && order.arrival_code && <section className="tracking-card tracking-code-box">
      <h2>Código de llegada</h2><strong className="tracking-code">{order.arrival_code}</strong>
      <p>Entrégalo al profesional cuando llegue al lugar del servicio.</p>
    </section>}
    {order.payment_status === "pending" && !["requested", "cancelled"].includes(order.status) && <section className="tracking-card">
      <h2>Pago de tu servicio</h2>
      <p>{order.final_price ? "Consulta la tarifa confirmada por el profesional y continúa al pago." : "El profesional debe confirmar la tarifa dentro del rango publicado antes de que puedas pagar."}</p>
      <IonButton disabled={disabled || !order.final_price} routerLink={`/cliente/historialpago?order=${order.id}`}>Ver pago del servicio</IonButton>
    </section>}
    {["requested", "accepted", "scheduled"].includes(order.status) && order.available_transitions?.includes("cancelled") && <section className="tracking-card">
      <h2>Opciones de tu solicitud</h2><p>Puedes cancelar antes de que el profesional inicie el desplazamiento.</p>
      <IonButton color="danger" fill="outline" disabled={disabled} onClick={onCancel}>Cancelar servicio</IonButton>
    </section>}
    {order.status === "completed" && <section className="tracking-card" aria-label="Calificación del servicio">
      <h2>Calificación del servicio</h2>
      {order.review ? <p>Calificación: {order.review.rating}/5. {order.review.comment}</p> : <form className="tracking-form" onSubmit={(event) => { event.preventDefault(); onReview(Number(rating), comment); }}>
        <label htmlFor={`${id}-rating`}>Puntuación</label><select id={`${id}-rating`} value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} de 5</option>)}</select>
        <label htmlFor={`${id}-comment`}>Comentario (opcional)</label><textarea id={`${id}-comment`} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} />
        <button disabled={disabled} type="submit">Guardar calificación</button>
      </form>}
    </section>}
  </div>;
};

export default ClientTrackingControls;
