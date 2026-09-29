import React, { useEffect, useMemo, useRef, useState } from "react";
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
  chevronBackOutline,
  chevronForwardOutline,
  constructOutline,
  flashOutline,
  helpCircleOutline,
  homeOutline,
  locationOutline,
  searchOutline,
  shieldCheckmarkOutline,
  star,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";

import { api } from "../services/api";
import { professionalSearchService } from "../services/serviprox";
import type {
  PaginatedResponse,
  Professional,
  ServiceCategory,
  ServiceRequestUrgency,
} from "../types/serviprox";
import TomarServicioModal from "./servicios/TomarServicioModal";
import OrientacionGuiadaModal from "./servicios/OrientacionGuiadaModal";
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
  onClick?: () => void;
  status?: string;
};


const TRUST_POINTS = [
  { label: "Servicios residenciales", icon: homeOutline },
  { label: "Profesionales verificados", icon: shieldCheckmarkOutline },
  { label: "Solicitudes claras", icon: checkmarkCircleOutline },
  { label: "Atención oportuna", icon: flashOutline },
];

const formatCount = (count: number) =>
  count === 1 ? "1 profesional" : `${count} profesionales`;

const ExploreContainer: React.FC<ContainerProps> = () => {
  const history = useHistory();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [apiState, setApiState] = useState<"ready" | "offline">("offline");
  const [selectedCategoryForModal, setSelectedCategoryForModal] = useState<ServiceCategory | null>(null);
  const [selectedProForModal, setSelectedProForModal] = useState<Professional | null>(null);
  const [initialDescriptionForModal, setInitialDescriptionForModal] = useState("");
  const [initialUrgencyForModal, setInitialUrgencyForModal] = useState<ServiceRequestUrgency>("this_week");
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  // Estado del modal de diagnóstico y orientación
  const [isDiagnosisModalOpen, setIsDiagnosisModalOpen] = useState(false);

  // Estado del carrusel de profesionales
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loadingProfessionals, setLoadingProfessionals] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);

  const handleScrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleExploreServicesClick = () => {
    const el = document.getElementById("categorias-hogar") || document.getElementById("carrusel-profesionales");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleTakeService = (cat: ServiceCategory) => {
    setSelectedCategoryForModal(cat);
    setSelectedProForModal(null);
    setInitialDescriptionForModal("");
    setInitialUrgencyForModal("this_week");
    setIsServiceModalOpen(true);
  };

  const handleTakeServiceWithPro = (pro: Professional) => {
    setSelectedProForModal(pro);
    setInitialDescriptionForModal("");
    setInitialUrgencyForModal("this_week");
    let matchedCat: ServiceCategory | null = null;
    if (pro.categories && pro.categories.length > 0) {
      matchedCat =
        categories.find((c) =>
          pro.categories.some(
            (pc) =>
              pc.toLowerCase() === c.slug.toLowerCase() ||
              pc.toLowerCase() === c.name.toLowerCase()
          )
        ) || null;
    }
    if (!matchedCat && categories.length > 0) {
      matchedCat = categories[0];
    }
    setSelectedCategoryForModal(matchedCat);
    setIsServiceModalOpen(true);
  };

  const handleTakeDiagnosedService = (params: {
    category: ServiceCategory;
    description: string;
    urgency: ServiceRequestUrgency;
    professional: Professional | null;
  }) => {
    setSelectedCategoryForModal(params.category);
    setSelectedProForModal(params.professional);
    setInitialDescriptionForModal(params.description);
    setInitialUrgencyForModal(params.urgency);
    setIsDiagnosisModalOpen(false);

    // Permite a Ionic completar la animación de cierre del modal previo
    setTimeout(() => {
      setIsServiceModalOpen(true);
    }, 280);
  };

  const handleViewMap = (cat: ServiceCategory) => {
    history.push(`/cliente/mapa?category=${encodeURIComponent(cat.slug || cat.name)}`);
  };

  const modalities: Modality[] = useMemo(
    () => [
      {
        title: "Sé qué servicio necesito",
        text: "Explora servicios para tu hogar y elige la categoría adecuada antes de crear una solicitud.",
        icon: searchOutline,
        action: "Explorar servicios",
        onClick: handleExploreServicesClick,
      },
      {
        title: "Tengo un problema",
        text: "Te orientamos para encontrar el tipo de servicio adecuado. La decisión final siempre será tuya.",
        icon: helpCircleOutline,
        action: "Orientación guiada",
        status: "✓ Diagnóstico guiado activo",
        onClick: () => setIsDiagnosisModalOpen(true),
      },
      {
        title: "Profesionales cerca de mí",
        text: "Explora profesionales disponibles según la ubicación donde necesitas el servicio en Bogotá.",
        icon: locationOutline,
        action: "Ver mapa de Bogotá",
        routerLink: "/cliente/mapa",
      },
    ],
    []
  );

  useEffect(() => {
    let active = true;

    // Cargar categorías
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

    // Cargar profesionales para el carrusel
    professionalSearchService
      .list({})
      .then((proList) => {
        if (!active) return;
        setProfessionals(proList);
      })
      .catch((err) => {
        console.warn("Error cargando profesionales:", err);
      })
      .finally(() => {
        if (active) {
          setLoadingProfessionals(false);
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
            <IonButton routerLink="/cliente/viviendas">Mis viviendas</IonButton>
           
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
            {modalities.map((modality) => (
              <IonCol size="12" sizeMd="4" key={modality.title}>
                <IonCard
                  className="sp-glass-card sp-modality-card"
                  onClick={modality.onClick}
                  style={{
                    cursor: modality.onClick || modality.routerLink ? "pointer" : "default",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <IonCardHeader>
                    <div className="sp-icon-badge">
                      <IonIcon icon={modality.icon} />
                    </div>
                    <IonCardTitle>{modality.title}</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent style={{ marginTop: "auto" }}>
                    <p>{modality.text}</p>
                    {modality.onClick ? (
                      <IonButton
                        fill="clear"
                        onClick={(e) => {
                          e.stopPropagation();
                          modality.onClick?.();
                        }}
                        style={{ fontWeight: 700 }}
                      >
                        {modality.action} →
                      </IonButton>
                    ) : modality.routerLink ? (
                      <IonButton routerLink={modality.routerLink} fill="clear" style={{ fontWeight: 700 }}>
                        {modality.action} →
                      </IonButton>
                    ) : (
                      <IonButton fill="clear" disabled>
                        {modality.action}
                      </IonButton>
                    )}
                    {modality.status && (
                      <small style={{ color: "#0B2F6B", fontWeight: 700, display: "block", marginTop: "4px" }}>
                        {modality.status}
                      </small>
                    )}
                  </IonCardContent>
                </IonCard>
              </IonCol>
            ))}
          </IonRow>
        </IonGrid>
      </section>

      {/* Carrusel de Profesionales Disponibles */}
      <section id="carrusel-profesionales" className="sp-section sp-pro-carousel-section">
        <div className="sp-section-heading">
          <div>
            <div className="sp-carousel-heading-tag">
              <IonBadge color="primary">Verificados 2026</IonBadge>
              <span className="sp-live-pulse-dot" />
              <span style={{ fontSize: "0.82rem", color: "#16a34a", fontWeight: 700 }}>
                Disponibles para visitar hoy en Bogotá
              </span>
            </div>
            <h2> Profesionales Disponibles</h2>
            <p>Escoge a tu profesional según especialidad, calificación y toma el servicio al instante.</p>
          </div>
          <div className="sp-carousel-scroll-controls">
            <button
              type="button"
              className="sp-carousel-arrow-btn"
              onClick={() => handleScrollCarousel("left")}
              aria-label="Anterior"
            >
              <IonIcon icon={chevronBackOutline} />
            </button>
            <button
              type="button"
              className="sp-carousel-arrow-btn"
              onClick={() => handleScrollCarousel("right")}
              aria-label="Siguiente"
            >
              <IonIcon icon={chevronForwardOutline} />
            </button>
          </div>
        </div>

        {loadingProfessionals ? (
          <div className="sp-loading">
            <IonSpinner name="crescent" />
            <span>Cargando de profesionales...</span>
          </div>
        ) : professionals.length > 0 ? (
          <div className="sp-home-pro-carousel-container" ref={carouselRef}>
            {professionals.map((pro) => (
              <div className="sp-home-pro-card" key={pro.id}>
                <div className="sp-home-pro-header">
                  <div className="sp-home-pro-avatar">
                    {pro.avatar_url ? (
                      <img src={pro.avatar_url} alt={pro.display_name} />
                    ) : (
                      pro.initials || "PRO"
                    )}
                  </div>
                  <div className="sp-home-pro-badge-group">
                    <span className="sp-home-pro-rating">
                      <IonIcon icon={star} /> {pro.rating_avg || "4.9"}
                    </span>
                    <span className="sp-home-pro-verified">✓ Verificado</span>
                  </div>
                </div>

                <div className="sp-home-pro-body">
                  <h3 className="sp-home-pro-name">{pro.display_name}</h3>
                  <p className="sp-home-pro-headline">{pro.headline || "Técnico especialista"}</p>
                  <div className="sp-home-pro-location">
                    <IonIcon icon={locationOutline} />
                    <span>{pro.neighborhood || "Bogotá D.C."}</span>
                  </div>

                  <div className="sp-home-pro-services-tags">
                    {pro.categories && pro.categories.length > 0 ? (
                      pro.categories.slice(0, 3).map((catName, idx) => (
                        <span key={idx} className="sp-pro-service-tag">
                          {catName}
                        </span>
                      ))
                    ) : (
                      <span className="sp-pro-service-tag">Servicios del hogar</span>
                    )}
                  </div>
                </div>

                <div className="sp-home-pro-footer">
                  <IonButton
                    expand="block"
                    className="sp-btn-pick-pro"
                    onClick={() => handleTakeServiceWithPro(pro)}
                  >
                    <IonIcon slot="start" icon={constructOutline} />
                    Tomar servicio con {pro.display_name.split(" ")[0]}
                  </IonButton>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="sp-empty-state">
            No se encontraron profesionales disponibles en este momento.
          </div>
        )}
      </section>

      <section id="categorias-hogar" className="sp-section sp-section--soft">
        <div className="sp-section-heading">
          <div>
            <h2>Categorías del hogar</h2>
            <p>Catálogo conectado al backend Django con servicios especializados.</p>
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
                      <span style={{ display: "block", marginBottom: "14px", fontWeight: 700, color: "var(--sp-text-muted)" }}>
                        {formatCount(category.professionals_count)}
                      </span>

                      <div className="sp-category-card-actions" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                        <IonButton
                          expand="block"
                          color="primary"
                          className="sp-btn-take-service"
                          onClick={() => handleTakeService(category)}
                          style={{ margin: 0, fontWeight: 700 }}
                        >
                          <IonIcon slot="start" icon={constructOutline} />
                          Tomar el servicio
                        </IonButton>
                      </div>
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

      {/* Modal para Tomar el Servicio y Confirmar Dirección */}
      <TomarServicioModal
        isOpen={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        category={selectedCategoryForModal}
        initialProfessional={selectedProForModal}
        initialDescription={initialDescriptionForModal}
        initialUrgency={initialUrgencyForModal}
      />

      {/* Modal de Orientación Guiada & Diagnóstico del Hogar */}
      <OrientacionGuiadaModal
        isOpen={isDiagnosisModalOpen}
        onClose={() => setIsDiagnosisModalOpen(false)}
        categories={categories}
        professionals={professionals}
        onTakeService={handleTakeDiagnosedService}
      />
    </div>
  );
};

export default ExploreContainer;
