import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import {
  checkmarkCircle,
  closeOutline,
  constructOutline,
  locationOutline,
  paperPlaneOutline,
  shieldCheckmarkOutline,
  star,
  timeOutline,
  homeOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  catalogService,
  householdService,
  professionalSearchService,
  serviceRequestService,
} from "../../services/serviprox";
import type {
  Household,
  Professional,
  Service,
  ServiceCategory,
  ServiceRequestUrgency,
} from "../../types/serviprox";
import "./TomarServicioModal.css";

interface TomarServicioModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: ServiceCategory | null;
  initialProfessional?: Professional | null;
  initialDescription?: string;
  initialUrgency?: ServiceRequestUrgency;
  onSuccess?: (orderId: string | number) => void;
}

export const TomarServicioModal: React.FC<TomarServicioModalProps> = ({
  isOpen,
  onClose,
  category,
  initialProfessional,
  initialDescription,
  initialUrgency,
  onSuccess,
}) => {
  const history = useHistory();
  const { user, isAuthenticated, login } = useAuth();

  // Datos de la vivienda (Dirección en Bogotá)
  const [addressLine, setAddressLine] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");
  const [households, setHouseholds] = useState<Household[]>([]);

  // Servicios de la categoría
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [loadingServices, setLoadingServices] = useState(false);

  // Profesionales de la categoría y seleccionado
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professional, setProfessional] = useState<Professional | null>(initialProfessional || null);

  // Formulario de solicitud
  const [description, setDescription] = useState(initialDescription || "");
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>(initialUrgency || "this_week");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Cargar datos cuando se abre el modal y cambia la categoría
  useEffect(() => {
    if (!isOpen || !category) return;

    setError("");
    setDescription(initialDescription || "");
    setUrgency(initialUrgency || "this_week");

    // 1. Cargar dirección de viviendas del cliente
    if (isAuthenticated) {
      householdService
        .list()
        .then((list) => {
          setHouseholds(list);
          if (list.length > 0) {
            const def = list.find((h) => h.is_default) || list[0];
            setAddressLine(def.address_line || user?.address || "Cra. 11 # 85-32");
            setNeighborhood(def.neighborhood || "Chicó, Bogotá");
            setNotes(def.notes || "");
          } else if (user?.address) {
            setAddressLine(user.address);
            setNeighborhood(user.city || "Bogotá");
          } else {
            setAddressLine("Cra. 11 # 85-32");
            setNeighborhood("Chicó, Bogotá");
          }
        })
        .catch(() => {
          setAddressLine(user?.address || "Cra. 11 # 85-32");
          setNeighborhood(user?.city || "Chicó, Bogotá");
        });
    } else {
      setAddressLine("Cra. 11 # 85-32, Apto 501");
      setNeighborhood("Chicó, Bogotá");
      setNotes("Conjunto Residencial Chicó");
    }

    // 2. Cargar servicios específicos para la categoría
    setLoadingServices(true);
    catalogService
      .listServices({ category: category.id })
      .then((servList) => {
        setServices(servList);
        if (servList.length > 0) {
          setSelectedServiceId(servList[0].id);
        } else {
          setSelectedServiceId(null);
        }
      })
      .catch((err) => {
        console.warn("Error cargando servicios de categoría:", err);
      })
      .finally(() => {
        setLoadingServices(false);
      });

    // 3. Cargar profesionales de la categoría
    professionalSearchService
      .list({ category: category.slug })
      .then((proList) => {
        setProfessionals(proList);
        if (initialProfessional) {
          setProfessional(initialProfessional);
        } else if (proList.length > 0) {
          setProfessional(proList[0]);
        } else {
          setProfessional(null);
        }
      })
      .catch((err) => {
        console.warn("Error buscando profesional:", err);
      });
  }, [isOpen, category, initialProfessional, isAuthenticated, user]);

  // Login rápido de demostración
  const handleQuickDemoLogin = async () => {
    try {
      await login({
        email: "laura.gomez@bogota.co",
        password: "serviprox2026",
      });
      setToastMessage("¡Sesión iniciada como Laura Gómez (Cliente Demo)!");
    } catch {
      setError("No se pudo iniciar sesión demo. Intenta desde la página de inicio.");
    }
  };

  // Enviar y tomar el servicio confirmando dirección
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    if (!addressLine.trim() || addressLine.trim().length < 5) {
      setError("Por favor ingresa una dirección válida para la visita del profesional.");
      return;
    }

    if (!description.trim() || description.trim().length < 5) {
      setError("Por favor escribe una breve descripción de lo que necesitas realizar.");
      return;
    }

    if (!isAuthenticated) {
      setError("Debes iniciar sesión para confirmar la dirección y crear tu orden de servicio.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // 1. Obtener o crear vivienda con la dirección confirmada
      let targetHousehold: Household | null = null;
      if (households.length > 0) {
        targetHousehold = households[0];
        // Si el usuario modificó la dirección, la actualizamos
        if (
          addressLine.trim() !== targetHousehold.address_line ||
          neighborhood.trim() !== targetHousehold.neighborhood
        ) {
          try {
            targetHousehold = await householdService.update(targetHousehold.id, {
              address_line: addressLine.trim(),
              neighborhood: neighborhood.trim() || "Bogotá",
              notes: notes.trim(),
            });
          } catch {
            // Continuar con el hogar existente
          }
        }
      } else {
        // Crear nuevo hogar para el cliente
        targetHousehold = await householdService.create({
          label: "Mi hogar",
          property_type: "apartment",
          address_line: addressLine.trim(),
          neighborhood: neighborhood.trim() || "Bogotá",
          city: "Bogotá",
          country: "Colombia",
          area_m2: null,
          build_year: null,
          notes: notes.trim(),
          is_default: true,
        });
      }

      // 2. Determinar servicio
      let serviceId = selectedServiceId;
      if (!serviceId && services.length > 0) {
        serviceId = services[0].id;
      }
      if (!serviceId) {
        // Si la categoría no tiene servicios precargados, usar id 1 por defecto
        serviceId = 1;
      }

      // 3. Determinar profesional
      const proId = professional?.id || 1; // 1 = Andre Ruiz o primer profesional

      // 4. Crear la solicitud en la base de datos
      const req = await serviceRequestService.create({
        household: targetHousehold.id,
        selected_service: serviceId,
        professional: proId,
        description: description.trim(),
        urgency,
      });

      const orderId = req.order?.id || req.id;
      setToastMessage(`¡Servicio tomado con éxito! Dirección confirmada: ${addressLine}`);

      onClose();

      if (onSuccess) {
        onSuccess(orderId);
      } else {
        setTimeout(() => {
          history.push(`/seguimiento/${orderId}`);
        }, 1000);
      }
    } catch (err: unknown) {
      console.error("Error al tomar el servicio:", err);
      setError("No pudimos registrar la solicitud. Revisa los datos e intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!category) return null;

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose} className="sp-service-modal">
        <IonHeader>
          <IonToolbar className="sp-service-modal-header">
            <IonTitle>Tomar servicio: {category.name}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={onClose} fill="clear">
                <IonIcon slot="icon-only" icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent fullscreen className="sp-service-modal-content">
          <div className="sp-service-modal-body">
            {/* Banner de Bienvenida */}
            <div className="sp-modal-banner">
              <div className="sp-modal-banner-icon">
                <IonIcon icon={constructOutline} />
              </div>
              <div className="sp-modal-banner-text">
                <h3>{category.name} a domicilio</h3>
                <p>Confirma la dirección exacta en Bogotá y los detalles para la visita del profesional.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Sección 1: Confirmar Dirección */}
              <div className="sp-modal-section">
                <h4 className="sp-modal-section-title">
                  <IonIcon icon={locationOutline} />
                  <span>1. Confirma la dirección de tu vivienda (Bogotá)</span>
                </h4>

                <div className="sp-modal-field">
                  <label htmlFor="addressLine">Dirección exacta en Bogotá *</label>
                  <input
                    id="addressLine"
                    type="text"
                    required
                    placeholder="Ej: Calle 72 # 10-34, Apto 402"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                  />
                  <small>📍 Dirección de destino donde acudirá el contratista.</small>
                </div>

                <div className="sp-modal-fields-grid">
                  <div className="sp-modal-field">
                    <label htmlFor="neighborhood">Barrio o Localidad *</label>
                    <input
                      id="neighborhood"
                      type="text"
                      required
                      placeholder="Ej: Chapinero, Usaquén, Suba..."
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                    />
                  </div>

                  <div className="sp-modal-field">
                    <label htmlFor="notes">Torre / Apto / Notas</label>
                    <input
                      id="notes"
                      type="text"
                      placeholder="Ej: Torre 2 Apto 402"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Tipo de Servicio Disponible */}
              <div className="sp-modal-section">
                <h4 className="sp-modal-section-title">
                  <IonIcon icon={constructOutline} />
                  <span>2. Servicios disponibles en {category.name}</span>
                </h4>

                <div className="sp-modal-field">
                  <label>Selecciona el servicio disponible que requieres *</label>
                  {loadingServices ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px" }}>
                      <IonSpinner name="crescent" style={{ width: "20px", height: "20px" }} />
                      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Cargando catálogo...</span>
                    </div>
                  ) : services.length > 0 ? (
                    <div className="sp-modal-services-list">
                      {services.map((svc) => {
                        const isSelected = selectedServiceId === svc.id;
                        return (
                          <div
                            key={svc.id}
                            className={`sp-modal-service-pill ${isSelected ? "selected" : ""}`}
                            onClick={() => setSelectedServiceId(svc.id)}
                          >
                            <div className="sp-modal-service-icon">
                              <IonIcon icon={constructOutline} />
                            </div>
                            <div className="sp-modal-service-pill-info">
                              <strong>{svc.name}</strong>
                              <span>{svc.description || `Servicio profesional calificado en ${category.name}`}</span>
                              {svc.price_min && (
                                <span style={{ color: "#0B2F6B", fontWeight: 700, marginTop: "3px" }}>
                                  Tarifa sugerida: ${Number(svc.price_min).toLocaleString()} COP
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <IonIcon icon={checkmarkCircle} className="sp-modal-service-check" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={`Servicio general de ${category.name}`}
                    />
                  )}
                </div>

                <div className="sp-modal-field">
                  <label htmlFor="description">¿Qué necesitas reparar o realizar? *</label>
                  <textarea
                    id="description"
                    rows={3}
                    required
                    placeholder="Describe qué ocurre (ej: tengo una fuga continua en la llave del lavamanos, requiere cambio de sellos)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <div className="sp-modal-quick-tags">
                    <span style={{ fontSize: "0.78rem", color: "#64748b", marginRight: "4px" }}>Sugerencias:</span>
                    {[
                      "Fuga de agua",
                      "Reparación urgente",
                      "Instalación nueva",
                      "Revisión y diagnóstico",
                      "Mantenimiento preventivo",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="sp-modal-quick-tag"
                        onClick={() =>
                          setDescription((prev) => (prev ? `${prev}. ${tag}` : tag))
                        }
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sección 3: Urgencia */}
              <div className="sp-modal-section">
                <h4 className="sp-modal-section-title">
                  <IonIcon icon={timeOutline} />
                  <span>3. ¿Con qué urgencia lo requieres?</span>
                </h4>

                <div className="sp-modal-urgency-row">
                  <div
                    className={`sp-modal-urgency-card ${urgency === "flexible" ? "selected" : ""}`}
                    onClick={() => setUrgency("flexible")}
                  >
                    <strong>🟢 Flexible</strong>
                    <span>En próximos días</span>
                  </div>
                  <div
                    className={`sp-modal-urgency-card ${urgency === "this_week" ? "selected" : ""}`}
                    onClick={() => setUrgency("this_week")}
                  >
                    <strong>🟡 Esta semana</strong>
                    <span>Atención normal</span>
                  </div>
                  <div
                    className={`sp-modal-urgency-card urgent ${urgency === "urgent" ? "selected" : ""}`}
                    onClick={() => setUrgency("urgent")}
                  >
                    <strong>🔴 Urgente</strong>
                    <span>Hoy mismo</span>
                  </div>
                </div>
              </div>

              {/* Sección 4: Carrusel de Profesionales Disponibles */}
              <div className="sp-modal-section">
                <h4 className="sp-modal-section-title">
                  <IonIcon icon={shieldCheckmarkOutline} />
                  <span>4. Carrusel de profesionales disponibles ({professionals.length})</span>
                </h4>
                <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "-6px 0 12px" }}>
                  Desliza en el carrusel y selecciona el profesional con el que deseas tomar el servicio:
                </p>

                {professionals.length > 0 ? (
                  <div className="sp-modal-pro-carousel-wrapper">
                    <div className="sp-modal-pro-carousel">
                      {professionals.map((pro) => {
                        const isSelected = professional?.id === pro.id;
                        return (
                          <div
                            key={pro.id}
                            className={`sp-modal-pro-card-item ${isSelected ? "selected" : ""}`}
                            onClick={() => setProfessional(pro)}
                          >
                            <div className="sp-modal-pro-top">
                              <div className="sp-modal-pro-avatar">
                                {pro.avatar_url ? (
                                  <img src={pro.avatar_url} alt={pro.display_name} />
                                ) : (
                                  pro.initials || "PRO"
                                )}
                              </div>
                              <div className="sp-modal-pro-title-wrap">
                                <h4 className="sp-modal-pro-name">{pro.display_name}</h4>
                                <p className="sp-modal-pro-headline">{pro.headline || `Especialista en ${category.name}`}</p>
                              </div>
                            </div>

                            <div className="sp-modal-pro-meta-bar">
                              <div className="sp-modal-pro-rating-tag">
                                <IonIcon icon={star} />
                                <span>{pro.rating_avg || "4.9"}</span>
                                <span style={{ color: "#94a3b8", fontWeight: 400 }}>({pro.jobs_completed || 12})</span>
                              </div>
                              <span className="sp-modal-pro-verified">✓ Verificado</span>
                            </div>

                            <div className="sp-modal-pro-select-btn">
                              {isSelected ? "✓ Profesional seleccionado" : "Escoger profesional"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="sp-modal-pro-card">
                    <div className="sp-modal-pro-avatar">PRO</div>
                    <div className="sp-modal-pro-info">
                      <h4>Profesional asignado por Serviprox</h4>
                      <p>Asignaremos el contratista más cercano y mejor calificado en {category.name}</p>
                    </div>
                  </div>
                )}

                {professional && (
                  <div style={{ marginTop: "12px", padding: "10px 14px", background: "rgba(11, 47, 107, 0.06)", borderRadius: "10px", display: "flex", alignItems: "center", gap: "10px", border: "1px solid rgba(11, 47, 107, 0.15)" }}>
                    <IonIcon icon={checkmarkCircle} style={{ color: "#0B2F6B", fontSize: "22px", flexShrink: 0 }} />
                    <span style={{ fontSize: "0.88rem", color: "#0f172a" }}>
                      Tomarás el servicio con: <strong>{professional.display_name}</strong> ({professional.headline || category.name})
                    </span>
                  </div>
                )}
              </div>

              {/* Errores */}
              {error && <div className="sp-modal-error-box">{error}</div>}

              {/* Acciones y Autenticación */}
              <div className="sp-modal-actions">
                {!isAuthenticated ? (
                  <>
                    <div style={{ textAlign: "center", padding: "8px 0", color: "#64748b", fontSize: "0.88rem" }}>
                      Para confirmar la orden en la base de datos se requiere cuenta de cliente.
                    </div>
                    <IonButton
                      expand="block"
                      className="sp-btn-demo-quick-login"
                      onClick={handleQuickDemoLogin}
                    >
                      <IonIcon slot="start" icon={homeOutline} />
                      Acceder con Cliente Demo (Laura Gómez)
                    </IonButton>
                  </>
                ) : null}

                <IonButton
                  type="submit"
                  expand="block"
                  className="sp-btn-confirm-submit"
                  disabled={submitting || !addressLine.trim()}
                >
                  {submitting ? (
                    <>
                      <IonSpinner name="crescent" style={{ width: "20px", height: "20px", marginRight: "8px" }} />
                      <span>Confirmando servicio en base de datos...</span>
                    </>
                  ) : (
                    <>
                      <IonIcon slot="start" icon={paperPlaneOutline} />
                      <span>
                        Confirmar dirección y tomar servicio
                        {professional?.display_name ? ` con ${professional.display_name}` : ""}
                      </span>
                    </>
                  )}
                </IonButton>
              </div>
            </form>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={!!toastMessage}
        message={toastMessage}
        duration={3000}
        color="success"
        onDidDismiss={() => setToastMessage("")}
      />
    </>
  );
};

export default TomarServicioModal;
