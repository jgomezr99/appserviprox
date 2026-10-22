import React, { useEffect, useState } from "react";
import {
  IonButtons,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonModal,
  IonToast,
  IonBadge,
} from "@ionic/react";
import {
  briefcaseOutline,
  calendarClearOutline,
  checkmarkCircleOutline,
  constructOutline,
  personCircleOutline,
  giftOutline,
  cartOutline,
  chatbubblesOutline,
  sparkles,
  addCircleOutline,
  closeOutline,
  sendOutline,
} from "ionicons/icons";
import { ApiError } from "../services/api";
import { professionalProfileService } from "../services/serviprox";
import { useAuth } from "../context/AuthContext";
import { useHomeFlags } from "../services/platformSettings";
import type { ProfessionalProfile } from "../types/serviprox";
import "./RolePages.css";

interface ChatMessage {
  id: string;
  sender: "client" | "pro";
  text: string;
  time: string;
}

interface ChatConversation {
  id: string;
  clientName: string;
  service: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  messages: ChatMessage[];
}

const DEFAULT_CONVERSATIONS: ChatConversation[] = [
  {
    id: "chat-1",
    clientName: "Carolina Ramírez",
    service: "Reparación de calentador a gas",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    lastMessage: "Hola maestro, ¿tiene disponibilidad para revisar el calentador este sábado en la mañana?",
    time: "10:30 AM",
    unread: 1,
    messages: [
      { id: "m-1", sender: "client", text: "Hola maestro, buenas tardes. Vi tu perfil en Serviprox.", time: "10:28 AM" },
      { id: "m-2", sender: "client", text: "¿Tiene disponibilidad para revisar el calentador este sábado en la mañana?", time: "10:30 AM" },
    ],
  },
  {
    id: "chat-2",
    clientName: "Andrés Restrepo",
    service: "Instalación de tomacorrientes y panel eléctrico",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    lastMessage: "Listo, quedamos confirmados para el viernes a las 2:00 PM.",
    time: "Ayer",
    unread: 0,
    messages: [
      { id: "m-3", sender: "client", text: "¿Cuál es el costo aproximado del punto eléctrico adicional?", time: "Ayer 3:15 PM" },
      { id: "m-4", sender: "pro", text: "Hola Andrés, el punto eléctrico estándar está en \$45.000 con mano de obra y materiales básicos.", time: "Ayer 3:20 PM" },
      { id: "m-5", sender: "client", text: "Listo, quedamos confirmados para el viernes a las 2:00 PM.", time: "Ayer 3:22 PM" },
    ],
  },
];

