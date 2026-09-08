import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import {
  briefcaseOutline,
  cashOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  homeOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from "ionicons/icons";
import {
  catalogService,
  householdService,
  professionalSearchService,
  serviceRequestService,
} from "../services/serviprox";
import type {
  Household,
  ProfessionalDetail,
  ProfessionalService,
  Service,
  ServiceRequestUrgency,
} from "../types/serviprox";
import "../components/servicioJob/ServicioJob.css";
import "../components/serviprox/RequestImageGallery.css";
import "./RolePages.css";

type RouteParams = {
  id: string;
};

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
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

const formatServicePrice = (service: ProfessionalService) => {
  const min = formatMoney(service.price_min);
  const max = formatMoney(service.price_max);
  if (min && max) return `${min} - ${max}`;
  if (min) return `Desde ${min}`;
  if (max) return `Hasta ${max}`;
  return "Tarifa por acordar";
};

const urgencyLabels: Record<ServiceRequestUrgency, string> = {
  flexible: "Puedo esperar",
  this_week: "Esta semana",
  urgent: "Urgente",
};

const ClientProfessionalDetail: React.FC = () => {
  const { id } = useParams<RouteParams>();
  const location = useLocation();
  const history = useHistory();
  const [professional, setProfessional] = useState<ProfessionalDetail | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>("this_week");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const [createdRequestId, setCreatedRequestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const serviceParam = query.get("service");
  const householdParam = query.get("household");
  const selectedServiceId = serviceParam ? Number(serviceParam) : NaN;
  const selectedHouseholdId = householdParam ? Number(householdParam) : NaN;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      professionalSearchService.get(id),
      Number.isFinite(selectedServiceId)
        ? catalogService.getService(selectedServiceId)
        : Promise.resolve(null),
      householdService.list(),
    ])
      .then(([professionalPayload, servicePayload, households]) => {
        if (!active) return;
        setProfessional(professionalPayload);
        setService(servicePayload);
        setHousehold(
          households.find((item) => item.id === selectedHouseholdId) || null
        );
      })
      .catch(() => {
        if (active) setError("No pudimos cargar el resumen de la solicitud.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, selectedHouseholdId, selectedServiceId]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  const addImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    );
    const nextImages = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setSelectedImages((current) => [...current, ...nextImages]);
    event.target.value = "";
  };

  const removeImage = (imageId: string) => {
    setSelectedImages((current) => {
      const image = current.find((item) => item.id === imageId);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== imageId);
    });
  };

  const selectedOffering = professional?.services.find(
    (offering) => offering.service === selectedServiceId
  );
  const canSubmit =
    !!professional &&
    !!service &&
    !!household &&
    !!selectedOffering &&
    description.trim().length >= 8 &&
    !sending &&
    !createdRequestId;

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !professional || !service || !household) return;

    setSending(true);
    setError("");
    try {
      const request = await serviceRequestService.create({
        household: household.id,
        selected_service: service.id,
        professional: professional.id,
        description: description.trim(),
        urgency,
      }, selectedImages.map((image) => image.file));
      setCreatedRequestId(request.id);
      setToast("Solicitud enviada");
    } catch {
      setError("No pudimos enviar la solicitud. Revisa los datos e inténtalo otra vez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Solicitar servicio</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          {loading ? (
            <div className="sp-route-loading">
              <IonSpinner name="crescent" />
              <span>Cargando resumen...</span>
            </div>
          ) : error ? (
            <section className="sp-card">
              <p className="sp-error">{error}</p>
              <IonButton routerLink="/cliente/servicios">Volver a servicios</IonButton>
            </section>
          ) : professional ? (
            <>
              <header className="sp-role-header">
                <span className="sp-role-kicker">CLIENTE</span>
                <h1>{professional.display_name}</h1>
                <p>{professional.headline}</p>
              </header>

              <section className="sp-grid sp-grid--two">
                <article className="sp-card">
                  <div className="sp-card-header">
                    <div className="sp-card-title">
                      <h2>Profesional</h2>
                      <p>{professional.bio || "Este profesional aún no agregó descripción."}</p>
                    </div>
                    <div className="sp-professional-avatar" aria-hidden="true">
                      {professional.initials}
                    </div>
                  </div>

                  <div className="sp-professional-meta">
                    <span>
                      {Number(professional.rating_avg) > 0
                        ? Number(professional.rating_avg).toFixed(1)
                        : "Sin calificaciones"}
                    </span>
                    <span>{professional.jobs_completed} servicios completados</span>
                    <span>{professional.response_time_minutes} min respuesta</span>
                  </div>

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
                </article>

                <article className="sp-card">
                  <div className="sp-card-title">
                    <h2>Resumen real</h2>
                    <p>Esta información se enviará con IDs reales al backend.</p>
                  </div>
                  <div className="sp-list">
                    <div className="sp-list-item">
                      <strong>{service?.name || "Servicio no disponible"}</strong>
                      <span className="sp-muted">{service?.category_slug}</span>
                      <span className="sp-muted">
                        {selectedOffering
                          ? formatServicePrice(selectedOffering)
                          : "Este profesional no ofrece el servicio seleccionado."}
                      </span>
                      {selectedOffering?.observaciones ? (
                        <span className="sp-muted">{selectedOffering.observaciones}</span>
                      ) : null}
                    </div>
                    <div className="sp-list-item">
                      <strong>{household?.label || "Vivienda no disponible"}</strong>
                      <span className="sp-muted">
                        {household?.address_line || "Dirección pendiente"}
                      </span>
                      <span className="sp-muted">
                        {household?.short_location || household?.city}
                      </span>
                    </div>
                  </div>
                </article>
              </section>

              <section className="sp-card">
                <div className="sp-card-title">
                  <h2>Solicitar servicio</h2>
                  <p>Cuéntale al profesional qué ocurre.</p>
                </div>
                <form className="sp-form" onSubmit={submitRequest}>
                  <label className="sp-field">
                    Describe brevemente qué necesitas
                    <IonTextarea
                      value={description}
                      autoGrow
                      rows={5}
                      maxlength={600}
                      disabled={!!createdRequestId}
                      onIonInput={(event) =>
                        setDescription(String(event.detail.value ?? ""))
                      }
                    />
                  </label>
                  <label className="sp-field">
                    Urgencia
                    <IonSelect
                      value={urgency}
                      interface="popover"
                      disabled={!!createdRequestId}
                      onIonChange={(event) => setUrgency(event.detail.value)}
                    >
                      {Object.entries(urgencyLabels).map(([value, label]) => (
                        <IonSelectOption value={value} key={value}>
                          {label}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </label>

                  <div className="sp-field">
                    Fotos del problema (opcional)
                    <div className="sp-evidence-input">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={!!createdRequestId || sending}
                        onChange={addImages}
                        aria-label="Seleccionar fotos del problema"
                      />
                      <span className="sp-muted">
                        Puedes adjuntar varias imágenes y retirarlas antes de enviar.
                      </span>
                    </div>
                    {selectedImages.length ? (
                      <div className="sp-evidence-preview-grid">
                        {selectedImages.map((image) => (
                          <div className="sp-evidence-preview" key={image.id}>
                            <img src={image.previewUrl} alt="Vista previa del problema" />
                            {!createdRequestId ? (
                              <button
                                type="button"
                                onClick={() => removeImage(image.id)}
                                aria-label="Retirar foto"
                                disabled={sending}
                              >
                                <IonIcon icon={closeCircleOutline} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {createdRequestId ? (
                    <div className="sp-direct-summary">
                      <IonIcon icon={checkmarkCircleOutline} />
                      <span>Solicitud enviada</span>
                    </div>
                  ) : null}

                  {error && <p className="sp-error">{error}</p>}

                  <div className="sp-actions">
                    <IonButton
                      type="submit"
                      className="sp-primary-button"
                      disabled={!canSubmit}
                      aria-label="Enviar solicitud"
                    >
                      {sending ? (
                        <IonSpinner name="crescent" />
                      ) : (
                        <>
                          <IonIcon slot="start" icon={cashOutline} />
                          Enviar solicitud
                        </>
                      )}
                    </IonButton>
                    {createdRequestId ? (
                      <IonButton
                        type="button"
                        fill="outline"
                        onClick={() => history.replace("/cliente/solicitudes")}
                      >
                        <IonIcon slot="start" icon={briefcaseOutline} />
                        Ver mis solicitudes
                      </IonButton>
                    ) : (
                      <IonButton type="button" fill="clear" routerLink="/cliente/servicios">
                        <IonIcon slot="start" icon={homeOutline} />
                        Buscar otro profesional
                      </IonButton>
                    )}
                  </div>

                  <p className="sp-muted">
                    Urgencia: {urgencyLabels[urgency]} <IonIcon icon={timeOutline} />
                  </p>
                </form>
              </section>
            </>
          ) : null}
        </main>
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

export default ClientProfessionalDetail;
