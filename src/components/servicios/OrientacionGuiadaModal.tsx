import React, { useMemo, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  checkmarkCircle,
  closeOutline,
  constructOutline,
  flashOutline,
  helpCircleOutline,
  keyOutline,
  sparklesOutline,
  star,
  waterOutline,
} from "ionicons/icons";
import type { Professional, ServiceCategory, ServiceRequestUrgency } from "../../types/serviprox";
import "./OrientacionGuiadaModal.css";

interface DiagnosisPreset {
  id: string;
  icon: string;
  emoji: string;
  title: string;
  description: string;
  categorySlug: string;
  defaultText: string;
  urgency: ServiceRequestUrgency;
  advice: string;
}

const PRESETS: DiagnosisPreset[] = [
  {
    id: "plomeria",
    icon: waterOutline,
    emoji: "🚰",
    title: "Agua, fugas o desagües",
    description: "Goteras, tubería rota, sanitario tapado o baja presión de agua",
    categorySlug: "plomeria",
    defaultText: "Fuga continua en tubería o grifería, requiere revisión y cambio de empaques.",
    urgency: "urgent",
    advice: "Cierra la llave de paso principal si hay escape constante mientras acude el especialista.",
  },
  {
    id: "electricidad",
    icon: flashOutline,
    emoji: "⚡",
    title: "Electricidad & tomas",
    description: "Breaker saltado, tomas sin energía, cortocircuitos o chispas",
    categorySlug: "electricidad",
    defaultText: "Falla eléctrica en tomas o circuito residencial, se dispara el disyuntor.",
    urgency: "urgent",
    advice: "Evita manipular cables húmedos y no sobrecargues los circuitos hasta la revisión técnica.",
  },
  {
    id: "cerrajeria",
    icon: keyOutline,
    emoji: "🔑",
    title: "Cerraduras & puertas",
    description: "Llave partida, chapa atascada, cambio de combinación o apertura",
    categorySlug: "cerrajeria",
    defaultText: "Cerradura de seguridad trabada o llave rota, se requiere apertura o cambio de cilindro.",
    urgency: "urgent",
    advice: "No fuerces la chapa con herramientas inadecuadas para evitar dañar la estructura de la puerta.",
  },
  {
    id: "albanileria",
    icon: constructOutline,
    emoji: "🧱",
    title: "Humedad, grietas & pisos",
    description: "Fisuras en muros, filtraciones en techos o desprendimiento de baldosas",
    categorySlug: "albanileria",
    defaultText: "Filtración visible en pared/techo con desprendimiento de estuco y pintura.",
    urgency: "this_week",
    advice: "Permite inspección previa para evaluar si la humedad proviene de tubería interna o fachada.",
  },
  {
    id: "carpinteria",
    icon: constructOutline,
    emoji: "🪚",
    title: "Muebles & carpintería",
    description: "Puertas caídas, bisagras sueltas, ajuste de closets o gabinetes",
    categorySlug: "carpinteria",
    defaultText: "Desajuste en puertas de madera y bisagras de muebles de cocina/closet.",
    urgency: "flexible",
    advice: "Un carpintero residencial ajustará rieles y tornillería sin necesidad de cambiar los módulos.",
  },
  {
    id: "climatizacion",
    icon: constructOutline,
    emoji: "❄️",
    title: "Clima & ventilación",
    description: "Aire acondicionado no enfría, gotea agua o genera malos olores",
    categorySlug: "climatizacion",
    defaultText: "Mantenimiento preventivo de aire acondicionado, limpieza de filtros y revisión de gas.",
    urgency: "this_week",
    advice: "Limpia los filtros visibles y programa revisión técnica del circuito de refrigeración.",
  },
];

interface OrientacionGuiadaModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ServiceCategory[];
  professionals: Professional[];
  onTakeService: (params: {
    category: ServiceCategory;
    description: string;
    urgency: ServiceRequestUrgency;
    professional: Professional | null;
  }) => void;
}

