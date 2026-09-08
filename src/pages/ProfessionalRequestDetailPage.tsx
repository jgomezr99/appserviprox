import React, { useEffect, useState } from "react";
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonLoading,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { useHistory, useParams } from "react-router-dom";
import {
  calendarClearOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  homeOutline,
  personCircleOutline,
} from "ionicons/icons";
import { serviceRequestService } from "../services/serviprox";
import type { ServiceRequest, ServiceRequestStatus } from "../types/serviprox";
import RequestImageGallery from "../components/serviprox/RequestImageGallery";
import "./RolePages.css";
import "../components/misreservas/misreserva.css";

type RouteParams = {
  id: string;
};

type PendingAction = "accept" | "reject" | null;

const statusColor: Record<ServiceRequestStatus, string> = {
  draft: "medium",
  open: "warning",
  matched: "primary",
  accepted: "success",
  rejected: "danger",
  closed: "medium",
  cancelled: "medium",
};

const urgencyLabel = {
  flexible: "Puedo esperar",
  this_week: "Esta semana",
  urgent: "Urgente",
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));

const clientName = (request: ServiceRequest) =>
  [request.client.first_name, request.client.last_name].filter(Boolean).join(" ") ||
  request.client.initials ||
  "Cliente";

const statusWithPayment = (request: ServiceRequest) => {
  if (request.status !== "accepted" || !request.order) return request.status_label;
  return `${request.status_label} · ${request.order.payment_status_label}`;
};

const ProfessionalRequestDetailPage: React.FC = () => {
  const { id } = useParams<RouteParams>();
  const history = useHistory();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const loadRequest = async () => {
    setLoading(true);
    setError("");
    try {
      setRequest(await serviceRequestService.get(id));
    } catch {
      setError("No pudimos cargar esta solicitud.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequest();
  }, [id]);

  const runAction = async () => {
    if (!pendingAction || processing) return;

    setProcessing(true);
    setError("");
    try {
      const nextRequest =
        pendingAction === "accept"
          ? await serviceRequestService.accept(id)
          : await serviceRequestService.reject(id);
      setRequest(nextRequest);
      setToast(pendingAction === "accept" ? "Solicitud aceptada" : "Solicitud rechazada");
    } catch {
      setError("No pudimos actualizar la solicitud. Vuelve a consultar el estado.");
      await loadRequest();
    } finally {
      setProcessing(false);
      setPendingAction(null);
    }
  };

  const canAnswer = request?.status === "open" && !processing;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Detalle de solicitud</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          {loading ? (
            <div className="sp-card sp-route-loading">
              <IonSpinner name="crescent" />
              <span>Cargando solicitud...</span>
            </div>
          ) : error && !request ? (
            <section className="sp-card">
              <p className="sp-error">{error}</p>
              <IonButton onClick={() => void loadRequest()}>Reintentar</IonButton>
            </section>
          ) : request ? (
            <>
              <header className="sp-role-header">
                <span className="sp-role-kicker">PROFESIONAL</span>
                <h1>{request.selected_service?.name || request.selected_category.name}</h1>
                <p>{request.description}</p>
              </header>

              <section className="sp-grid sp-grid--two">
                <article className="sp-card">
                  <div className="sp-card-header">
                    <div className="sp-card-title">
                      <h2>Solicitud</h2>
                      <p>Estado y datos del servicio solicitado.</p>
                    </div>
                    <IonBadge color={statusColor[request.status]}>
                      {statusWithPayment(request)}
                    </IonBadge>
                  </div>
                  <div className="sp-request-meta">
                    <span>
                      <IonIcon icon={calendarClearOutline} />
                      {formatDate(request.created_at)}
                    </span>
                    <span>
                      <IonIcon icon={checkmarkCircleOutline} />
                      {urgencyLabel[request.urgency]}
                    </span>
                  </div>
                </article>

                <article className="sp-card">
                  <div className="sp-card-title">
                    <h2>Cliente y vivienda</h2>
                    <p>Información permitida para atender esta solicitud.</p>
                  </div>
                  <div className="sp-request-meta">
                    <span>
                      <IonIcon icon={personCircleOutline} />
                      {clientName(request)}
                    </span>
                    <span>
                      <IonIcon icon={homeOutline} />
                      {request.household.label}
                    </span>
                    <span>
                      <IonIcon icon={homeOutline} />
                      {request.household.address_line || "Dirección pendiente"}
                    </span>
                    <span>
                      <IonIcon icon={homeOutline} />
                      {request.household.short_location || request.household.city}
                    </span>
                  </div>
                </article>
              </section>

              <section className="sp-card">
                <div className="sp-card-title">
                  <h2>Fotos del problema</h2>
                  <p>Contexto visual enviado por el cliente para decidir la respuesta.</p>
                </div>
                <RequestImageGallery images={request.images} />
              </section>

              <section className="sp-card">
                <div className="sp-card-title">
                  <h2>Respuesta</h2>
                  <p>
                    Aceptar crea la orden asociada. Rechazar deja visible el estado para el cliente.
                  </p>
                </div>
                {error ? <p className="sp-error">{error}</p> : null}
                <div className="sp-actions sp-actions--spaced">
                  <IonButton
                    className="sp-primary-button"
                    disabled={!canAnswer}
                    onClick={() => setPendingAction("accept")}
                    aria-label="Aceptar solicitud"
                  >
                    <IonIcon slot="start" icon={checkmarkCircleOutline} />
                    Aceptar
                  </IonButton>
                  <IonButton
                    color="danger"
                    fill="outline"
                    disabled={!canAnswer}
                    onClick={() => setPendingAction("reject")}
                    aria-label="Rechazar solicitud"
                  >
                    <IonIcon slot="start" icon={closeCircleOutline} />
                    Rechazar
                  </IonButton>
                  <IonButton fill="clear" onClick={() => history.push("/profesional/solicitudes")}>
                    Volver
                  </IonButton>
                </div>
              </section>
            </>
          ) : null}
        </main>

        <IonAlert
          isOpen={!!pendingAction}
          header={pendingAction === "accept" ? "Aceptar solicitud" : "Rechazar solicitud"}
          message={
            pendingAction === "accept"
              ? "Se creará una orden aceptada para esta solicitud."
              : "La solicitud quedará rechazada para el cliente."
          }
          buttons={[
            { text: "Cancelar", role: "cancel", handler: () => setPendingAction(null) },
            {
              text: pendingAction === "accept" ? "Aceptar" : "Rechazar",
              role: pendingAction === "reject" ? "destructive" : undefined,
              handler: () => {
                void runAction();
              },
            },
          ]}
          onDidDismiss={() => {
            if (!processing) setPendingAction(null);
          }}
        />
        <IonLoading isOpen={processing} message="Actualizando solicitud..." />
        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={1800}
          onDidDismiss={() => setToast("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default ProfessionalRequestDetailPage;
