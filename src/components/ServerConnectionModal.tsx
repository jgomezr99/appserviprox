import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  api,
  checkBackendHealth,
  clearCustomApiHost,
  getApiBaseUrl,
  getSavedCustomHost,
  saveCustomApiHost,
} from "../services/api";
import "./ServerConnectionModal.css";

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
  const [dbInfo, setDbInfo] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const isNetlify = typeof window !== "undefined" && window.location.hostname.includes("netlify.app");

  const verifyConnection = async (target?: string) => {
    setTesting(true);
    setFeedback(null);
    try {
      const result = await checkBackendHealth(target || currentUrl);
      if (result.ok) {
        setStatus("connected");
        setDbInfo(`${result.database} (${result.engine || "sqlite"})`);
        setFeedback({
          type: "success",
          text: `✓ Conexión exitosa con la base de datos (${result.database}) en ${result.url}`,
        });
      } else {
        setStatus("disconnected");
        setDbInfo("");
        setFeedback({
          type: "error",
          text: result.error || "El servidor no respondió a la prueba de salud.",
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
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentUrl(getSavedCustomHost() || getApiBaseUrl());
      verifyConnection();
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await saveCustomApiHost(currentUrl);
      if (res.ok) {
        setStatus("connected");
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
    setCurrentUrl(getApiBaseUrl());
    setFeedback({
      type: "success",
      text: "Se restauró la configuración por defecto de la aplicación.",
    });
    verifyConnection(getApiBaseUrl());
  };

  if (!isOpen) return null;

  const content = (
    <div className="scm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="scm-card" onClick={(e) => e.stopPropagation()}>
        <div className="scm-header">
          <div className="scm-header-title">
            <div className="scm-icon-badge">🌐</div>
            <div>
              <h3>Conexión de Base de Datos y Servidor</h3>
              <p>Configuración para Web, Móvil y Netlify</p>
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
                {status === "connected" && `Conectado: Base de datos activa (${dbInfo || "SQLite"})`}
                {status === "disconnected" && "Desconectado: Sin enlace con la base de datos"}
              </span>
            </div>
          </div>

          {isNetlify && (
            <div className="scm-info-box">
              <strong>📢 Estás en Netlify:</strong> Netlify solo almacena archivos estáticos (HTML/JS) y no ejecuta Python. Para que el inicio de sesión y la base de datos funcionen en web y móvil, ingresa abajo la URL pública HTTPS de tu backend (por ejemplo en <strong>Render.com</strong> o tu <strong>DevTunnel</strong> de VS Code).
            </div>
          )}

          <div className="scm-field">
            <label htmlFor="backend-url-input">URL del Backend (API de Django):</label>
            <div className="scm-input-wrapper">
              <input
                id="backend-url-input"
                className="scm-input"
                type="text"
                placeholder="https://tu-backend.onrender.com o DevTunnel"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
              />
              <button
                type="button"
                className="scm-test-btn"
                disabled={testing || saving || !currentUrl.trim()}
                onClick={() => verifyConnection(currentUrl)}
              >
                {testing ? "Probando..." : "🔍 Probar"}
              </button>
            </div>
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

