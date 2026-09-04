import React, { useEffect, useState } from "react";
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  briefcaseOutline,
  calendarClearOutline,
  checkmarkCircleOutline,
  constructOutline,
  personCircleOutline,
} from "ionicons/icons";
import { ApiError } from "../services/api";
import { professionalProfileService } from "../services/serviprox";
import { useAuth } from "../context/AuthContext";
import type { ProfessionalProfile } from "../types/serviprox";
import "./RolePages.css";

const ProfessionalDashboard: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  const displayName = user?.first_name || profile?.display_name || "Profesional";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Dashboard profesional</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">PROFESIONAL</span>
            <h1>Hola, {displayName}</h1>
            <p>Gestiona tu perfil y prepara tu operación en Serviprox.</p>
          </header>

          {loading ? (
            <div className="sp-card sp-route-loading">
              <IonSpinner name="crescent" />
              <span>Cargando tu perfil...</span>
            </div>
          ) : (
            <section className="sp-grid sp-grid--two">
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

              <article className="sp-card">
                <div className="sp-card-header">
                  <div className="sp-card-title">
                    <h2>Solicitudes pendientes</h2>
                    <p>Sin solicitudes pendientes.</p>
                  </div>
                  <span className="sp-icon-tile sp-icon-tile--accent">
                    <IonIcon icon={briefcaseOutline} />
                  </span>
                </div>
              </article>

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
            </section>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default ProfessionalDashboard;
