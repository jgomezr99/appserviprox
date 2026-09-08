import React, { useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  calendarClearOutline,
  homeOutline,
  personCircleOutline,
  refreshOutline,
} from "ionicons/icons";
import { serviceRequestService } from "../services/serviprox";
import type { ServiceRequest, ServiceRequestStatus } from "../types/serviprox";
import RequestImageGallery from "../components/serviprox/RequestImageGallery";
import "./RolePages.css";
import "../components/misreservas/misreserva.css";

const statusColor: Record<ServiceRequestStatus, string> = {
  draft: "medium",
  open: "warning",
  matched: "primary",
  accepted: "success",
  rejected: "danger",
  closed: "medium",
  cancelled: "medium",
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

const ProfessionalRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    setError("");
    try {
      setRequests(await serviceRequestService.list());
    } catch {
      setError("No pudimos cargar tus solicitudes recibidas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) =>
      [
        request.selected_service?.name,
        request.selected_category.name,
        clientName(request),
        request.household.label,
        request.household.short_location,
        request.status_label,
        request.order?.payment_status_label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [query, requests]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Solicitudes recibidas</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">PROFESIONAL</span>
            <h1>Solicitudes recibidas</h1>
            <p>Estas son las solicitudes reales dirigidas a tu perfil profesional.</p>
          </header>

          <div className="sp-actions sp-actions--spaced">
            <IonSearchbar
              className="sp-request-search"
              value={query}
              placeholder="Buscar por servicio, cliente o vivienda"
              onIonInput={(event) => setQuery(event.detail.value ?? "")}
            />
            <IonButton fill="outline" onClick={() => void loadRequests()} disabled={loading}>
              <IonIcon slot="start" icon={refreshOutline} />
              Actualizar
            </IonButton>
          </div>

          {loading ? (
            <div className="sp-card sp-route-loading">
              <IonSpinner name="crescent" />
              <span>Cargando solicitudes...</span>
            </div>
          ) : error ? (
            <section className="sp-card">
              <p className="sp-error">{error}</p>
              <IonButton onClick={() => void loadRequests()}>Reintentar</IonButton>
            </section>
          ) : filteredRequests.length ? (
            <section className="sp-request-list">
              {filteredRequests.map((request) => (
                <article className="sp-card sp-request-card" key={request.id}>
                  <div className="sp-card-header">
                    <div className="sp-card-title">
                      <h2>{request.selected_service?.name || request.selected_category.name}</h2>
                      <p>{request.description}</p>
                    </div>
                    <IonBadge color={statusColor[request.status]}>
                      {statusWithPayment(request)}
                    </IonBadge>
                  </div>

                  <div className="sp-request-meta">
                    <span>
                      <IonIcon icon={personCircleOutline} />
                      {clientName(request)}
                    </span>
                    <span>
                      <IonIcon icon={homeOutline} />
                      {request.household.address_line || request.household.label}
                    </span>
                    <span>
                      <IonIcon icon={homeOutline} />
                      {request.household.short_location || request.household.city}
                    </span>
                    <span>
                      <IonIcon icon={calendarClearOutline} />
                      {formatDate(request.created_at)}
                    </span>
                  </div>

                  {request.images.length ? (
                    <RequestImageGallery images={request.images} />
                  ) : null}

                  <div className="sp-actions">
                    <IonButton routerLink={`/profesional/solicitudes/${request.id}`}>
                      Ver solicitud
                    </IonButton>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="sp-card sp-empty">
              Aún no tienes solicitudes nuevas.
            </section>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default ProfessionalRequestsPage;
