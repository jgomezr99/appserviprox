import React, { useState, useEffect } from "react";
import type { BlockedAccountInfo } from "../types/serviprox";
import { useAuth } from "../context/AuthContext";
import { adminService } from "../services/adminService";
import { SupportAiChatModal } from "./SupportAiChatModal";
import "./BlockedAccountModal.css";

interface BlockedAccountModalProps {
  info: BlockedAccountInfo;
  onClose?: () => void;
  allowClose?: boolean;
}

export const BlockedAccountModal: React.FC<BlockedAccountModalProps> = ({
  info,
  onClose,
  allowClose = false,
}) => {
  const { logout } = useAuth();
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState("");
  const [timeLeftStr, setTimeLeftStr] = useState<string>("");
  const [showAiChat, setShowAiChat] = useState(false);
  const [initialChatAction, setInitialChatAction] = useState<string | undefined>(undefined);
  const [unblockSuccessMsg, setUnblockSuccessMsg] = useState("");

  const handleAccountUnblocked = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("serviprox_blocked_users") || "{}");
      if (info.user_name) {
        delete stored[info.user_name.trim().toLowerCase()];
      }
      localStorage.setItem("serviprox_blocked_users", JSON.stringify(stored));
    } catch {}

    setUnblockSuccessMsg("🎉 ¡Tu cuenta ha sido desbloqueada con éxito por la IA! Redirigiendo a la aplicación...");
    setShowAiChat(false);
    window.dispatchEvent(new CustomEvent("serviprox:account-unblocked"));

    setTimeout(() => {
      if (onClose) {
        onClose();
      } else {
        window.location.href = "/cliente/inicio";
      }
    }, 1500);
  };

  const isTemporal = info.block_type !== "permanente" && !!info.blocked_until;

  // Formatear fecha de finalización
  const formattedUntil = info.blocked_until
    ? new Date(info.blocked_until).toLocaleDateString("es-CO", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Calcular tiempo restante en cuenta regresiva
  useEffect(() => {
    if (!info.blocked_until) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = new Date(info.blocked_until!).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeftStr("El periodo de suspensión ha culminado. Puedes volver a ingresar.");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeLeftStr(`${days} día(s), ${hours} hora(s) y ${minutes} minuto(s)`);
      } else {
        setTimeLeftStr(`${hours} hora(s) y ${minutes} minuto(s)`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [info.blocked_until]);

  const handleSendAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealText.trim()) return;

    setAppealSubmitting(true);
    try {
      // Registrar apelación como PQR disciplinario
      const radicadoNum = Math.floor(10000 + Math.random() * 90000);
      await adminService.executeAction({
        action: "respond_pqr",
        target_id: `APL-${radicadoNum}`,
        response_text: `Apelación de usuario sancionado (${info.user_name || "Usuario"}): ${appealText}`,
        admin_name: "Defensoría Serviprox",
        send_notification: false,
      });

      setAppealSuccess(`Tu recurso de apelación ha sido radicado bajo el número #APL-${radicadoNum}. El comité administrativo revisará tu caso.`);
      setAppealText("");
    } catch {
      setAppealSuccess("Tu recurso de apelación ha sido enviado al equipo de soporte y calidad de Serviprox.");
    } finally {
      setAppealSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    if (onClose) onClose();
    window.location.href = "/login";
  };

  return (
    <div className="sp-blocked-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="sp-blocked-title">
      <div className="sp-blocked-card">
        {/* Encabezado con Ícono de Advertencia */}
        <div className="sp-blocked-header">
          <div className="sp-blocked-icon-box" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          </div>
          <div className="sp-blocked-badge">
            {isTemporal ? "SUSPENSIÓN TEMPORAL DE CUENTA" : "CUENTA INHABILITADA DEFINITIVAMENTE"}
          </div>
          <h2 id="sp-blocked-title" className="sp-blocked-title">
            Cuenta Suspendida por la Administración
          </h2>
          <p className="sp-blocked-subtitle">
            Estimado {info.user_name || "usuario"}, tu acceso a Serviprox ha sido restringido por decisión del comité disciplinario.
          </p>
        </div>

        {/* Caja de Tiempo de la Sanción */}
        {isTemporal ? (
          <div className="sp-blocked-timer-box">
            <div className="sp-blocked-timer-header">
              <span className="sp-blocked-timer-icon" aria-hidden="true">⏱️</span>
              <div>
                <strong>Duración de la suspensión:</strong>
                <p className="sp-blocked-timer-main">
                  {info.block_duration_days ? `${info.block_duration_days} Días de Inhabilitación` : "Sanción Temporal"}
                </p>
              </div>
            </div>

            {formattedUntil && (
              <div className="sp-blocked-timer-row">
                <span className="sp-blocked-label">Reactivación programada:</span>
                <span className="sp-blocked-value highlight">{formattedUntil}</span>
              </div>
            )}

            {timeLeftStr && (
              <div className="sp-blocked-timer-row">
                <span className="sp-blocked-label">Tiempo restante estimado:</span>
                <span className="sp-blocked-value countdown">{timeLeftStr}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="sp-blocked-timer-box permanent">
            <div className="sp-blocked-timer-header">
              <span className="sp-blocked-timer-icon" aria-hidden="true">🚫</span>
              <div>
                <strong>Inhabilitación Definitiva:</strong>
                <p className="sp-blocked-timer-main">Sanción de Carácter Permanente</p>
              </div>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "#991b1b" }}>
              Esta cuenta ha sido excluida de la plataforma de manera irreversible conforme al reglamento de Serviprox.
            </p>
          </div>
        )}

        {/* Motivo Justificado Dejado por el Administrador */}
        <div className="sp-blocked-reason-box">
          <div className="sp-blocked-reason-header">
            <span>📋 Motivo registrado por el Administrador:</span>
          </div>
          <blockquote className="sp-blocked-reason-quote">
            "{info.block_reason || "Incumplimiento de las normas de servicio, puntualidad o acuerdos pactados con clientes."}"
          </blockquote>
          {info.blocked_at && (
            <div className="sp-blocked-reason-date">
              Fecha de aplicación: {new Date(info.blocked_at).toLocaleDateString("es-CO")}
            </div>
          )}
        </div>

        {/* Consecuencias operativas */}
        <div className="sp-blocked-info-text">
          <p>
            ℹ️ Durante el periodo de suspensión no podrás contratar servicios, recibir solicitudes, interactuar en el chat ni gestionar saldos en la plataforma.
          </p>
        </div>

        {/* Sección de Apelación / PQR */}
        {appealSuccess ? (
          <div className="sp-blocked-appeal-success">
            <span>✅ {appealSuccess}</span>
          </div>
        ) : showAppealForm ? (
          <form className="sp-blocked-appeal-form" onSubmit={handleSendAppeal}>
            <label htmlFor="appeal-textarea" className="sp-blocked-appeal-label">
              Escribe tus descargos o pruebas para solicitar revisión:
            </label>
            <textarea
              id="appeal-textarea"
              rows={3}
              value={appealText}
              onChange={(e) => setAppealText(e.target.value)}
              placeholder="Explica detalladamente la situación o adjunta información que sustente el levantamiento de la sanción..."
              required
            />
            <div className="sp-blocked-appeal-actions">
              <button
                type="button"
                className="sp-btn sp-btn-secondary"
                onClick={() => setShowAppealForm(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="sp-btn sp-btn-primary"
                disabled={appealSubmitting || !appealText.trim()}
              >
                {appealSubmitting ? "Enviando..." : "Radicar Apelación Formal"}
              </button>
            </div>
          </form>
        ) : (
          <div className="sp-blocked-help-row">
            <span>¿Consideras que la suspensión es injustificada?</span>
            <button
              type="button"
              className="sp-link-btn"
              onClick={() => setShowAppealForm(true)}
            >
              📝 Radicar Apelación / PQR
            </button>
          </div>
        )}

        {unblockSuccessMsg && (
          <div className="sp-blocked-appeal-success" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534', fontWeight: 800 }}>
            {unblockSuccessMsg}
          </div>
        )}

        {/* Botones de Acción */}
        <div className="sp-blocked-footer-actions">
          {/* Botón Principal: Desbloqueo de Cuenta con IA */}
          <button
            type="button"
            className="sp-btn sp-btn-success"
            onClick={() => {
              setInitialChatAction('iniciar_desbloqueo');
              setShowAiChat(true);
            }}
          >
            🔓 Solicitar Desbloqueo Inmediato (Chat IA)
          </button>

          <button
            type="button"
            className="sp-btn sp-btn-outline"
            onClick={() => {
              setInitialChatAction(undefined);
              setShowAiChat(true);
            }}
          >
            💬 Contactar a Soporte (Chat IA)
          </button>

          <button
            type="button"
            className="sp-btn sp-btn-danger"
            onClick={handleLogout}
          >
            🚪 Cerrar Sesión y Salir
          </button>

          {allowClose && onClose && (
            <button
              type="button"
              className="sp-btn sp-btn-secondary"
              onClick={onClose}
            >
              Entendido
            </button>
          )}
        </div>
      </div>

      {/* Chat de Soporte Asistido por Inteligencia Artificial */}
      <SupportAiChatModal
        isOpen={showAiChat}
        onClose={() => setShowAiChat(false)}
        initialAction={initialChatAction}
        context={{
          userName: info.user_name,
          blockReason: info.block_reason,
          blockDurationDays: info.block_duration_days,
          blockType: info.block_type,
          blockedUntil: info.blocked_until,
        }}
        onAppealSuccess={(ticket) => {
          setAppealSuccess(`Tu recurso de apelación ha sido radicado bajo el radicado #${ticket}. El comité revisará tu caso.`);
        }}
        onAccountUnblocked={handleAccountUnblocked}
      />
    </div>
  );
};

