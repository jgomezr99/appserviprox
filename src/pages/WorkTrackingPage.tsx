import React, { useCallback, useEffect, useRef, useState } from "react";
import { IonAlert, IonButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonSpinner, IonTitle, IonToast, IonToolbar } from "@ionic/react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { orderService, serviceRequestService } from "../services/serviprox";
import type { Order, ServiceRequest } from "../types/serviprox";
import { apiMessage, completedAt, coordinates, isTerminal, workLabels } from "../utils/workflow";
import { useLivePage } from "../hooks/useLivePage";
import AuthenticatedImage from "../components/serviprox/AuthenticatedImage";
import TravelMap from "../components/serviprox/TravelMap";
import ServiceProgress from "../components/serviprox/ServiceProgress";
import ClientTrackingControls from "../components/serviprox/tracking/ClientTrackingControls";
import ProfessionalTrackingControls, { type TransitionDetails } from "../components/serviprox/tracking/ProfessionalTrackingControls";
import { priceBounds } from "../components/serviprox/tracking/priceBounds";
import "./WorkTrackingPage.css";

const money = (value: string | null | undefined) => value
  ? Number(value).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 })
  : "Por acordar";
const date = (value: string | null | undefined) => value
  ? new Date(value).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha registrada";

const WorkTrackingPage: React.FC = () => {
  // Un ID de solicitud nunca se interpreta como ID de orden.
  const { id, requestId } = useParams<{ id?: string; requestId?: string }>();
  const { user } = useAuth();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [acting, setActing] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [gpsMessage, setGpsMessage] = useState("");
  const [gpsAttempt, setGpsAttempt] = useState(0);
  const version = useRef(0);
  const busy = useRef(false);
  const accountId = user?.id;
  const activeRole = user?.role;
  const isProfessional = activeRole === "professional" && !!request?.client && request.client.id !== user?.id
    && (order?.professional || request.professional)?.is_own_profile !== false
    && (!order?.viewer_role || order.viewer_role === "professional");
  const isClient = activeRole === "client" && !!request && request.client?.id === user?.id
    && !request.professional?.is_own_profile && (!order?.viewer_role || order.viewer_role === "client");
  const backPath = activeRole === "professional" ? "/profesional/trabajos" : "/cliente/solicitudes";

  const load = useCallback(async () => {
    if (busy.current) return;
    const current = ++version.current;
    try {
      let nextOrder: Order | null = null;
      let nextRequest: ServiceRequest;
      if (requestId) {
        nextRequest = await serviceRequestService.get(requestId);
        if (nextRequest.order) nextOrder = await orderService.get(nextRequest.order.id);
      } else if (id) {
        nextOrder = await orderService.get(id);
        nextRequest = await serviceRequestService.get(nextOrder.service_request);
      } else {
        throw new Error("El enlace de seguimiento no es válido.");
      }
      if (nextOrder && nextOrder.service_request !== nextRequest.id) throw new Error("La orden no corresponde a esta solicitud.");
      if (current !== version.current) return;
      setRequest(nextRequest); setOrder(nextOrder); setError("");
    } catch (failure) {
      if (current === version.current) setError(apiMessage(failure, "No pudimos cargar este servicio. Vuelve a intentarlo."));
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [id, requestId, accountId, activeRole]);
  const active = useLivePage(load);
  useEffect(() => {
    setLoading(true); setOrder(null); setRequest(null); setError(""); setConfirmation(null); setToast(""); setGpsMessage("");
    return () => { version.current += 1; };
  }, [id, requestId, accountId, activeRole]);

  const traveling = order?.status === "traveling";
  useEffect(() => {
    if (!active || !isProfessional || !traveling || !order) return;
    if (!navigator.geolocation) { setGpsMessage("Este dispositivo no permite compartir ubicación."); return; }
    let live = true;
    let sending = false;
    let lastSent = 0;
    const orderId = order.id;
    setGpsMessage("Autoriza la ubicación para compartir tu desplazamiento.");
    const watch = navigator.geolocation.watchPosition(async ({ coords }) => {
      if (!live || sending || busy.current || Date.now() - lastSent < 15000) return;
      sending = true;
      try {
        await orderService.updateLocation(orderId, coords.latitude, coords.longitude);
        if (live) {
          lastSent = Date.now(); setGpsMessage("Ubicación compartida.");
          setOrder((previous) => previous?.id === orderId && previous.status === "traveling"
            ? { ...previous, professional_latitude: coords.latitude, professional_longitude: coords.longitude } : previous);
        }
      } catch (failure) {
        if (live) setGpsMessage(apiMessage(failure, "No se pudo compartir la ubicación."));
      } finally { sending = false; }
    }, () => { if (live) setGpsMessage("No se pudo obtener tu ubicación. Revisa los permisos y vuelve a intentar."); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
    return () => { live = false; navigator.geolocation.clearWatch(watch); };
  }, [active, isProfessional, traveling, order?.id, gpsAttempt]);

  const perform = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setActing(true); version.current += 1;
    try { await action(); } catch (failure) { setToast(apiMessage(failure, "No se pudo guardar el cambio.")); }
    finally { busy.current = false; setActing(false); }
  };
  const changeStatus = (status: string, details: TransitionDetails = {}) => perform(async () => {
    if (!order || !(isProfessional || (isClient && status === "cancelled"))) return;
    const next = await orderService.transition(order.id, status, "", details);
    setOrder(next); setConfirmation(null);
    setToast(`Estado actualizado: ${workLabels[next.status] || next.status_label}`);
  });
  const requestTransition = (status: string, details?: TransitionDetails) => {
    if (["completed", "cancelled"].includes(status)) setConfirmation(status);
    else void changeStatus(status, details);
  };
  const uploadEvidence = (image: File) => {
    if (isProfessional && order) void perform(async () => { setOrder(await orderService.addEvidence(order.id, image, "Evidencia del servicio")); setToast("Evidencia guardada."); });
  };

  const status = order?.status;
  const terminal = status ? isTerminal(status) : request ? isTerminal(request.status) : false;
  const bounds = order ? priceBounds(order) : null;
  const start = coordinates(order?.professional_latitude, order?.professional_longitude);
  const destination = coordinates(order?.workplace_latitude, order?.workplace_longitude);
  const professional = order?.professional || request?.professional;
  const requestTitle = request?.selected_service?.name || request?.selected_category.name || "Servicio";
  const pendingTitle = request?.status === "rejected" ? "Solicitud rechazada" : request?.status === "cancelled" ? "Solicitud cancelada"
    : request?.status === "closed" ? "Solicitud cerrada" : professional ? "Pendiente de aceptación" : "Pendiente de asignación";
  const address = order?.workplace_address || request?.household.address_line || "Dirección pendiente";
  const description = status === "completed" ? "La ejecución del servicio terminó. El estado del pago se muestra por separado."
    : status === "cancelled" ? "Este servicio fue cancelado. Puedes consultar su resumen e historial."
    : !order && terminal ? "Esta solicitud terminó. Conservas sus datos para consulta en el historial."
    : status === "requested" || !order ? "La solicitud está registrada. El servicio empieza después de la aceptación y el inicio del desplazamiento."
    : status === "accepted" ? (isProfessional ? "Aceptaste la solicitud. Agenda la visita o inicia el desplazamiento cuando corresponda." : "El profesional aceptó la solicitud. Aún no ha iniciado el desplazamiento.")
    : status === "scheduled" ? "La visita tiene fecha acordada. El desplazamiento aún no ha empezado."
    : status === "traveling" ? "El profesional inició el desplazamiento al lugar del servicio."
    : status === "arrived" ? "El profesional confirmó su llegada con el código del cliente."
    : status === "in_progress" ? (isProfessional ? "Registra el avance, las evidencias y el valor del trabajo antes de cerrar." : "El profesional está realizando el trabajo.") : "El trabajo está en pausa.";

  return <IonPage className="sp-service-flow" data-tracking-role={isProfessional ? "professional" : "client"}>
    <IonHeader><IonToolbar><IonButtons slot="start"><IonMenuButton autoHide={false} menu="main-menu" /></IonButtons><IonTitle>{activeRole === "professional" ? "Gestión del trabajo" : "Seguimiento de mi servicio"}</IonTitle></IonToolbar></IonHeader>
    <IonContent className="tracking-content">
      <main className="tracking-page">
        <IonButton fill="clear" routerLink={backPath}>Volver a {activeRole === "professional" ? "mis trabajos" : "mis solicitudes"}</IonButton>
        {loading ? <div className="tracking-loading"><IonSpinner /><p>Cargando servicio…</p></div> : <>
          {error && <section className="tracking-card tracking-error" role="alert"><p>{error}</p><IonButton onClick={() => void load()}>Reintentar</IonButton></section>}
          {request && !isClient && !isProfessional && <section className="tracking-card tracking-error" role="alert"><p>Este seguimiento no corresponde a tu perfil activo o pertenece a tu propia solicitud. Cambia al perfil correcto para continuar.</p></section>}
          {request && (isClient || isProfessional) && <>
            <ServiceProgress status={status || request.status} />
            <header className={`tracking-header${terminal ? " tracking-header--terminal" : ""}`} data-status={status || request.status}>
              <span>{isProfessional ? "GESTIÓN PROFESIONAL" : "TU SERVICIO"} · Solicitud #{request.id}{order ? ` · Orden #${order.id}` : ""}</span>
              <h1>{status ? workLabels[status] || order?.status_label : pendingTitle}</h1>
              <h2>{requestTitle}</h2><p>{description}</p>
              {status === "scheduled" && <p>Visita: {date(order?.scheduled_for)}</p>}
            </header>
            <section className="tracking-card tracking-summary-grid" aria-label="Datos del servicio">
              <div><span>{isProfessional ? "Cliente" : "Profesional"}</span><strong>{isProfessional ? [request.client?.first_name, request.client?.last_name].filter(Boolean).join(" ") || "Cliente del servicio" : professional?.display_name || "Por asignar"}</strong></div>
              <div><span>Lugar del servicio</span><strong>{address}</strong><small>{request.household.city}</small></div>
              <div><span>Descripción</span><p>{request.description || "Sin descripción adicional"}</p></div>
              {!order && <div><span>Disponibilidad solicitada</span><strong>{{ flexible: "Puedo esperar", this_week: "Esta semana", urgent: "Urgente" }[request.urgency]}</strong></div>}
            </section>
            {!order && !terminal && <section className="tracking-card"><p>{professional ? "Esperando la respuesta del profesional." : "Tu solicitud está pendiente de asignación de un profesional."}</p></section>}
            {isProfessional && (!order || status === "requested") && request.status === "open" && <IonButton routerLink={`/profesional/solicitudes/${request.id}`}>Responder solicitud</IonButton>}
            {traveling && active && (start && destination
              ? <TravelMap start={start} destination={destination} professionalName={professional?.display_name || "Profesional"} address={address} />
              : <section className="tracking-card" aria-label="Ruta de llegada"><h2>Profesional en camino</h2><p>Ubicación no disponible. Se mostrará el mapa cuando tengamos la ubicación del profesional y del lugar del servicio.</p></section>)}
            {isProfessional && traveling && <section className="tracking-card"><p role="status">{gpsMessage}</p><IonButton fill="outline" onClick={() => setGpsAttempt((value) => value + 1)}>Reintentar ubicación</IonButton></section>}
            {order && <>
              <section className="tracking-card" aria-label="Resumen y pago">
                <h2>{status === "completed" ? "Resumen del trabajo terminado" : isClient ? "Tarifa de tu servicio" : "Resumen económico"}</h2>
                <div className="tracking-summary-grid">
                  <div><span>{isClient ? "Tarifa confirmada por el profesional" : "Tarifa final confirmada"}</span><strong>{money(order.final_price)}</strong></div>
                  <div><span>Rango publicado</span><strong>{money(bounds ? String(bounds.min) : order.estimate_min)} — {money(bounds ? String(bounds.max) : order.estimate_max)}</strong></div>
                  <div><span>Estado del pago</span><strong>{order.payment_status_label}</strong></div>
                  {status === "completed" && <div><span>Fecha de finalización</span><strong>{date(completedAt(order))}</strong></div>}
                  {order.payment_confirmed_at && <div><span>Pago confirmado</span><strong>{date(order.payment_confirmed_at)}</strong></div>}
                </div>
                {isClient && <p className="tracking-hint">La tarifa la confirma el profesional dentro del rango publicado y aquí se muestra para consulta.</p>}
              </section>
              {isProfessional && <ProfessionalTrackingControls key={`professional-${order.id}`} order={order} disabled={acting || !!error}
                onTransition={requestTransition} onEvidence={uploadEvidence} onPrice={(amount) => {
                  void perform(async () => { setOrder(await orderService.setFinalPrice(order.id, amount)); setToast("Valor final guardado."); });
                }} />}
              {isClient && <ClientTrackingControls key={`client-${order.id}`} order={order} disabled={acting || !!error}
                onCancel={() => setConfirmation("cancelled")} onReview={(rating, comment) => {
                  void perform(async () => { const review = await orderService.review(order.id, rating, comment); setOrder((previous) => previous ? { ...previous, review } : previous); setToast("Calificación guardada."); });
                }} />}
              <section className="tracking-card" aria-label="Evidencias del trabajo"><h2>Evidencias del trabajo</h2>
                {order.work_evidence?.length ? <div className="tracking-evidence">{order.work_evidence.map((item) => <AuthenticatedImage key={item.id} src={item.image_url} alt={item.caption || "Evidencia del trabajo"} />)}</div> : <p>Aún no hay fotografías adjuntas.</p>}
              </section>
              {isProfessional && status === "completed" && <section className="tracking-card" aria-label="Calificación del servicio"><h2>Calificación del servicio</h2><p>{order.review ? `Calificación: ${order.review.rating}/5. ${order.review.comment}` : "El cliente aún no ha calificado el servicio."}</p></section>}
              <section className="tracking-card"><h2>Historial del servicio</h2><ol className="tracking-timeline">{order.events.map((event) => <li key={event.id}><strong>{workLabels[event.status] || event.status_label}</strong><time dateTime={event.created_at}>{date(event.created_at)}</time>{event.note && <p>{event.note}</p>}</li>)}</ol></section>
            </>}
          </>}
        </>}
      </main>
      <IonAlert cssClass="sp-service-flow sf-confirmation" isOpen={!!confirmation} header={confirmation === "completed" ? "Terminar trabajo" : "Cancelar servicio"} message={confirmation === "completed" ? "Se guardará el trabajo como terminado. El estado de pago se conserva por separado." : "El servicio quedará cancelado y permanecerá en el historial."} buttons={[
        { text: "Volver", role: "cancel", handler: () => setConfirmation(null) },
        { text: "Confirmar", handler: () => { const next = confirmation; setConfirmation(null); if (next) void changeStatus(next); } },
      ]} onDidDismiss={() => setConfirmation(null)} />
      <IonToast isOpen={!!toast} message={toast} duration={4500} onDidDismiss={() => setToast("")} />
    </IonContent>
  </IonPage>;
};

export default WorkTrackingPage;
