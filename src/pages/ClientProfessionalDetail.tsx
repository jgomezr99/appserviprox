import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import {
  arrowBackOutline,
  briefcaseOutline,
  calendarOutline,
  cameraOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  constructOutline,
  flashOutline,
  homeOutline,
  locationOutline,
  navigateOutline,
  paperPlaneOutline,
  shieldCheckmarkOutline,
  star,
  timeOutline,
} from "ionicons/icons";
import { ApiError } from "../services/api";
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
import { geocodeAddress, normalizeBogotaAddress } from "../utils/geocoding";
import { useAuth } from "../context/AuthContext";
import "./ClientProfessionalDetail.css";
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
  return "Tarifa por convenir";
};

const urgencyOptions: Array<{
  value: ServiceRequestUrgency;
  title: string;
  subtitle: string;
  icon: string;
  isUrgent?: boolean;
}> = [
  {
    value: "flexible",
    title: "Flexible",
    subtitle: "Puedo esperar unos días",
    icon: calendarOutline,
  },
  {
    value: "this_week",
    title: "Esta semana",
    subtitle: "En los próximos 2 a 3 días",
    icon: timeOutline,
  },
  {
    value: "urgent",
    title: "Urgente",
    subtitle: "Atención prioritaria hoy",
    icon: flashOutline,
    isUrgent: true,
  },
];