const ProfessionalDashboard: React.FC = () => {
  const { user } = useAuth();
  const flags = useHomeFlags("professional");
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados de publicidad de profesionales
  const [adsModalOpen, setAdsModalOpen] = useState(false);
  const [activePlan, setActivePlan] = useState<string>(() => {
    try {
      return localStorage.getItem("serviprox_pro_advertising_plan") || "";
    } catch {
      return "";
    }
  });

  // Estados de chat con clientes
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>(DEFAULT_CONVERSATIONS);
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [chatInputText, setChatInputText] = useState("");

  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    let active = true;
    professionalProfileService
      .getMine()
      .then((payload) => {
        if (active) setProfile(payload);
      })
      .catch((error) => {
        if (active && !(error instanceof ApiError && error.status === 404)) {
          setProfile(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSelectPlan = (planName: string) => {
    setActivePlan(planName);
    try {
      localStorage.setItem("serviprox_pro_advertising_plan", planName);
    } catch {}
    setAdsModalOpen(false);
    setToastMessage(`¡Campaña publicitaria "${planName}" activada con éxito! Tu perfil ahora está destacado.`);
  };

  const handleCancelPlan = () => {
    setActivePlan("");
    try {
      localStorage.removeItem("serviprox_pro_advertising_plan");
    } catch {}
    setAdsModalOpen(false);
    setToastMessage("Campaña publicitaria pausada.");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !selectedChat) return;

    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender: "pro",
      text: chatInputText.trim(),
      time: "Ahora",
    };

    const updated = conversations.map((conv) => {
      if (conv.id === selectedChat.id) {
        return {
          ...conv,
          lastMessage: newMsg.text,
          time: "Ahora",
          messages: [...conv.messages, newMsg],
        };
      }
      return conv;
    });

    setConversations(updated);
    setSelectedChat({
      ...selectedChat,
      lastMessage: newMsg.text,
      time: "Ahora",
      messages: [...selectedChat.messages, newMsg],
    });
    setChatInputText("");
  };

  const displayName = user?.first_name || profile?.display_name || "Profesional";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Página Principal</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">PÁGINA PRINCIPAL · PROFESIONAL</span>
            <h1>Hola, {displayName}</h1>
            <p>Gestiona tu perfil, solicitudes y prepara tu operación en Serviprox.</p>
          </header>

          {loading ? (
            <div className="sp-card sp-route-loading">
              <IonSpinner name="crescent" />
              <span>Cargando tu perfil...</span>
            </div>
          ) : (
            <section className="sp-grid sp-grid--two">
              {flags.profile_status && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Estado del perfil</h2>
                    <p>{profile ? "Perfil profesional activo" : "Perfil pendiente"}</p>
                  </div>
                  <span className="sp-icon-tile">
                    <IonIcon icon={personCircleOutline} />
                  </span>
                </div>
              </article>
              )}

              {flags.profile && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Perfil profesional</h2>
                    <p>Actualiza tus fotos, certificaciones, especialidad y teléfono público.</p>
                  </div>
                  <span className="sp-icon-tile">
                    <IonIcon icon={personCircleOutline} />
                  </span>
                </div>
                <IonButton routerLink="/perfil" className="sp-primary-button">
                  Ver y editar mi perfil
                </IonButton>
              </article>
              )}

              {flags.services_offered && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Servicios ofrecidos</h2>
                    <p>
                      {profile?.services.length
                        ? `${profile.services.length} servicio(s) configurado(s)`
                        : "Sin servicios configurados"}
                    </p>
                  </div>
                  <span className="sp-icon-tile">
                    <IonIcon icon={constructOutline} />
                  </span>
                </div>
              </article>
              )}

              {flags.availability && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Disponibilidad</h2>
                    <p>
                      {profile?.accepts_urgent
                        ? "Aceptas solicitudes urgentes"
                        : "Disponibilidad avanzada pendiente"}
                    </p>
                  </div>
                  <span className="sp-icon-tile">
                    <IonIcon icon={calendarClearOutline} />
                  </span>
                </div>
              </article>
              )}

              {flags.requests && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Mis solicitudes</h2>
                    <p>Revisa solicitudes reales dirigidas a tu perfil.</p>
                  </div>
                  <span className="sp-icon-tile sp-icon-tile--accent">
                    <IonIcon icon={briefcaseOutline} />
                  </span>
                </div>
                <IonButton routerLink="/profesional/solicitudes" className="sp-primary-button">
                  Ver mis solicitudes
                </IonButton>
              </article>
              )}

              {flags.jobs && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Trabajos activos</h2>
                    <p>Sin trabajos activos.</p>
                  </div>
                  <span className="sp-icon-tile">
                    <IonIcon icon={checkmarkCircleOutline} />
                  </span>
                </div>
              </article>
              )}

              {flags.chat && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h2>Chat con clientes</h2>
                      <IonBadge color="primary">En vivo</IonBadge>
                    </div>
                    <p>Responde consultas técnicas, cotizaciones y coordina citas con clientes.</p>
                  </div>
                  <span className="sp-icon-tile sp-icon-tile--accent">
                    <IonIcon icon={chatbubblesOutline} />
                  </span>
                </div>
                <IonButton onClick={() => setChatModalOpen(true)} className="sp-primary-button">
                  Abrir bandeja de chat
                </IonButton>
              </article>
              )}

              {flags.ads && (
              <article className="sp-card" style={{ borderLeft: "4px solid #f59e0b" }}>
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <h2>Publicidad de profesionales</h2>
                      {activePlan && (
                        <IonBadge color="warning" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>
                          Activo
                        </IonBadge>
                      )}
                    </div>
                    <p>
                      {activePlan
                        ? `Campaña activa: ${activePlan}. Tu perfil aparece destacado.`
                        : "Destaca tu perfil en los primeros lugares del mapa y multiplica tus servicios."}
                    </p>
                  </div>
                  <span className="sp-icon-tile" style={{ background: "#fef3c7", color: "#d97706" }}>
                    <IonIcon icon={sparkles} />
                  </span>
                </div>
                <IonButton
                  onClick={() => setAdsModalOpen(true)}
                  className="sp-primary-button"
                  style={{ "--background": "#d97706" }}
                >
                  {activePlan ? "Gestionar publicidad" : "Promocionar mi perfil"}
                </IonButton>
              </article>
              )}

              {flags.benefits && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Beneficios y Puntos</h2>
                    <p>Revisa tus puntos acumulados y canjea recompensas de la plataforma.</p>
                  </div>
                  <span className="sp-icon-tile">
                    <IonIcon icon={giftOutline} />
                  </span>
                </div>
                <IonButton routerLink="/profesional/beneficios" className="sp-primary-button">
                  Ver mis beneficios
                </IonButton>
              </article>
              )}

              {flags.store && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Tienda de Herramientas</h2>
                    <p>Compra y consulta herramientas, materiales y equipamiento de trabajo.</p>
                  </div>
                  <span className="sp-icon-tile">
                    <IonIcon icon={cartOutline} />
                  </span>
                </div>
                <IonButton routerLink="/tienda" className="sp-primary-button">
                  Ir a la tienda
                </IonButton>
              </article>
              )}

              {flags.publish_store && (
              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Publicar en tienda</h2>
                    <p>Publica tus herramientas o materiales en venta/alquiler para la comunidad.</p>
                  </div>
                  <span className="sp-icon-tile">
                    <IonIcon icon={addCircleOutline} />
                  </span>
                </div>
                <IonButton routerLink="/tienda?action=publish" className="sp-primary-button">
                  Publicar herramienta
                </IonButton>
              </article>
              )}
            </section>
          )}
        </main>
      </IonContent>

      {/* Modal de Publicidad de Profesionales */}
      <IonModal isOpen={adsModalOpen} onDidDismiss={() => setAdsModalOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Publicidad de Profesionales</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setAdsModalOpen(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding sp-role-content">
          <div style={{ maxWidth: "600px", margin: "0 auto", paddingBottom: "2rem" }}>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#fef3c7",
                  color: "#d97706",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                }}
              >
                <IonIcon icon={sparkles} />
              </div>
              <h2 style={{ margin: "0.5rem 0 0.2rem", fontWeight: "700" }}>Impulsa tu Perfil Profesional</h2>
              <p style={{ color: "var(--ion-color-medium)", margin: 0, fontSize: "0.95rem" }}>
                Aumenta tu visibilidad y recibe más contrataciones directas en Bogotá y alrededores.
              </p>
            </div>

            {activePlan && (
              <div
                style={{
                  background: "#ecfdf5",
                  border: "1px solid #10b981",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "1.5rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ color: "#065f46", display: "block" }}>Campaña activa: {activePlan}</strong>
                  <span style={{ fontSize: "0.85rem", color: "#047857" }}>Tu perfil tiene prioridad alta en búsquedas y mapa.</span>
                </div>
                <IonButton color="danger" fill="outline" size="small" onClick={handleCancelPlan}>
                  Pausar campaña
                </IonButton>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Plan 1 */}
              <div
                style={{
                  border: activePlan === "Plan Impulso Semanal" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: "700", fontSize: "1.1rem" }}>Plan Impulso Semanal</h3>
                    <span style={{ fontSize: "0.85rem", color: "var(--ion-color-medium)" }}>Ideal para iniciar y probar resultados</span>
                  </div>
                  <strong style={{ fontSize: "1.15rem", color: "#2563eb" }}>
                    \$35.000 <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>/ 7 días</span>
                  </strong>
                </div>
                <ul style={{ margin: "10px 0 14px", paddingLeft: "18px", fontSize: "0.9rem", color: "#475569" }}>
                  <li>Ubicación destacada con pin dorado en el mapa de contratistas.</li>
                  <li>Insignia temporal de "Profesional Recomendado".</li>
                  <li>Aparece entre los primeros 5 resultados de tu localidad.</li>
                </ul>
                <IonButton
                  expand="block"
                  size="small"
                  onClick={() => handleSelectPlan("Plan Impulso Semanal")}
                  disabled={activePlan === "Plan Impulso Semanal"}
                >
                  {activePlan === "Plan Impulso Semanal" ? "Plan actualmente activo" : "Activar Plan Impulso"}
                </IonButton>
              </div>

              {/* Plan 2 */}
              <div
                style={{
                  border: activePlan === "Plan Pro Destacado" ? "2px solid #d97706" : "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  position: "relative",
                }}
              >
                <IonBadge color="warning" style={{ position: "absolute", top: "-10px", right: "16px" }}>
                  MÁS POPULAR
                </IonBadge>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: "700", fontSize: "1.1rem" }}>Plan Pro Destacado</h3>
                    <span style={{ fontSize: "0.85rem", color: "var(--ion-color-medium)" }}>Máxima conversión de clientes</span>
                  </div>
                  <strong style={{ fontSize: "1.15rem", color: "#d97706" }}>
                    \$70.000 <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>/ 15 días</span>
                  </strong>
                </div>
                <ul style={{ margin: "10px 0 14px", paddingLeft: "18px", fontSize: "0.9rem", color: "#475569" }}>
                  <li>Posición #1 en tu especialidad y radio de 10 km.</li>
                  <li>Insignia Verificado Pro destacada en chat y solicitudes.</li>
                  <li>Hasta 3x más solicitudes de cotización directa.</li>
                </ul>
                <IonButton
                  expand="block"
                  size="small"
                  color="warning"
                  onClick={() => handleSelectPlan("Plan Pro Destacado")}
                  disabled={activePlan === "Plan Pro Destacado"}
                >
                  {activePlan === "Plan Pro Destacado" ? "Plan actualmente activo" : "Activar Plan Pro"}
                </IonButton>
              </div>

              {/* Plan 3 */}
              <div
                style={{
                  border: activePlan === "Plan Élite Mensual" ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontWeight: "700", fontSize: "1.1rem" }}>Plan Élite Mensual</h3>
                    <span style={{ fontSize: "0.85rem", color: "var(--ion-color-medium)" }}>Visibilidad total en toda la app</span>
                  </div>
                  <strong style={{ fontSize: "1.15rem", color: "#7c3aed" }}>
                    \$120.000 <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>/ 30 días</span>
                  </strong>
                </div>
                <ul style={{ margin: "10px 0 14px", paddingLeft: "18px", fontSize: "0.9rem", color: "#475569" }}>
                  <li>Banner patrocinado en el Home de clientes.</li>
                  <li>Notificaciones push a clientes buscando tu servicio.</li>
                  <li>Soporte VIP prioritario para contrataciones.</li>
                </ul>
                <IonButton
                  expand="block"
                  size="small"
                  style={{ "--background": "#7c3aed" }}
                  onClick={() => handleSelectPlan("Plan Élite Mensual")}
                  disabled={activePlan === "Plan Élite Mensual"}
                >
                  {activePlan === "Plan Élite Mensual" ? "Plan actualmente activo" : "Activar Plan Élite"}
                </IonButton>
              </div>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* Modal de Chat con Clientes */}
      <IonModal
        isOpen={chatModalOpen}
        onDidDismiss={() => {
          setChatModalOpen(false);
          setSelectedChat(null);
        }}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>{selectedChat ? selectedChat.clientName : "Chat con clientes"}</IonTitle>
            <IonButtons slot="end">
              <IonButton
                onClick={() => {
                  setChatModalOpen(false);
                  setSelectedChat(null);
                }}
              >
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding sp-role-content">
          <div style={{ maxWidth: "600px", margin: "0 auto", height: "100%", display: "flex", flexDirection: "column" }}>
            {selectedChat ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "450px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "10px",
                    marginBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <img
                      src={selectedChat.avatar}
                      alt={selectedChat.clientName}
                      style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div>
                      <strong style={{ display: "block" }}>{selectedChat.clientName}</strong>
                      <span style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>{selectedChat.service}</span>
                    </div>
                  </div>
                  <IonButton fill="clear" size="small" onClick={() => setSelectedChat(null)}>
                    Volver a lista
                  </IonButton>
                </div>

                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", padding: "10px 0" }}>
                  {selectedChat.messages.map((msg: ChatMessage) => (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: msg.sender === "pro" ? "flex-end" : "flex-start",
                        maxWidth: "80%",
                        background: msg.sender === "pro" ? "var(--ion-color-primary)" : "#f1f5f9",
                        color: msg.sender === "pro" ? "#ffffff" : "#1e293b",
                        padding: "10px 14px",
                        borderRadius: msg.sender === "pro" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                      }}
                    >
                      <p style={{ margin: 0, fontSize: "0.95rem" }}>{msg.text}</p>
                      <span style={{ display: "block", fontSize: "0.7rem", marginTop: "4px", opacity: 0.8, textAlign: "right" }}>
                        {msg.time}
                      </span>
                    </div>
                  ))}
                </div>

                <form
                  onSubmit={handleSendMessage}
                  style={{ display: "flex", gap: "8px", borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "8px" }}
                >
                  <input
                    type="text"
                    placeholder="Escribe una respuesta para el cliente..."
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    style={{ flex: 1, padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "0.95rem" }}
                  />
                  <IonButton type="submit" disabled={!chatInputText.trim()}>
                    <IonIcon slot="icon-only" icon={sendOutline} />
                  </IonButton>
                </form>
              </div>
            ) : (
              <div>
                <p style={{ color: "var(--ion-color-medium)", marginBottom: "1rem" }}>
                  Conversaciones activas con clientes interesados en tus servicios:
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedChat(conv)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "14px",
                        background: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                    >
                      <img
                        src={conv.avatar}
                        alt={conv.clientName}
                        style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong style={{ fontSize: "1rem" }}>{conv.clientName}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>{conv.time}</span>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "#2563eb", display: "block", margin: "2px 0" }}>{conv.service}</span>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.85rem",
                            color: "#64748b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {conv.lastMessage}
                        </p>
                      </div>
                      {conv.unread > 0 && <IonBadge color="danger">{conv.unread}</IonBadge>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={!!toastMessage}
        message={toastMessage}
        duration={3500}
        color="success"
        onDidDismiss={() => setToastMessage("")}
      />
    </IonPage>
  );
};

export default ProfessionalDashboard;
