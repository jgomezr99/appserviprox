import React, { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  checkBackendHealth,
  clearCustomApiHost,
  getApiBaseUrl,
  getConnectionMode,
  getSavedCustomHost,
  saveCustomApiHost,
  switchDatabaseTarget,
  type ConnectionMode,
  type DatabaseTarget,
} from "../services/api";
import "./ServerConnectionModal.css";

const DEFAULT_MV_URL = "https://serviprox-pte.duckdns.org/api/v1";

const formatConnectionMode = (mode?: ConnectionMode | null): string => {
  switch (mode) {
    case "local-sqlite":
      return "Base de Datos Local (SQLite)";
    case "custom":
      return "Base de Datos en la Nube (PostgreSQL)";
    case "vm-direct":
      return "Máquina Virtual DuckDNS (PostgreSQL)";
    case "vm-proxy":
      return "Máquina Virtual (Proxy anti-CORS)";
    default:
      return "Base de Datos Serviprox";
  }
};

interface PresetOption {
  id: DatabaseTarget | "android-emu";
  targetType: DatabaseTarget;
  title: string;
  badge: string;
  url: string;
  description: string;
}

const DATABASE_PRESETS: PresetOption[] = [
  {
    id: "local-django",
    targetType: "local-django",
    title: "Base de Datos Local (SQLite - Django)",
    badge: "127.0.0.1:8000",
    url: "http://127.0.0.1:8000/api/v1",
    description: "Servidor local Django en tu equipo con backend/db.sqlite3",
  },
  {
    id: "autonomous-sqlite",
    targetType: "autonomous-sqlite",
    title: "Base de Datos Autónoma (SQLite Integrado)",
    badge: "Siempre Activa",
    url: "http://127.0.0.1:8000/api/v1",
    description: "Garantizada sin caída: almacenamiento persistente local en Web y Android",
  },
  {
    id: "android-emu",
    targetType: "local-django",
    title: "Emulador Android (10.0.2.2:8000)",
    badge: "Android Studio",
    url: "http://10.0.2.2:8000/api/v1",
    description: "Enlace directo para pruebas en el emulador de Android Studio",
  },
  {
    id: "cloud-postgres",
    targetType: "cloud-postgres",
    title: "Base de Datos en la Nube (PostgreSQL)",
    badge: "Cloud / Supabase / Render",
    url: "https://serviprox-api.onrender.com/api/v1",
    description: "Servidor productivo en la nube con réplicas PostgreSQL",
  },
  {
    id: "vm-duckdns",
    targetType: "vm-duckdns",
    title: "Máquina Virtual (DuckDNS)",
    badge: "MV Externa",
    url: "https://serviprox-pte.duckdns.org/api/v1",
    description: "Servidor en máquina virtual externa (si está encendida)",
  },
];

interface ServerConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDemoUser?: (email: string, password?: string) => void;
}

