import React, { useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import {
  arrowBackOutline,
  briefcaseOutline,
  buildOutline,
  checkmarkCircleOutline,
  homeOutline,
  locationOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import {
  catalogService,
  householdService,
  professionalSearchService,
} from "../../services/serviprox";
import type {
  Household,
  Professional,
  Service,
  ServiceCategory,
} from "../../types/serviprox";
import "./ServicioJob.css";

type FlowStep = "category" | "service" | "location" | "professional";

const stepOrder: FlowStep[] = ["category", "service", "location", "professional"];

const stepMeta: Record<FlowStep, { label: string; title: string }> = {
  category: { label: "Paso 1 de 4", title: "Qué necesitas" },
  service: { label: "Paso 2 de 4", title: "Tipo de trabajo" },
  location: { label: "Paso 3 de 4", title: "Dónde necesitas el servicio" },
  professional: { label: "Paso 4 de 4", title: "Profesionales compatibles" },
};

const formatMoney = (value: string | null) => {
  if (!value) return "";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "";
  return amount.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
};

const formatServicePrice = (service: Service) => {
  const min = formatMoney(service.price_min);
  const max = formatMoney(service.price_max);
  if (min && max) return `${min} - ${max}`;
  if (min) return `Desde ${min}`;
  if (max) return `Hasta ${max}`;
  return "Tarifa por definir con el profesional";
};

const formatProfessionalRating = (professional: Professional) => {
  const rating = Number(professional.rating_avg);
  return rating > 0 ? rating.toFixed(1) : "Sin calificaciones";
};

const hasCoordinates = (household: Household | null) =>
  household?.latitude != null && household?.longitude != null;

const ServicioJob: React.FC = () => {
  const history = useHistory();
  const [step, setStep] = useState<FlowStep>("category");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedHousehold, setSelectedHousehold] = useState<Household | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoadingInitial(true);
    Promise.all([catalogService.listCategories(), householdService.list()])
      .then(([categoryList, householdList]) => {
        if (!active) return;
        setCategories(categoryList);
        setHouseholds(householdList);
      })
      .catch(() => {
        if (active) setError("No pudimos cargar el catálogo o tus viviendas.");
      })
      .finally(() => {
        if (active) setLoadingInitial(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedStepIndex = stepOrder.indexOf(step);
  const selectedHouseholdHasCoordinates = hasCoordinates(selectedHousehold);

  const loadServices = async (category: ServiceCategory) => {
    setSelectedCategory(category);
    setSelectedService(null);
    setSelectedHousehold(null);
    setProfessionals([]);
    setStep("service");
    setLoadingServices(true);
    setError("");
    try {
      setServices(await catalogService.listServices({ category: category.id }));
    } catch {
      setError("No pudimos cargar los servicios de esta categoría.");
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  const selectService = (service: Service) => {
    setSelectedService(service);
    setSelectedHousehold(null);
    setPriceMin("");
    setPriceMax("");
    setProfessionals([]);
    setStep("location");
  };

  const loadProfessionals = async (household: Household) => {
    if (!selectedService) return;
    setSelectedHousehold(household);
    setProfessionals([]);
    setStep("professional");
    setLoadingProfessionals(true);
    setError("");
    try {
      const params = {
        service: selectedService.id,
        lat: household.latitude ?? undefined,
        lng: household.longitude ?? undefined,
        radius_km: hasCoordinates(household) ? 10 : undefined,
        price_min: priceMin || undefined,
        price_max: priceMax || undefined,
      };
      setProfessionals(await professionalSearchService.list(params));
    } catch {
      setError("No pudimos cargar profesionales compatibles.");
    } finally {
      setLoadingProfessionals(false);
    }
  };

  const goBack = () => {
    if (step === "professional") {
      setStep("location");
      return;
    }
    if (step === "location") {
      setStep("service");
      return;
    }
    if (step === "service") {
      setStep("category");
      return;
    }
    history.goBack();
  };

const progressLabel = useMemo(() => stepMeta[step], [step]);

  const formatProfessionalServicePrice = (professional: Professional) => {
    if (!professional.matching_service) return "Tarifa por acordar";
    const min = formatMoney(professional.matching_service.price_min);
    const max = formatMoney(professional.matching_service.price_max);
    if (min && max) return `${min} - ${max}`;
    if (min) return `Desde ${min}`;
    if (max) return `Hasta ${max}`;
    return "Tarifa por acordar";
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Selección directa</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-direct-content">
        <main className="sp-direct-page">
          <header className="sp-direct-header">
            <IonBadge className="sp-direct-kicker">CLIENTE</IonBadge>
            <h1>Sé qué servicio necesito</h1>
            <p>
              Elige una categoría, un servicio real del catálogo y la vivienda donde
              necesitas atención.
            </p>
          </header>

          <section className="sp-direct-shell">
            <div className="sp-direct-progress" aria-label={progressLabel.label}>
              {stepOrder.map((item, index) => (
                <span
                  key={item}
                  className={index <= selectedStepIndex ? "is-active" : ""}
                />
              ))}
            </div>

            <div className="sp-direct-step-head">
              <button type="button" onClick={goBack} aria-label="Volver">
                <IonIcon icon={arrowBackOutline} />
              </button>
              <div>
                <span>{progressLabel.label}</span>
                <h2>{progressLabel.title}</h2>
              </div>
            </div>

            {error && <p className="sp-direct-error">{error}</p>}

            {loadingInitial ? (
              <div className="sp-direct-loading">
                <IonSpinner name="crescent" />
                <span>Cargando datos reales...</span>
              </div>
            ) : null}

            {!loadingInitial && step === "category" ? (
              categories.length ? (
                <div className="sp-direct-grid">
                  {categories.map((category) => (
                    <button
                      type="button"
                      className="sp-direct-card"
                      key={category.id}
                      onClick={() => void loadServices(category)}
                    >
                      <span className="sp-direct-icon">
                        <IonIcon icon={buildOutline} />
                      </span>
                      <strong>{category.name}</strong>
                      <small>{category.description}</small>
                      <em>
                        {category.professionals_count === 1
                          ? "1 profesional"
                          : `${category.professionals_count} profesionales`}
                      </em>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="sp-direct-empty">No encontramos categorías activas.</div>
              )
            ) : null}

            {step === "service" ? (
              loadingServices ? (
                <div className="sp-direct-loading">
                  <IonSpinner name="crescent" />
                  <span>Cargando servicios...</span>
                </div>
              ) : services.length ? (
                <div className="sp-direct-grid">
                  {services.map((service) => (
                    <button
                      type="button"
                      className="sp-direct-card"
                      key={service.id}
                      onClick={() => selectService(service)}
                    >
                      <span className="sp-direct-icon">
                        <IonIcon icon={briefcaseOutline} />
                      </span>
                      <strong>{service.name}</strong>
                      <small>{service.description || selectedCategory?.name}</small>
                      <em>{formatServicePrice(service)}</em>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="sp-direct-empty">
                  No encontramos servicios activos para esta categoría.
                </div>
              )
            ) : null}

            {step === "location" ? (
              <div className="sp-direct-stack">
                <div className="sp-direct-summary">
                  <IonIcon icon={checkmarkCircleOutline} />
                  <span>
                    {selectedCategory?.name} / {selectedService?.name}
                  </span>
                </div>

                {households.length ? (
                  <div className="sp-direct-grid">
                    {households.map((household) => (
                      <button
                        type="button"
                        className="sp-direct-card"
                        key={household.id}
                        onClick={() => void loadProfessionals(household)}
                      >
                        <span className="sp-direct-icon">
                          <IonIcon icon={homeOutline} />
                        </span>
                        <strong>{household.label}</strong>
                        <small>{household.address_line || "Dirección pendiente"}</small>
                        <em>{household.short_location || household.city}</em>
                        {!hasCoordinates(household) ? (
                          <span className="sp-direct-note">
                            Sin coordenadas: se buscará sin distancia.
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="sp-direct-empty">
                    <p>No tienes viviendas registradas.</p>
                    <IonButton routerLink="/cliente/viviendas">Agregar vivienda</IonButton>
                  </div>
                )}
              </div>
            ) : null}

            {step === "professional" ? (
              <div className="sp-direct-stack">
                <div className="sp-direct-summary">
                  <IonIcon icon={locationOutline} />
                  <span>
                    {selectedHousehold?.label} / {selectedService?.name}
                  </span>
                </div>
                {!selectedHouseholdHasCoordinates ? (
                  <p className="sp-direct-soft-note">
                    Esta vivienda todavía no tiene ubicación geográfica asociada.
                    Mostramos profesionales que ofrecen el servicio, sin ordenar por distancia.
                  </p>
                ) : null}

                <div className="sp-price-filter" aria-label="Filtro por precio">
                  <label>
                    Precio mínimo
                    <IonInput
                      type="number"
                      inputmode="numeric"
                      min="0"
                      value={priceMin}
                      placeholder="0"
                      onIonInput={(event) => setPriceMin(String(event.detail.value ?? ""))}
                    />
                  </label>
                  <label>
                    Precio máximo
                    <IonInput
                      type="number"
                      inputmode="numeric"
                      min="0"
                      value={priceMax}
                      placeholder="250000"
                      onIonInput={(event) => setPriceMax(String(event.detail.value ?? ""))}
                    />
                  </label>
                  <IonButton
                    fill="outline"
                    disabled={!selectedHousehold || loadingProfessionals}
                    onClick={() =>
                      selectedHousehold ? void loadProfessionals(selectedHousehold) : undefined
                    }
                  >
                    Aplicar filtro
                  </IonButton>
                </div>

                {loadingProfessionals ? (
                  <div className="sp-direct-loading">
                    <IonSpinner name="crescent" />
                    <span>Buscando profesionales...</span>
                  </div>
                ) : professionals.length ? (
                  <div className="sp-professional-list">
                    {professionals.map((professional) => (
                      <article className="sp-professional-card" key={professional.id}>
                        <div className="sp-professional-avatar" aria-hidden="true">
                          {professional.initials}
                        </div>
                        <div className="sp-professional-body">
                          <div>
                            <h3>{professional.display_name}</h3>
                            <p>{professional.headline}</p>
                          </div>
                          <div className="sp-professional-meta">
                            <span>{formatProfessionalRating(professional)}</span>
                            <span>{professional.jobs_completed} servicios completados</span>
                            <span>{formatProfessionalServicePrice(professional)}</span>
                            {professional.distance_km != null ? (
                              <span>{professional.distance_km.toFixed(1)} km</span>
                            ) : null}
                          </div>
                          {professional.matching_service?.observaciones ? (
                            <p className="sp-professional-note">
                              {professional.matching_service.observaciones}
                            </p>
                          ) : null}
                          <div className="sp-professional-badges">
                            {professional.is_verified ? (
                              <IonBadge>
                                <IonIcon icon={shieldCheckmarkOutline} />
                                Verificado
                              </IonBadge>
                            ) : null}
                            {professional.accepts_urgent ? (
                              <IonBadge color="danger">Acepta urgencias</IonBadge>
                            ) : null}
                          </div>
                        </div>
                        <IonButton
                          fill="outline"
                          onClick={() =>
                            history.push(
                              `/cliente/profesionales/${professional.id}?service=${selectedService?.id}&household=${selectedHousehold?.id}`
                            )
                          }
                        >
                          Ver perfil
                        </IonButton>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="sp-direct-empty">
                    No encontramos profesionales compatibles para este servicio.
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default ServicioJob;
