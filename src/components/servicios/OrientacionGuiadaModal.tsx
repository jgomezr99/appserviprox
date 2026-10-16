import React, { useEffect, useRef, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { checkmarkCircle, closeOutline, constructOutline, searchOutline } from "ionicons/icons";
import { catalogService, diagnosisService } from "../../services/serviprox";
import type {
  DiagnosticSession,
  Service,
  ServiceCategory,
  ServiceRequestUrgency,
} from "../../types/serviprox";
import "./OrientacionGuiadaModal.css";

interface OrientacionGuiadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ServiceCategory[];
  onTakeService: (params: {
    category: ServiceCategory;
    serviceId: number;
    diagnosticSessionId: number;
    description: string;
    urgency: ServiceRequestUrgency;
  }) => void;
}

export const OrientacionGuiadaModal: React.FC<OrientacionGuiadaModalProps> = ({
  isOpen,
  onClose,
  categories,
  onTakeService,
}) => {
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<ServiceRequestUrgency>("this_week");
  const [diagnosis, setDiagnosis] = useState<DiagnosticSession | null>(null);
  const [categoryServices, setCategoryServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchGeneration = useRef(0);
  const resultsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    searchGeneration.current += 1;
    if (!isOpen) return;
    setDescription("");
    setUrgency("this_week");
    setDiagnosis(null);
    setCategoryServices([]);
    setSelectedServiceId(null);
    setLoading(false);
    setError("");
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && diagnosis && !loading) {
      resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [isOpen, diagnosis, loading]);

  const handleSearch = async () => {
    const query = description.trim();
    if (query.length < 5) {
      setError("Describe el problema con al menos 5 caracteres.");
      return;
    }

    setLoading(true);
    setError("");
    setDiagnosis(null);
    setCategoryServices([]);
    setSelectedServiceId(null);
    const generation = ++searchGeneration.current;

    try {
      const result = await diagnosisService.create(query);
      if (generation !== searchGeneration.current) return;
      setDiagnosis(result);
      if (!result.service_ranking.length && result.suggested_category) {
        try {
          const services = await catalogService.listServices({
            category: result.suggested_category.id,
          });
          if (generation === searchGeneration.current) setCategoryServices(services);
        } catch {
          if (generation === searchGeneration.current) {
            setError("Encontramos una categoría, pero no pudimos cargar sus servicios.");
          }
        }
      }
    } catch {
      if (generation === searchGeneration.current) {
        setError("No pudimos consultar las sugerencias. Verifica tu conexión e inténtalo de nuevo.");
      }
    } finally {
      if (generation === searchGeneration.current) setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!diagnosis || selectedServiceId === null) return;
    const serviceSuggestion = diagnosis.service_ranking.find(
      (item) => item.id === selectedServiceId
    );
    const category = serviceSuggestion
      ? categories.find((item) => item.id === serviceSuggestion.category.id)
      : categories.find((item) => item.id === diagnosis.suggested_category?.id);

    if (!category) {
      setError("La categoría sugerida ya no está disponible. Vuelve a buscar el servicio.");
      return;
    }

    onTakeService({
      category,
      serviceId: selectedServiceId,
      diagnosticSessionId: diagnosis.id,
      description: description.trim(),
      urgency,
    });
    onClose();
  };

  const hasServiceResults =
    (diagnosis?.service_ranking.length || 0) > 0 || categoryServices.length > 0;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="sp-diag-modal">
      <IonHeader>
        <IonToolbar className="sp-diag-modal-header">
          <IonTitle>Encuentra el servicio adecuado</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} fill="clear" aria-label="Cerrar">
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-diag-modal-content">
        <div className="sp-diag-modal-body">
          <div className="sp-diag-banner">
            <div className="sp-diag-banner-icon">
              <IonIcon icon={searchOutline} />
            </div>
            <div className="sp-diag-banner-text">
              <h3>Cuéntanos qué necesitas resolver</h3>
              <p>
                Buscaremos servicios activos del catálogo relacionados con tu problema. La
                sugerencia es orientativa y tú eliges cómo continuar.
              </p>
            </div>
          </div>

          <section className="sp-diag-section-card">
            <h4 className="sp-diag-section-title">
              <IonIcon icon={searchOutline} />
              <span>Describe tu necesidad</span>
            </h4>
            <textarea
              rows={4}
              maxLength={1000}
              disabled={loading}
              aria-label="Descripción del problema"
              placeholder="Ej.: Tengo una fuga debajo del lavaplatos y necesito reparar la tubería."
              value={description}
              onChange={(event) => {
                searchGeneration.current += 1;
                setDescription(event.target.value);
                setDiagnosis(null);
                setCategoryServices([]);
                setSelectedServiceId(null);
                setError("");
              }}
              style={{
                boxSizing: "border-box",
                width: "100%",
                padding: "12px",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                font: "inherit",
                resize: "vertical",
              }}
            />
            <IonButton
              expand="block"
              onClick={handleSearch}
              disabled={loading || description.trim().length < 5}
              style={{ marginTop: "12px" }}
            >
              {loading ? (
                <>
                  <IonSpinner name="crescent" style={{ marginRight: "8px" }} />
                  Buscando en el catálogo...
                </>
              ) : (
                <>
                  <IonIcon slot="start" icon={searchOutline} />
                  Buscar sugerencias
                </>
              )}
            </IonButton>
            {error && (
              <p role="alert" style={{ color: "#b91c1c", marginBottom: 0 }}>
                {error}
              </p>
            )}
          </section>

          {diagnosis && (
            <section ref={resultsRef} className="sp-diag-result-box" aria-label="Resultado de la búsqueda" aria-live="polite">
              <div className="sp-diag-result-header">
                <span className="sp-diag-result-badge">
                  <IonIcon icon={checkmarkCircle} /> Sugerencia del catálogo
                </span>
              </div>
              <h3 className="sp-diag-result-category">
                {diagnosis.suggested_category?.name || "Sin categoría definida"}
              </h3>
              <p className="sp-diag-result-desc">
                {diagnosis.rationale || "Elige una de las opciones para continuar."}
              </p>

              {diagnosis.service_ranking.length > 0 ? (
                <div className="sp-diag-suggestions">
                  {diagnosis.service_ranking.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion.id}
                      className={`sp-diag-suggestion ${selectedServiceId === suggestion.id ? "selected" : ""}`}
                      onClick={() => setSelectedServiceId(suggestion.id)}
                    >
                      <span>
                        <strong>{suggestion.name}</strong>
                        <small>{suggestion.category.name}</small>
                        {suggestion.matched_terms.length > 0 && (
                          <small>Coincidencias: {suggestion.matched_terms.join(", ")}</small>
                        )}
                      </span>
                      {selectedServiceId === suggestion.id && (
                        <IonIcon icon={checkmarkCircle} aria-label="Seleccionado" />
                      )}
                    </button>
                  ))}
                </div>
              ) : categoryServices.length > 0 ? (
                <>
                  <p className="sp-diag-result-desc">
                    No encontramos un servicio específico, pero puedes elegir uno de esta categoría:
                  </p>
                  <div className="sp-diag-suggestions">
                    {categoryServices.map((service) => (
                      <button
                        type="button"
                        key={service.id}
                        className={`sp-diag-suggestion ${selectedServiceId === service.id ? "selected" : ""}`}
                        onClick={() => setSelectedServiceId(service.id)}
                      >
                        <span>
                          <strong>{service.name}</strong>
                          {service.description && <small>{service.description}</small>}
                        </span>
                        {selectedServiceId === service.id && (
                          <IonIcon icon={checkmarkCircle} aria-label="Seleccionado" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="sp-diag-result-desc">
                  No encontramos servicios relacionados. Intenta describirlo con otras palabras o
                  elige directamente una categoría.
                </p>
              )}

              {hasServiceResults && (
                <>
                  <label
                    htmlFor="oriented-search-urgency"
                    style={{ display: "block", marginTop: "16px", fontWeight: 600 }}
                  >
                    Urgencia
                  </label>
                  <select
                    id="oriented-search-urgency"
                    value={urgency}
                    onChange={(event) =>
                      setUrgency(event.target.value as ServiceRequestUrgency)
                    }
                    style={{
                      width: "100%",
                      padding: "10px",
                      marginTop: "6px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                    }}
                  >
                    <option value="flexible">Puedo esperar</option>
                    <option value="this_week">Esta semana</option>
                    <option value="urgent">Urgente</option>
                  </select>
                  <IonButton
                    expand="block"
                    onClick={handleContinue}
                    disabled={selectedServiceId === null}
                    style={{ marginTop: "12px" }}
                  >
                    <IonIcon slot="start" icon={constructOutline} />
                    Continuar con el servicio seleccionado
                  </IonButton>
                </>
              )}
            </section>
          )}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default OrientacionGuiadaModal;