const ideasrapi = [
  "Tengo una fuga de agua en casa",
  "Se presentó un problema eléctrico",
  "Necesito cambiar una cerradura",
  "Necesito instalar un accesorio",
  "Quiero revisar una falla en casa",
  "Necesito reparar una tubería",
  "Tengo un sanitario con problemas",
  "Necesito instalar una lámpara",
  "Necesito cambiar un interruptor",
  "Quiero reparar una puerta",
  "Necesito instalar una repisa",
  "Necesito armar un mueble",
  "Quiero pintar una habitación",
  "Necesito una limpieza profunda",
  "Necesito revisar un electrodoméstico",
  "Necesito mantenimiento para mi hogar",
  "Busco un profesional para hoy",
  "Necesito un servicio urgente",
  "Quiero solicitar una cotización",
  "Necesito un diagnóstico del problema"
];
const ClientProfessionalDetail: React.FC = () => {
  const { id } = useParams<RouteParams>();
  const { user } = useAuth();
  const location = useLocation();
  const history = useHistory();

  const [professional, setProfessional] = useState<ProfessionalDetail | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>("this_week");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [createdRequestId, setCreatedRequestId] = useState<number | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [addressLine, setAddressLine] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
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
      householdService.list().catch(() => [] as Household[]),
    ])
      .then(async ([professionalPayload, households]) => {
        if (!active) return;
        setProfessional(professionalPayload);

        const targetServiceId = Number.isFinite(selectedServiceId)
          ? selectedServiceId
          : professionalPayload.services?.[0]?.service;

        if (targetServiceId) {
          const s = await catalogService.getService(targetServiceId).catch(() => null);
          if (active) setService(s);
        }

        if (active) {
          let resolvedHousehold =
            households.find((item) => item.id === selectedHouseholdId) ||
            households.find((item) => item.is_default) ||
            households[0] ||
            null;

          if (!resolvedHousehold && user) {
            try {
              resolvedHousehold = await householdService.create({
                label: "Mi hogar",
                property_type: "apartment",
                address_line: user.address || "Bogotá",
                neighborhood: "Bogotá",
                city: user.city || "Bogotá",
                country: "Colombia",
                area_m2: null,
                build_year: null,
                notes: "",
                is_default: true,
              });
            } catch (createErr) {
              console.warn("No se pudo crear automáticamente el hogar:", createErr);
            }
          }
          setHousehold(resolvedHousehold);
          if (resolvedHousehold) {
            setAddressLine(resolvedHousehold.address_line || user?.address || "Dg. 40a # 8-91");
            setNeighborhood(resolvedHousehold.neighborhood || "Santa Fé, Bogotá, D.C.");
          } else if (user?.address) {
            setAddressLine(user.address);
            setNeighborhood("Santa Fé, Bogotá, D.C.");
          } else {
            setAddressLine("Dg. 40a # 8-91");
            setNeighborhood("Santa Fé, Bogotá, D.C.");
          }
        }
      })
      .catch(() => {
        if (active) setError("No pudimos cargar los datos del profesional.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, selectedHouseholdId, selectedServiceId, user]);

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

  const selectedOffering =
    professional?.services.find((offering) => offering.service === service?.id) ||
    professional?.services[0];

  const calculatedTravel = useMemo(() => {
    let profLat = Number(professional?.latitude) || 4.672;
    let profLng = Number(professional?.longitude) || -74.055;
    let homeLat = Number(household?.latitude) || 4.626910245009691;
    let homeLng = Number(household?.longitude) || -74.06721883068974;

    if (Math.abs(profLat - homeLat) < 0.0005 && Math.abs(profLng - homeLng) < 0.0005) {
      profLat += 0.018;
      profLng += 0.014;
    }

    const R = 6371;
    const dLat = ((homeLat - profLat) * Math.PI) / 180;
    const dLon = ((homeLng - profLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((profLat * Math.PI) / 180) *
        Math.cos((homeLat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distDirectKm = R * c;
    const roadDistKm = Math.max(1.2, distDirectKm * 1.25);
    const travelMinutes = Math.max(8, Math.round((roadDistKm / 22) * 60 + 4));

    const arrivalDate = new Date(Date.now() + travelMinutes * 60000);
    const arrivalTimeStr = arrivalDate.toLocaleTimeString("es-CO", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return {
      roadDistKm: roadDistKm.toFixed(1),
      travelMinutes,
      arrivalTimeStr,
    };
  }, [professional, household]);

  const canSubmit =
    !!professional &&
    !!service &&
    (!!household || !!user) &&
    !!selectedOffering &&
    description.trim().length >= 8 &&
    !sending &&
    !createdRequestId;

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !professional || !service) return;

    let targetHousehold = household;
    const rawAddr = addressLine.trim() || user?.address || "Dg. 40a # 8-91";
    const finalAddress = normalizeBogotaAddress(
      /diagonal\s*40\s*(?:a|#)?/i.test(rawAddr) ? rawAddr.replace(/diagonal\s*40\s*a?/i, "Diagonal 40A") : rawAddr
    );
    const isDiag40A =
      finalAddress.toLowerCase().includes("40") &&
      (finalAddress.includes("8-91") || finalAddress.includes("8 91") || finalAddress.includes("891"));
    const finalNeighborhood = isDiag40A
      ? "Santa Fé, Bogotá, D.C."
      : neighborhood.trim() || "Santa Fé, Bogotá, D.C.";

    const coords = await geocodeAddress(finalAddress, user?.city || "Bogotá");

    if (!targetHousehold && user) {
      try {
        targetHousehold = await householdService.create({
          label: "Mi hogar",
          property_type: "apartment",
          address_line: finalAddress,
          neighborhood: finalNeighborhood,
          city: user.city || "Bogotá",
          country: "Colombia",
          area_m2: null,
          build_year: null,
          notes: "",
          is_default: true,
          latitude: coords.lat,
          longitude: coords.lng,
        });
        setHousehold(targetHousehold);
      } catch {
        setError("Por favor define tu dirección antes de enviar.");
        return;
      }
    } else if (targetHousehold && (addressLine.trim() !== targetHousehold.address_line || neighborhood.trim() !== targetHousehold.neighborhood || !targetHousehold.latitude || Math.abs((targetHousehold.latitude || 0) - 4.6482) < 0.001)) {
      try {
        targetHousehold = await householdService.update(targetHousehold.id, {
          address_line: finalAddress,
          neighborhood: finalNeighborhood,
          latitude: coords.lat,
          longitude: coords.lng,
        });
        setHousehold(targetHousehold);
      } catch {
        // Continuar con el hogar existente si falla la actualización
      }
    }

    if (!targetHousehold) {
      setError("No se encontró una dirección de vivienda para la solicitud.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const request = await serviceRequestService.create(
        {
          household: targetHousehold.id,
          selected_service: service.id,
          professional: professional.id,
          description: description.trim(),
          urgency,
        },
        selectedImages.map((image) => image.file)
      );
      const trackingTargetId = request.order?.id || request.id;
      setCreatedRequestId(request.id);
      setCreatedOrderId(trackingTargetId);
      setToast(`¡Solicitud enviada a ${professional.display_name}! Redirigiendo a la ruta en vivo...`);
      setTimeout(() => {
        history.push(`/seguimiento/${trackingTargetId}`);
      }, 1200);
    } catch (err: unknown) {
      console.error("Error al crear solicitud:", err);
      const isApi =
        err instanceof ApiError ||
        (typeof err === "object" && err !== null && "status" in err);
      if (isApi) {
        const apiErr = err as ApiError;
        setError(apiErr.message || "Error al procesar la solicitud con el servidor.");
      } else {
        setError("No pudimos enviar la solicitud. Revisa los datos e inténtalo otra vez.");
      }
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
        <main className="sp-request-page-wrapper">
          {loading ? (
            <div className="sp-route-loading" style={{ padding: "4rem 0", textAlign: "center" }}>
              <IonSpinner name="crescent" />
              <p style={{ marginTop: "1rem", color: "#64748b" }}>Cargando datos del profesional...</p>
            </div>
          ) : error && !professional ? (
            <section className="sp-request-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
              <p className="sp-error" style={{ marginBottom: "1.5rem" }}>{error}</p>
              <IonButton routerLink="/cliente/servicios" fill="outline">
                <IonIcon slot="start" icon={arrowBackOutline} />
                Volver a servicios
              </IonButton>
            </section>
          ) : professional ? (
            <>
              {/* Tarjeta Hero del Profesional */}
              <div className="sp-detail-header-card">
                <div className="sp-pro-hero">
                  <div className="sp-pro-avatar-container">
                    {professional.avatar_url ? (
                      <img
                        src={professional.avatar_url}
                        alt={professional.display_name}
                        className="sp-pro-avatar-img"
                      />
                    ) : (
                      professional.initials
                    )}
                  </div>
                  <div className="sp-pro-hero-info">
                    <span className="sp-pro-kicker-badge">
                      <IonIcon icon={constructOutline} /> Solicitud Directa
                    </span>
                    <h1 className="sp-pro-hero-name">{professional.display_name}</h1>
                    <p className="sp-pro-hero-headline">{professional.headline || "Profesional certificado en Serviprox"}</p>
                    <div className="sp-pro-meta-pills">
                      <span className="sp-pro-meta-pill star">
                        <IonIcon icon={star} /> {Number(professional.rating_avg) > 0 ? Number(professional.rating_avg).toFixed(1) : "5.0"}
                      </span>
                      {professional.is_verified && (
                        <span className="sp-pro-meta-pill verified">
                          <IonIcon icon={shieldCheckmarkOutline} /> Verificado
                        </span>
                      )}
                      <span className="sp-pro-meta-pill">
                        {professional.jobs_completed} trabajos completados
                      </span>
                      <span className="sp-pro-meta-pill">
                        <IonIcon icon={timeOutline} /> {professional.response_time_minutes} min respuesta
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra de Resumen: Servicio Seleccionado & Ubicación de Obra */}
              <div className="sp-summary-ribbon">
                <div className="sp-summary-item">
                  <div className="sp-summary-icon service-icon">
                    <IonIcon icon={constructOutline} />
                  </div>
                  <div className="sp-summary-text">
                    <h3>{service?.name || "Servicio seleccionado"}</h3>
                    <p>{selectedOffering?.observaciones || "Tarifa estimada según diagnóstico inicial"}</p>
                    {selectedOffering && (
                      <span className="sp-summary-price-tag">
                        {formatServicePrice(selectedOffering)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="sp-summary-item">
                  <div className="sp-summary-icon home-icon">
                    <IonIcon icon={locationOutline} />
                  </div>
                  <div className="sp-summary-text">
                    <h3>{household?.label || "Lugar del servicio"}</h3>
                    <p>{household?.address_line || user?.address || "Bogotá, Colombia"}</p>
                    <span style={{ fontSize: "0.78rem", color: "#16a34a", fontWeight: "600" }}>
                      📍 {household?.neighborhood || household?.city || "Zona urbana"}
                    </span>
                  </div>
                </div>

                <div className="sp-summary-item">
                  <div className="sp-summary-icon time-icon">
                    <IonIcon icon={timeOutline} />
                  </div>
                  <div className="sp-summary-text">
                    <h3>Demora estimada: ~{calculatedTravel.travelMinutes} min</h3>
                    <p>Llegada aproximada hacia las {calculatedTravel.arrivalTimeStr}</p>
                    <span style={{ fontSize: "0.78rem", color: "#ca8a04", fontWeight: "700" }}>
                      🚗 {calculatedTravel.roadDistKm} km de recorrido urbano
                    </span>
                  </div>
                </div>
              </div>

              {/* Formulario Principal de Solicitud */}
              <section className="sp-request-card">
                <div className="sp-request-card-header">
                  <div className="sp-request-header-icon">
                    <IonIcon icon={paperPlaneOutline} />
                  </div>
                  <div className="sp-request-card-title">
                    <h2>Detalles de tu solicitud</h2>
                    <p>Cuéntale al profesional el problema para preparar la visita.</p>
                  </div>
                </div>

                {createdRequestId ? (
                  <div className="sp-success-banner">
                    <IonIcon icon={checkmarkCircleOutline} className="sp-success-icon" />
                    <h3>¡Solicitud enviada a {professional.display_name}!</h3>
                    <p>
                      Tu solicitud <strong>#{createdRequestId}</strong> ha sido registrada.
                      El profesional ya tiene los datos del servicio y puedes seguir su ruta hacia tu ubicación en vivo.
                    </p>
                    <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "1rem" }}>
                      <IonButton
                        type="button"
                        onClick={() => history.push(`/seguimiento/${createdOrderId || createdRequestId}`)}
                        className="sp-btn-submit"
                        style={{ minWidth: "250px" }}
                      >
                        <IonIcon slot="start" icon={navigateOutline} />
                        Ver ruta donde va {professional.display_name}
                      </IonButton>
                      <IonButton
                        type="button"
                        onClick={() => history.replace("/cliente/solicitudes")}
                        className="sp-btn-cancel"
                      >
                        <IonIcon slot="start" icon={briefcaseOutline} />
                        Ver mis solicitudes
                      </IonButton>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submitRequest}>
                    {/* Campo 1: Descripción del problema */}
                    <div className="sp-form-group">
                      <div className="sp-form-label">
                        <span>¿Qué necesitas reparar o realizar?</span>
                        <span className={`sp-char-counter ${description.trim().length >= 8 ? "valid" : ""}`}>
                          {description.trim().length} / 600 caracteres (mínimo 8)
                        </span>
                      </div>
                      <div className="sp-textarea-wrapper">
                        <textarea
                          className="sp-textarea-custom"
                          value={description}
                          rows={4}
                          maxLength={600}
                          disabled={sending}
                          placeholder="Describe brevemente qué ocurre (ej: tengo una fuga de agua en la tubería del lavamanos, gotea continuamente y requiere cambio de sellos)..."
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                      <div className="sp-quick-tags">
                        <span className="sp-quick-tag-label">Ideas rápidas:</span>
                        {ideasrapi.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            className="sp-quick-tag-btn"
                            onClick={() => setDescription((prev) => (prev ? `${prev}. ${sug}` : sug))}
                          >
                            + {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Campo 2: Nivel de Urgencia en Tarjetas Interactivas */}
                    <div className="sp-form-group">
                      <div className="sp-form-label">
                        <span>¿Con qué urgencia requieres el servicio?</span>
                      </div>
                      <div className="sp-urgency-grid">
                        {urgencyOptions.map((opt) => {
                          const isSelected = urgency === opt.value;
                          return (
                            <div
                              key={opt.value}
                              className={`sp-urgency-card ${isSelected ? "selected" : ""} ${opt.isUrgent && isSelected ? "urgent" : ""}`}
                              onClick={() => !sending && setUrgency(opt.value)}
                            >
                              <div className="sp-urgency-icon-box">
                                <IonIcon icon={opt.icon} />
                              </div>
                              <div className="sp-urgency-text">
                                <strong>{opt.title}</strong>
                                <span>{opt.subtitle}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Campo: Ubicación de tu vivienda (dirección del servicio) */}
                    <div className="sp-form-group">
                      <div className="sp-form-label">
                        <span>Ubicación de tu vivienda (dirección del servicio)</span>
                        <span className="sp-char-counter valid">📍 Destino del profesional</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px" }}>
                        <input
                          type="text"
                          className="sp-address-field-custom"
                          placeholder="Ej: Calle 72 # 10-34, Apto 402"
                          value={addressLine}
                          onChange={(e) => setAddressLine(e.target.value)}
                          disabled={sending}
                          required
                        />
                        <input
                          type="text"
                          className="sp-address-field-custom"
                          placeholder="Barrio (ej: Chapinero)"
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          disabled={sending}
                        />
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "4px", display: "block" }}>
                        Esta es la dirección de destino registrada para que el profesional llegue exactamente a tu vivienda.
                      </span>
                    </div>

                    {/* Campo 3: Adjuntar Fotos / Evidencia con Dropzone Estilizada */}
                    <div className="sp-form-group">
                      <div className="sp-form-label">
                        <span>Fotos o evidencia del problema (opcional)</span>
                        <span className="sp-char-counter">
                          {selectedImages.length} {selectedImages.length === 1 ? "foto adjunta" : "fotos adjuntas"}
                        </span>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        disabled={sending}
                        onChange={addImages}
                        aria-label="Seleccionar fotos"
                      />

                      <div
                        className="sp-upload-dropzone"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="sp-upload-icon-circle">
                          <IonIcon icon={cameraOutline} />
                        </div>
                        <strong>Toca aquí para seleccionar fotos o usar la cámara</strong>
                        <span>Puedes adjuntar varias imágenes para que el profesional valore mejor el trabajo.</span>
                      </div>

                      {selectedImages.length > 0 && (
                        <div className="sp-preview-gallery">
                          {selectedImages.map((image) => (
                            <div className="sp-preview-card" key={image.id}>
                              <img src={image.previewUrl} alt="Vista previa" />
                              <button
                                type="button"
                                className="sp-preview-remove-btn"
                                onClick={() => removeImage(image.id)}
                                disabled={sending}
                                title="Eliminar foto"
                              >
                                <IonIcon icon={closeCircleOutline} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {error && (
                      <div className="sp-alert-danger" style={{ color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", margin: "1rem 0" }}>
                        {error}
                      </div>
                    )}

                    {/* Botones de Acción */}
                    <div className="sp-request-actions">
                      <button
                        type="submit"
                        className="sp-btn-submit"
                        disabled={!canSubmit}
                      >
                        {sending ? (
                          <>
                            <IonSpinner name="crescent" style={{ width: "20px", height: "20px" }} />
                            <span>Enviando solicitud...</span>
                          </>
                        ) : (
                          <>
                            <IonIcon icon={paperPlaneOutline} style={{ fontSize: "1.2rem" }} />
                            <span>Enviar solicitud a {professional.display_name.split(" ")[0]}</span>
                          </>
                        )}
                      </button>

                      <a href="/cliente/servicios" className="sp-btn-cancel">
                        <IonIcon icon={arrowBackOutline} />
                        <span>Ver otros profesionales</span>
                      </a>
                    </div>
                  </form>
                )}
              </section>
            </>
          ) : null}
        </main>

        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={2500}
          color="success"
          onDidDismiss={() => setToast("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default ClientProfessionalDetail;
