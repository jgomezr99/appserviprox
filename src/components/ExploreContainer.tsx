import React, { useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonGrid,
  IonIcon,
  IonRow,
  IonSpinner,
  IonText,
} from "@ionic/react";
import {
  buildOutline,
  checkmarkCircleOutline,
  flashOutline,
  helpCircleOutline,
  homeOutline,
  locationOutline,
  searchOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";

import { api } from "../services/api";
import type { PaginatedResponse, ServiceCategory } from "../types/serviprox";
import "./ExploreContainer.css";

interface ContainerProps {
  name: string;
}

type Modality = {
  title: string;
  text: string;
  icon: string;
  action: string;
  routerLink?: string;
  status?: string;
};

const MODALITIES: Modality[] = [
  {
    title: "Sé qué servicio necesito",
    text: "Explora servicios para tu hogar y elige la categoría adecuada antes de crear una solicitud.",
    icon: searchOutline,
    action: "Explorar servicios",
    routerLink: "/cliente/servicios",
  },
  {
    title: "Tengo un problema",
    text: "Te orientamos para encontrar el tipo de servicio adecuado. La decisión final siempre será tuya.",
    icon: helpCircleOutline,
    action: "Orientación guiada",
    status: "Preparado para conectar con diagnosis",
  },
  {
    title: "Profesionales cerca de mí",
    text: "Explora profesionales disponibles según la ubicación donde necesitas el servicio.",
    icon: locationOutline,
    action: "Proximidad",
    status: "Mapa pendiente para la siguiente fase",
  },
];

const TRUST_POINTS = [
  { label: "Servicios residenciales", icon: homeOutline },
  { label: "Profesionales verificados", icon: shieldCheckmarkOutline },
  { label: "Solicitudes claras", icon: checkmarkCircleOutline },
  { label: "Atención oportuna", icon: flashOutline },
];

const formatCount = (count: number) =>
  count === 1 ? "1 profesional" : `${count} profesionales`;

const ExploreContainer: React.FC<ContainerProps> = () => {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [apiState, setApiState] = useState<"ready" | "offline">("offline");

  useEffect(() => {
    let active = true;

    api
      .get<PaginatedResponse<ServiceCategory> | ServiceCategory[]>("categories/")
      .then((payload) => {
        if (!active) return;
        const nextCategories = Array.isArray(payload) ? payload : payload.results;
        setCategories(nextCategories);
        setApiState("ready");
      })
      .catch(() => {
        if (active) {
          setApiState("offline");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCategories(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleCategories = useMemo(() => categories.slice(0, 6), [categories]);

  return (
    <div className="sp-home">
      <section className="sp-hero">
        <div className="sp-hero__content">
          <IonBadge className="sp-kicker">Servicios para el hogar</IonBadge>
          <h1>Encuentra ayuda confiable para tu hogar</h1>
          <p>
            Serviprox conecta clientes con profesionales residenciales para resolver
            reparaciones, mantenimiento, instalaciones y tareas domésticas con más claridad.
          </p>
          <div className="sp-hero__actions">
            <IonButton routerLink="/cliente/servicios">Buscar servicio</IonButton>
            <IonButton routerLink="/cliente/viviendas" fill="outline">
              Mis viviendas
            </IonButton>
          </div>
        </div>

        <div className="sp-hero__panel" aria-label="Resumen de servicios del hogar">
          {TRUST_POINTS.map((item) => (
            <div className="sp-trust-item" key={item.label}>
              <IonIcon icon={item.icon} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sp-section">
        <IonText>
          <h2>Elige cómo quieres empezar</h2>
        </IonText>
        <IonGrid fixed>
          <IonRow className="sp-card-row">
            {MODALITIES.map((modality) => (
              <IonCol size="12" sizeMd="4" key={modality.title}>
                <IonCard className="sp-glass-card sp-modality-card">
                  <IonCardHeader>
                    <div className="sp-icon-badge">
                      <IonIcon icon={modality.icon} />
                    </div>
                    <IonCardTitle>{modality.title}</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <p>{modality.text}</p>
                    {modality.routerLink ? (
                      <IonButton routerLink={modality.routerLink} fill="clear">
                        {modality.action}
                      </IonButton>
                    ) : (
                      <IonButton fill="clear" disabled>
                        {modality.action}
                      </IonButton>
                    )}
                    {modality.status && <small>{modality.status}</small>}
                  </IonCardContent>
                </IonCard>
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>
      </section>

      <section className="sp-section sp-section--soft">
        <div className="sp-section-heading">
          <div>
            <h2>Categorías del hogar</h2>
            <p>Catálogo conectado al backend Django cuando la API está disponible.</p>
          </div>
          <IonBadge className={apiState === "ready" ? "sp-api-badge is-ready" : "sp-api-badge"}>
            API {apiState === "ready" ? "conectada" : "pendiente"}
          </IonBadge>
        </div>

        {loadingCategories ? (
          <div className="sp-loading">
            <IonSpinner name="crescent" />
            <span>Cargando categorías...</span>
          </div>
        ) : visibleCategories.length > 0 ? (
          <IonGrid fixed>
            <IonRow className="sp-card-row">
              {visibleCategories.map((category) => (
                <IonCol size="12" sizeMd="6" sizeLg="4" key={category.id}>
                  <IonCard className="sp-glass-card sp-category-card">
                    <IonCardHeader>
                      <div className="sp-icon-badge sp-icon-badge--red">
                        <IonIcon icon={buildOutline} />
                      </div>
                      <IonCardTitle>{category.name}</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <p>{category.description}</p>
                      <span>{formatCount(category.professionals_count)}</span>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              ))}
            </IonRow>
          </IonGrid>
        ) : (
          <div className="sp-empty-state">
            Levanta Django y carga los datos demo para ver las categorías reales del hogar.
          </div>
        )}
      </section>
    </div>
  );
};

export default ExploreContainer;