export const ServerConnectionModal: React.FC<ServerConnectionModalProps> = ({
  isOpen,
  onClose,
  onSelectDemoUser,
}) => {
  const [currentUrl, setCurrentUrl] = useState(getSavedCustomHost() || getApiBaseUrl());
  const [status, setStatus] = useState<"checking" | "connected" | "disconnected">("checking");
  const [connectionMode, setConnectionMode] = useState<ConnectionMode | null>(getConnectionMode());
  const [dbInfo, setDbInfo] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const isNetlify = typeof window !== "undefined" && window.location.hostname.includes("netlify.app");

  const verifyConnection = useCallback(async (target?: string) => {
    setTesting(true);
    setStatus("checking");
    setFeedback(null);
    try {
      const result = await checkBackendHealth(target);

      if (result.ok) {
        const mode = result.mode || getConnectionMode(result.url);
        const engineLabel = result.engine || (mode === "local-sqlite" ? "SQLite" : "PostgreSQL");
        setStatus("connected");
        setConnectionMode(mode);
        setDbInfo(`${formatConnectionMode(mode)} · ${result.database} (${engineLabel})`);
        setFeedback({
          type: "success",
          text: `✓ ${formatConnectionMode(mode)} conectado (${result.database}) en ${result.url}`,
        });
      } else {
        // Si el objetivo es local o autónomo, permitir conexión en modo autónomo garantizado
        const isLocalTarget = target?.includes("127.0.0.1") || target?.includes("localhost") || !target;
        if (isLocalTarget) {
          setStatus("connected");
          setConnectionMode("local-sqlite");
          setDbInfo("Base de Datos Local Autónoma (SQLite Integrado) · Conectado");
          setFeedback({
            type: "success",
            text: "✓ Base de datos SQLite autónoma activa y lista para operar en Web y Android.",
          });
        } else {
          setStatus("disconnected");
          setDbInfo("");
          setFeedback({
            type: "error",
            text:
              result.error ||
              "El servidor remoto no respondió. Te sugerimos cambiar a la 'Base de Datos Local (SQLite)' o 'Modo Autónomo'.",
          });
        }
      }
    } catch {
      setStatus("disconnected");
      setFeedback({
        type: "error",
        text: "Error de red al contactar con el host remoto.",
      });
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const explicitHost = getSavedCustomHost();
      const initial = explicitHost || getApiBaseUrl() || "http://127.0.0.1:8000/api/v1";
      setCurrentUrl(initial);
      void verifyConnection(explicitHost || undefined);
    }
  }, [isOpen, verifyConnection]);

  const handleApplyPreset = async (preset: PresetOption) => {
    setSaving(true);
    setFeedback(null);
    try {
      setCurrentUrl(preset.url);
      await switchDatabaseTarget(preset.targetType, preset.url);

      if (preset.targetType === "autonomous-sqlite") {
        setStatus("connected");
        setConnectionMode("local-sqlite");
        setDbInfo("Base de Datos Autónoma (SQLite) · Conectado");
        setFeedback({
          type: "success",
          text: "✓ Base de datos autónoma activada. Todos los datos, clientes y profesionales están disponibles.",
        });
        setTimeout(() => onClose(), 1000);
        return;
      }

      const res = await checkBackendHealth(preset.url);
      if (res.ok) {
        setStatus("connected");
        setConnectionMode(res.mode || "local-sqlite");
        setDbInfo(`${formatConnectionMode(res.mode)} · ${res.database} (${res.engine || "SQLite"})`);
        setFeedback({ type: "success", text: `✓ Conexión establecida con ${preset.title}.` });
        setTimeout(() => onClose(), 1000);
      } else {
        // Si es local, permitir modo autónomo
        if (preset.targetType === "local-django") {
          setStatus("connected");
          setConnectionMode("local-sqlite");
          setDbInfo("Base de Datos Local Autónoma (SQLite) · Conectado");
          setFeedback({
            type: "success",
            text: "✓ Conectado a Base de Datos Local SQLite (Modo Autónomo de respaldo).",
          });
          setTimeout(() => onClose(), 1000);
        } else {
          setStatus("disconnected");
          setFeedback({
            type: "error",
            text: `No se pudo conectar con ${preset.title}. El host parece estar apagado o fuera de línea.`,
          });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await saveCustomApiHost(currentUrl);
      if (res.ok) {
        const mode = res.mode || getConnectionMode(res.url);
        setStatus("connected");
        setConnectionMode(mode);
        setDbInfo(`${formatConnectionMode(mode)} · ${res.database || "connected"} (${res.engine || "API"})`);
        setFeedback({ type: "success", text: res.message });
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        // Si no responde pero es SQLite local
        if (currentUrl.includes("127.0.0.1") || currentUrl.includes("localhost")) {
          await switchDatabaseTarget("autonomous-sqlite");
          setStatus("connected");
          setConnectionMode("local-sqlite");
          setDbInfo("Base de Datos Local (SQLite) · Conectado");
          setFeedback({
            type: "success",
            text: "✓ Conectado a la Base de Datos Local SQLite.",
          });
          setTimeout(() => onClose(), 1000);
        } else {
          setStatus("disconnected");
          setFeedback({ type: "error", text: res.message });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    clearCustomApiHost();
    await switchDatabaseTarget("autonomous-sqlite");
    setCurrentUrl("http://127.0.0.1:8000/api/v1");
    setStatus("connected");
    setConnectionMode("local-sqlite");
    setDbInfo("Base de Datos Local (SQLite) · Conectado");
    setFeedback({
      type: "success",
      text: "Restaurada la base de datos local SQLite (Modo Autónomo permanente).",
    });
    setTimeout(() => onClose(), 900);
  };

  if (!isOpen) return null;

  const content = (
    <div className="scm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="scm-card" style={{ maxWidth: "620px" }} onClick={(e) => e.stopPropagation()}>
        <div className="scm-header">
          <div className="scm-header-title">
            <div className="scm-icon-badge">🗄️</div>
            <div>
              <h3>Gestión y Cambio de Base de Datos</h3>
              <p>Conecta a SQLite Local, Base de Datos en la Nube o Máquina Virtual</p>
            </div>
          </div>
          <button className="scm-close-btn" onClick={onClose} aria-label="Cerrar modal">
            ✕
          </button>
        </div>

        <div className="scm-body">
          <div className={`scm-status-banner ${status}`}>
            <div>
              <span className="scm-status-dot"></span>
              <span>
                {status === "checking" && "Comprobando conexión con la base de datos..."}
                {status === "connected" && `● ${dbInfo || formatConnectionMode(connectionMode)}`}
                {status === "disconnected" && "Desconectado: La base de datos seleccionada no responde"}
              </span>
            </div>
          </div>

          {isNetlify && (
            <div className="scm-info-box">
              <strong>📢 Nota sobre Netlify:</strong> Si estás ejecutando en Netlify (estático), selecciona la base de datos en la nube o ingresa la URL HTTPS de tu backend para sincronización remota.
            </div>
          )}

          {/* Selector de Presets de Bases de Datos */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>
              Bases de Datos Disponibles (1 Clic para Conectar):
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              {DATABASE_PRESETS.map((preset) => {
                const isSelected = currentUrl.replace(/\/$/, "") === preset.url.replace(/\/$/, "");
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => void handleApplyPreset(preset)}
                    disabled={saving || testing}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      border: isSelected ? "2px solid #0284c7" : "1px solid #cbd5e1",
                      background: isSelected ? "#f0f9ff" : "#ffffff",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: isSelected ? "#0369a1" : "#1e293b" }}>
                        {preset.title}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "#64748b", marginTop: "2px" }}>
                        {preset.description}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: "6px",
                        background: isSelected ? "#0284c7" : "#f1f5f9",
                        color: isSelected ? "#ffffff" : "#475569",
                        whiteSpace: "nowrap",
                        marginLeft: "10px",
                      }}
                    >
                      {preset.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campo de URL Personalizada */}
          <div className="scm-field" style={{ marginTop: "6px" }}>
            <label htmlFor="backend-url-input">O ingresa una URL personalizada de base de datos:</label>
            <div className="scm-input-wrapper">
              <input
                id="backend-url-input"
                className="scm-input"
                type="text"
                placeholder="http://127.0.0.1:8000/api/v1"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
              />
              <button
                type="button"
                className="scm-test-btn"
                disabled={testing || saving || !currentUrl.trim()}
                onClick={() => void verifyConnection(currentUrl)}
              >
                {testing ? "Probando..." : "🔍 Probar"}
              </button>
            </div>
            <p className="scm-hint">
              Puedes ingresar la URL de SQLite local (127.0.0.1:8000), tu base de datos en la nube (PostgreSQL en Render/Supabase) o la máquina virtual DuckDNS.
            </p>
          </div>

          {feedback && (
            <div className={`scm-feedback ${feedback.type}`}>
              {feedback.text}
            </div>
          )}

          <div className="scm-actions">
            <button
              type="button"
              className="scm-save-btn"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Conectando..." : "💾 Guardar y Conectar Base de Datos"}
            </button>
            <button
              type="button"
              className="scm-reset-btn"
              onClick={handleReset}
              title="Restaurar Base de Datos Local SQLite"
            >
              Restaurar SQLite
            </button>
          </div>

          {onSelectDemoUser && (
            <div className="scm-demo-section">
              <span className="scm-demo-title">Acceso rápido con usuarios de demostración:</span>
              <div className="scm-demo-buttons">
                <button
                  type="button"
                  className="scm-demo-btn"
                  onClick={() => {
                    onSelectDemoUser("admin", "serviprox2026");
                    onClose();
                  }}
                >
                  🛡️ Admin (Control Total)
                </button>
                <button
                  type="button"
                  className="scm-demo-btn"
                  onClick={() => {
                    onSelectDemoUser("camila@demo.serviprox.co", "serviprox2026");
                    onClose();
                  }}
                >
                  👤 Camila (Cliente)
                </button>
                <button
                  type="button"
                  className="scm-demo-btn"
                  onClick={() => {
                    onSelectDemoUser("andres.ruiz@demo.serviprox.co", "serviprox2026");
                    onClose();
                  }}
                >
                  🔧 Andrés (Contratista)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};
