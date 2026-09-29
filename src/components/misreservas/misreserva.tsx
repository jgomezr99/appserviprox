import React, { useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonLabel,
} from "@ionic/react";
import {
  calendarOutline,
  cardOutline,
  constructOutline,
  locationOutline,
  menuOutline,
  navigateOutline,
  personOutline,
  refreshOutline,
} from "ionicons/icons";
import { menuController } from "@ionic/core";
import { useAuth } from "../../context/AuthContext";
import { orderService, serviceRequestService } from "../../services/serviprox";
import type { Order, ServiceRequest } from "../../types/serviprox";
import "./misreserva.css";

const statusColor = (status?: string | null): string => {
  if (!status) return "medium";
  switch (String(status).toLowerCase()) {
    case "accepted":
    case "en camino":
    case "en_camino":
    case "traveling":
    case "in_progress":
    case "en progreso":
      return "primary";
    case "completed":
    case "finalizada":
    case "finalizado":
      return "success";
    case "cancelled":
    case "cancelada":
    case "rejected":
      return "danger";
    case "open":
    case "abierta":
    case "draft":
      return "warning";
    default:
      return "medium";
  }
};

const formatDate = (iso?: string | null): string => {
  if (!iso) return "Fecha por definir";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return String(iso);
  }
};

export const MisReserva: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"todas" | "activas" | "finalizadas">("todas");

  const loadData = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [reqList, ordList] = await Promise.all([
        serviceRequestService.list().catch((err) => {
          console.warn("Error cargando requests:", err);
          return [] as ServiceRequest[];
        }),
        orderService.list().catch((err) => {
          console.warn("Error cargando orders:", err);
          return [] as Order[];
        }),
      ]);
      setRequests(Array.isArray(reqList) ? reqList : []);
      setOrders(Array.isArray(ordList) ? ordList : []);
    } catch (err) {
      console.error("Error global en solicitudes:", err);
      setError("No se pudieron cargar tus solicitudes. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [isAuthenticated]);

  const handleRefresh = async (event: CustomEvent) => {
    await loadData();
    event.detail.complete();
  };

  const filteredItems = useMemo(() => {
    const term = (searchQuery || "").trim().toLowerCase();
    const safeRequests = Array.isArray(requests) ? requests : [];
    const safeOrders = Array.isArray(orders) ? orders : [];

    const combined = safeRequests
      .filter((req) => req && typeof req === "object")
      .map((req) => {
        const matchedOrder = safeOrders.find(
          (o) => o && (o.service_request === req.id || (req.order && o.id === req.order.id))
        );

        const title =
          req.selected_service?.name ||
          req.selected_category?.name ||
          "Servicio de hogar";

        const category = req.selected_category?.name || "General";
        const status = matchedOrder?.status_label || req.status_label || "Publicada";
        const statusCode = String(matchedOrder?.status || req.status || "open").toLowerCase();
        const date = matchedOrder?.scheduled_for || req.created_at;
        const address =
          req.household?.address_line || req.household?.label || "Dirección registrada";
        const neighborhood =
          req.household?.short_location || req.household?.city || "Bogotá";
        const professionalName =
          matchedOrder?.professional?.display_name ||
          req.professional?.display_name ||
          null;
        const orderId = matchedOrder?.id || req.order?.id || null;

        return {
          request: req,
          order: matchedOrder,
          title,
          category,
          status,
          statusCode,
          date,
          address,
          neighborhood,
          professionalName,
          orderId,
        };
      });

    return combined.filter((item) => {
      const matchesText =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term) ||
        item.status.toLowerCase().includes(term) ||
        (item.professionalName && item.professionalName.toLowerCase().includes(term));

      if (!matchesText) return false;

      if (activeTab === "activas") {
        return (
          item.statusCode !== "completed" &&
          item.statusCode !== "cancelled" &&
          item.statusCode !== "rejected" &&
          item.statusCode !== "closed"
        );
      }
      if (activeTab === "finalizadas") {
        return (
          item.statusCode === "completed" ||
          item.statusCode === "cancelled" ||
          item.statusCode === "rejected" ||
          item.statusCode === "closed"
        );
      }
      return true;
    });
  }, [requests, orders, searchQuery, activeTab]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton
              autoHide={false}
              menu="main-menu"
              onClick={() => {
                void menuController.open("main-menu");
              }}
            >
              <IonIcon icon={menuOutline} />
            </IonMenuButton>
          </IonButtons>
          <IonTitle>Mis solicitudes</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => void loadData()} disabled={loading} title="Actualizar">
              <IonIcon slot="icon-only" icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div className="sp-reservas-container">
          <div className="sp-reservas-header">
            <h1>Mis Solicitudes y Reservas</h1>
            <p>Consulta el estado de tus servicios para el hogar y haz seguimiento en vivo.</p>
          </div>

          <IonSearchbar
            value={searchQuery}
            placeholder="Buscar solicitud o contratista..."
            onIonInput={(e) => setSearchQuery(e.detail.value ?? "")}
            debounce={150}
          />

          <IonSegment
            value={activeTab}
            onIonChange={(e) => setActiveTab(e.detail.value as "todas" | "activas" | "finalizadas")}
            style={{ marginBottom: "16px" }}
          >
            <IonSegmentButton value="todas">
              <IonLabel>Todas</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="activas">
              <IonLabel>Activas</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="finalizadas">
              <IonLabel>Completadas</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {!isAuthenticated ? (
            <div className="sp-empty-reservas">
              <IonIcon icon={constructOutline} />
              <h3>Inicia sesión para ver tus solicitudes</h3>
              <p>
                Accede con tu cuenta o selecciona un usuario demo para consultar tus solicitudes de servicio del hogar,
                revisar presupuestos y hacer seguimiento en tiempo real.
              </p>
              <IonButton routerLink="/login" fill="solid" style={{ marginTop: "12px" }}>
                Iniciar sesión / Cuenta Demo
              </IonButton>
            </div>
          ) : loading ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <IonSpinner name="crescent" color="primary" />
              <p style={{ marginTop: "12px", color: "var(--sp-text-muted, #64748b)" }}>
                Cargando tus solicitudes...
              </p>
            </div>
          ) : error ? (
            <div className="sp-empty-reservas">
              <p style={{ color: "#d32f2f", fontWeight: 700 }}>{error}</p>
              <IonButton fill="outline" onClick={() => void loadData()}>
                Reintentar
              </IonButton>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="sp-empty-reservas">
              <IonIcon icon={constructOutline} />
              <h3>
                No tienes solicitudes {activeTab !== "todas" ? activeTab : ""} registradas
              </h3>
              <p>
                Explora nuestros servicios verificados o encuentra contratistas cercanos en el mapa.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                <IonButton routerLink="/cliente/servicios" fill="solid">
                  Solicitar servicio
                </IonButton>
                <IonButton routerLink="/cliente/mapa" fill="outline">
                  Ver mapa
                </IonButton>
              </div>
            </div>
          ) : (
            <div className="sp-reservas-list">
              {filteredItems.map((item) => (
                <IonCard key={item.request.id} className="sp-reserva-card">
                  <IonCardHeader>
                    <div className="sp-reserva-top">
                      <div>
                        <span className="sp-reserva-category">{item.category}</span>
                        <IonCardTitle className="sp-reserva-title">{item.title}</IonCardTitle>
                      </div>
                      <IonBadge color={statusColor(item.statusCode)}>{item.status}</IonBadge>
                    </div>
                  </IonCardHeader>

                  <IonCardContent>
                    {item.request.description && (
                      <p style={{ color: "var(--sp-text-muted, #64748b)", margin: "0 0 12px" }}>
                        {item.request.description}
                      </p>
                    )}

                    <div className="sp-reserva-meta">
                      <div className="sp-reserva-meta-item">
                        <IonIcon icon={calendarOutline} />
                        <span>{formatDate(item.date)}</span>
                      </div>

                      <div className="sp-reserva-meta-item">
                        <IonIcon icon={locationOutline} />
                        <span>
                          {item.address} ({item.neighborhood})
                        </span>
                      </div>

                      {item.professionalName && (
                        <div className="sp-reserva-meta-item">
                          <IonIcon icon={personOutline} />
                          <strong>{item.professionalName}</strong>
                        </div>
                      )}
                    </div>

                    <div className="sp-reserva-actions">
                      {item.orderId && (
                        <IonButton
                          routerLink={`/seguimiento/${item.orderId}`}
                          fill="solid"
                          size="small"
                          style={{
                            "--border-radius": "12px",
                            textTransform: "none",
                            fontWeight: 700,
                          }}
                        >
                          <IonIcon slot="start" icon={navigateOutline} />
                          Seguimiento en vivo
                        </IonButton>
                      )}

                      {item.order && item.order.payment_status === "pending" && (
                        <IonButton
                          routerLink={`/cliente/historialpago?order=${item.orderId}`}
                          fill="outline"
                          color="success"
                          size="small"
                          style={{
                            "--border-radius": "12px",
                            textTransform: "none",
                            fontWeight: 700,
                          }}
                        >
                          <IonIcon slot="start" icon={cardOutline} />
                          Pagar servicio
                        </IonButton>
                      )}

                      <IonButton
                        routerLink="/cliente/servicios"
                        fill="clear"
                        size="small"
                        style={{ textTransform: "none" }}
                      >
                        Ver más servicios
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MisReserva;