export const OrientacionGuiadaModal: React.FC<OrientacionGuiadaModalProps> = ({
  isOpen,
  onClose,
  categories,
  professionals,
  onTakeService,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("plomeria");
  const [customText, setCustomText] = useState("");

  // Detección automática por palabras clave si el usuario escribe texto libre
  const detectedSlug = useMemo(() => {
    const text = customText.toLowerCase();
    if (text.includes("agua") || text.includes("fuga") || text.includes("tub") || text.includes("gotera") || text.includes("grif") || text.includes("sanit") || text.includes("desag") || text.includes("inodoro")) {
      return "plomeria";
    }
    if (text.includes("luz") || text.includes("cort") || text.includes("break") || text.includes("corrient") || text.includes("toma") || text.includes("chisp") || text.includes("enchufe")) {
      return "electricidad";
    }
    if (text.includes("llave") || text.includes("chap") || text.includes("cerradur") || text.includes("cerroj") || text.includes("candad") || text.includes("bloque")) {
      return "cerrajeria";
    }
    if (text.includes("pared") || text.includes("muro") || text.includes("griet") || text.includes("fisur") || text.includes("humed") || text.includes("baldos") || text.includes("piso") || text.includes("pint")) {
      return "albanileria";
    }
    if (text.includes("mader") || text.includes("muebl") || text.includes("closet") || text.includes("bisagr") || text.includes("cajon") || text.includes("puert")) {
      return "carpinteria";
    }
    if (text.includes("aire") || text.includes("calor") || text.includes("enfri") || text.includes("clima") || text.includes("ventil")) {
      return "climatizacion";
    }
    return null;
  }, [customText]);

  // Preset activo actual
  const activePreset = useMemo(() => {
    const targetSlug = detectedSlug || selectedPresetId;
    return PRESETS.find((p) => p.categorySlug === targetSlug) || PRESETS[0];
  }, [detectedSlug, selectedPresetId]);

  // Categoría correspondiente en la base de datos
  const matchedCategory = useMemo(() => {
    if (!categories.length) return null;
    return (
      categories.find((c) => c.slug.toLowerCase() === activePreset.categorySlug.toLowerCase()) ||
      categories[0]
    );
  }, [categories, activePreset]);

  // Profesional recomendado para la categoría
  const matchedProfessional = useMemo(() => {
    if (!professionals.length || !matchedCategory) return null;
    return (
      professionals.find((p) =>
        p.categories?.some(
          (cat) =>
            cat.toLowerCase() === matchedCategory.slug.toLowerCase() ||
            cat.toLowerCase() === matchedCategory.name.toLowerCase()
        )
      ) || professionals[0]
    );
  }, [professionals, matchedCategory]);

  const handleConfirmDiagnosis = () => {
    if (!matchedCategory) return;

    const finalDescription = customText.trim()
      ? customText.trim()
      : activePreset.defaultText;

    onTakeService({
      category: matchedCategory,
      description: finalDescription,
      urgency: activePreset.urgency,
      professional: matchedProfessional,
    });
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="sp-diag-modal">
      <IonHeader>
        <IonToolbar className="sp-diag-modal-header">
          <IonTitle>Orientación Guiada & Diagnóstico</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} fill="clear">
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-diag-modal-content">
        <div className="sp-diag-modal-body">
          {/* Banner de Orientación */}
          <div className="sp-diag-banner">
            <div className="sp-diag-banner-icon">
              <IonIcon icon={helpCircleOutline} />
            </div>
            <div className="sp-diag-banner-text">
              <h3>¿Tienes un problema en tu hogar?</h3>
              <p>
                Selecciona la situación que ocurre o descríbela y te orientaremos con el
                servicio exacto y el especialista verificado en Bogotá.
              </p>
            </div>
          </div>

          {/* Sección 1: Selección de Síntomas Comunes */}
          <div className="sp-diag-section-card">
            <h4 className="sp-diag-section-title">
              <IonIcon icon={sparklesOutline} />
              <span>1. Selecciona el tipo de problema en casa</span>
            </h4>

            <div className="sp-diag-symptoms-grid">
              {PRESETS.map((preset) => {
                const isSelected = activePreset.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`sp-diag-symptom-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setCustomText("");
                    }}
                  >
                    <div className="sp-diag-symptom-icon">{preset.emoji}</div>
                    <div className="sp-diag-symptom-info">
                      <strong>{preset.title}</strong>
                      <span>{preset.description}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Entrada de texto libre */}
            <div style={{ marginTop: "14px" }}>
              <label style={{ fontSize: "0.84rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: "6px" }}>
                O describe en tus palabras qué está pasando:
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Tengo una fuga de agua debajo del lavaplatos y no sé si es la manguera..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              {detectedSlug && (
                <small style={{ color: "#0B2F6B", fontWeight: 600, display: "block", marginTop: "4px" }}>
                  💡 Diagnóstico automático detectado para: {activePreset.title}
                </small>
              )}
            </div>
          </div>

          {/* Sección 2: Resultado de la Orientación y Recomendación */}
          <div className="sp-diag-result-box">
            <div className="sp-diag-result-header">
              <span className="sp-diag-result-badge">
                <IonIcon icon={checkmarkCircle} /> Diagnóstico sugerido
              </span>
              <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#b91c1c" }}>
                {activePreset.urgency === "urgent" ? "🔴 Prioridad alta" : "🟡 Atención estándar"}
              </span>
            </div>

            <h3 className="sp-diag-result-category">
              Especialidad: {matchedCategory?.name || activePreset.title}
            </h3>

            <p className="sp-diag-result-desc">
              <strong>Consejo preventivo:</strong> {activePreset.advice}
            </p>

            {/* Profesional Recomendado */}
            {matchedProfessional && (
              <div className="sp-diag-pro-preview">
                <div className="sp-diag-pro-avatar">
                  {matchedProfessional.avatar_url ? (
                    <img src={matchedProfessional.avatar_url} alt={matchedProfessional.display_name} />
                  ) : (
                    matchedProfessional.initials || "PRO"
                  )}
                </div>
                <div className="sp-diag-pro-info">
                  <h4>{matchedProfessional.display_name}</h4>
                  <p>{matchedProfessional.headline || `Especialista en ${matchedCategory?.name}`}</p>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "3px", color: "#d97706", fontWeight: 700, fontSize: "0.84rem" }}>
                  <IonIcon icon={star} />
                  <span>{matchedProfessional.rating_avg || "4.9"}</span>
                </div>
              </div>
            )}

            <IonButton
              expand="block"
              className="sp-btn-take-diagnosed-service"
              onClick={handleConfirmDiagnosis}
            >
              <IonIcon slot="start" icon={constructOutline} />
              Tomar servicio con este diagnóstico
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default OrientacionGuiadaModal;
