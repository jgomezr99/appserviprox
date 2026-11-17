import React, { useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  checkBackendHealth,
  clearCustomApiHost,
  getApiBaseUrl,
  getConnectionMode,
  getSavedCustomHost,
  saveCustomApiHost,
  type ConnectionMode,
} from "../services/api";
import "./ServerConnectionModal.css";

const DEFAULT_MV_URL = "https://serviprox-pte.duckdns.org/api/v1";

const formatConnectionMode = (mode?: ConnectionMode | null): string => {
  switch (mode) {
    case "vm-direct":
      return "Máquina Virtual (Directo)";
    case "vm-proxy":
      return "Máquina Virtual (Proxy anti-CORS)";
    case "local-sqlite":
      return "Respaldo SQLite local";
    case "custom":
      return "Servidor personalizado";
    default:
      return "API Serviprox";
  }
};

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
        const engineLabel = result.engine || (mode === "local-sqlite" ? "sqlite" : "PostgreSQL");
        setStatus("connected");
        setConnectionMode(mode);
        setDbInfo(`${formatConnectionMode(mode)} · ${result.database} (${engineLabel})`);
        setFeedback({
          type: "success",
          text: `✓ ${formatConnectionMode(mode)} conectado (${result.database}) en ${result.url}`,
        });
      } else {
        setStatus("disconnected");
        setDbInfo("");
        setFeedback({
          type: "error",
          text:
            result.error ||
            "El servidor no respondió a la prueba de salud. Si la MV está apagada, puedes usar el modo de respaldo SQLite.",
        });
      }
    } catch {
      setStatus("disconnected");
      setFeedback({
        type: "error",
        text: "Error de red al intentar contactar con el backend.",
      });
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const explicitHost = getSavedCustomHost();
      setCurrentUrl(explicitHost || DEFAULT_MV_URL);
      void verifyConnection(explicitHost || undefined);
    }
  }, [isOpen, verifyConnection]);

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
        }, 1200);
      } else {
        setStatus("disconnected");
        setFeedback({ type: "error", text: res.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    clearCustomApiHost();
    const restoredUrl = getApiBaseUrl();
    setCurrentUrl(restoredUrl);
    setFeedback({
      type: "success",
      text: "Se restauró la configuración por defecto (MV Serviprox con respaldo SQLite).",
    });
    void verifyConnection();
  };

  const handleSelectMvPreset = () => {
    setCurrentUrl(DEFAULT_MV_URL);
    void verifyConnection(DEFAULT_MV_URL);
  };

  if (!isOpen) return null;

  const content = (
    <div className="scm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="scm-card" onClick={(e) => e.stopPropagation()}>
        <div className="scm-header">
          <div className="scm-header-title">
            <div className="scm-icon-badge">🌐</div>
            <div>
              <h3>Conexión de Base de Datos y Servidor (MV)</h3>
              <p>Máquina Virtual Serviprox con proxy anti-CORS y respaldo SQLite</p>
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
                {status === "checking" && "Comprobando conexión..."}
                {status === "connected" && `Conectado: ${dbInfo || formatConnectionMode(connectionMode)}`}
                {status === "disconnected" && "Desconectado: Sin enlace con la base de datos"}
              </span>
            </div>
          </div>

          {isNetlify && (
            <div className="scm-info-box">
              <strong>📢 Estás en Netlify:</strong> Netlify solo almacena archivos estáticos (HTML/JS). Para que el inicio de sesión y la base de datos funcionen en web y móvil, ingresa abajo la URL pública HTTPS de tu MV / backend.
            </div>
          )}

          <div className="scm-field">
            <div className="scm-label-row">
              <label htmlFor="backend-url-input">URL del Backend / MV (API Serviprox):</label>
              <button
                type="button"
                className="scm-preset-btn"
                onClick={handleSelectMvPreset}
                disabled={testing || saving}
              >
                🌐 MV Oficial (serviprox-pte)
              </button>
            </div>
            <div className="scm-input-wrapper">
              <input
                id="backend-url-input"
                className="scm-input"
                type="text"
                placeholder="https://serviprox-pte.duckdns.org/api/v1"
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
              Puedes pegar la URL base o .../api/v1/health/ (se normaliza automáticamente). Si la MV está fuera de línea, los paneles web pasan a respaldo SQLite local.
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
              {saving ? "Guardando..." : "💾 Guardar y Conectar"}
            </button>
            <button
              type="button"
              className="scm-reset-btn"
              onClick={handleReset}
              title="Restaurar valores de fábrica"
            >
              Restablecer
            </button>
          </div>

          {onSelectDemoUser && (
            <div className="scm-demo-section">
              <span className="scm-demo-title">¿Deseas probar la interfaz sin backend activo?</span>
              <div className="scm-demo-buttons">
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
                <button
                  type="button"
                  className="scm-demo-btn"
                  onClick={() => {
                    onSelectDemoUser("laura.gomez@bogota.co", "serviprox2026");
                    onClose();
                  }}
                >
                  ⭐ Laura (Cliente)
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


