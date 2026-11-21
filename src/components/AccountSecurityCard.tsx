import React, { useState } from "react";
import { IonBadge, IonButton, IonIcon, IonSpinner } from "@ionic/react";
import {
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  refreshOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { ApiError } from "../services/api";
import { authService } from "../services/auth";
import { useAuth } from "../context/AuthContext";

interface AccountSecurityCardProps {
  disabled?: boolean;
  isVerified?: boolean;
  onSuccessToast?: (message: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  client: "Cliente",
  professional: "Profesional",
  staff: "Administrador",
};

export const AccountSecurityCard: React.FC<AccountSecurityCardProps> = ({
  disabled = false,
  isVerified,
  onSuccessToast,
}) => {
  const { user, refreshSession } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const allVisible = showCurrent && showNew && showConfirm;

  const toggleAllPasswords = () => {
    const next = !allVisible;
    setShowCurrent(next);
    setShowNew(next);
    setShowConfirm(next);
  };

  const handleRefreshAccount = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshSession();
      onSuccessToast?.("Información de la cuenta actualizada.");
    } catch {
      onSuccessToast?.("No fue posible actualizar los datos de tu cuenta.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingPassword || disabled) return;
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword.trim()) {
      setPasswordError("Ingresa tu contraseña actual para confirmar el cambio.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("La confirmación de la nueva contraseña no coincide.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("La nueva contraseña debe ser diferente a tu contraseña actual.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      const msg = res.detail || "Contraseña actualizada correctamente.";
      setPasswordSuccess(msg);
      onSuccessToast?.(msg);
    } catch (err) {
      setPasswordError(
        err instanceof ApiError ? err.message : "No pudimos actualizar tu contraseña. Verifica los datos."
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "No registrado";
  const roleLabel = ROLE_LABELS[user?.role || ""] || user?.role || "Usuario";

  return (
    <>
      <section className="sp-card sp-actions--spaced" aria-label="Revisión de la cuenta">
        <div className="sp-card-header">
          <div className="sp-icon-tile">
            <IonIcon icon={shieldCheckmarkOutline} />
          </div>
          <div className="sp-card-title">
            <h2>Revisión de la cuenta</h2>
            <p>Verifica el estado, credenciales de acceso y datos registrados en Serviprox.</p>
          </div>
          <IonButton
            fill="outline"
            size="small"
            disabled={refreshing}
            onClick={() => void handleRefreshAccount()}
          >
            <IonIcon slot="start" icon={refreshOutline} />
            {refreshing ? "Actualizando..." : "Revisar"}
          </IonButton>
        </div>

        <div className="sp-account-badges">
          <IonBadge color="primary">{roleLabel}</IonBadge>
          <IonBadge color="success">Cuenta activa</IonBadge>
          <IonBadge color={user?.onboarding_completed ? "success" : "warning"}>
            {user?.onboarding_completed ? "Registro completo" : "Onboarding pendiente"}
          </IonBadge>
          {user?.role === "professional" && isVerified !== undefined && (
            <IonBadge color={isVerified ? "success" : "medium"}>
              {isVerified ? "Profesional verificado" : "Verificación en curso"}
            </IonBadge>
          )}
        </div>

        <div className="sp-account-review-grid">
          <div className="sp-account-review-item">
            <span>Usuario de acceso</span>
            <strong>@{user?.username || "sin_usuario"}</strong>
          </div>
          <div className="sp-account-review-item">
            <span>Correo electrónico</span>
            <strong>{user?.email || "No registrado"}</strong>
          </div>
          <div className="sp-account-review-item">
            <span>Titular</span>
            <strong>{fullName}</strong>
          </div>
          <div className="sp-account-review-item">
            <span>Documento</span>
            <strong>{user?.document_id || "No registrado"}</strong>
          </div>
          <div className="sp-account-review-item">
            <span>Teléfono</span>
            <strong>{user?.phone || "No registrado"}</strong>
          </div>
          <div className="sp-account-review-item">
            <span>Ubicación</span>
            <strong>{[user?.city, user?.address].filter(Boolean).join(" · ") || "No registrada"}</strong>
          </div>
        </div>
      </section>

      <section className="sp-card sp-actions--spaced" aria-label="Cambiar contraseña">
        <div className="sp-card-header">
          <div className="sp-icon-tile">
            <IonIcon icon={lockClosedOutline} />
          </div>
          <div className="sp-card-title">
            <h2>Contraseña y acceso</h2>
            <p>Edita tu contraseña y usa el icono del ojo para mostrarla mientras la escribes.</p>
          </div>
          <button
            type="button"
            className="sp-password-all-btn"
            onClick={toggleAllPasswords}
          >
            <IonIcon icon={allVisible ? eyeOffOutline : eyeOutline} />
            <span>{allVisible ? "Ocultar" : "Mostrar contraseñas"}</span>
          </button>
        </div>

        <p className="sp-muted sp-password-note">
          Por seguridad, tu contraseña se guarda cifrada y nunca se almacena en texto plano; aquí puedes visualizar lo que escribes y actualizarla en cualquier momento.
        </p>

        <form className="sp-form" onSubmit={handleChangePassword} noValidate>
          <label className="sp-field">
            Contraseña actual
            <div className="sp-password-field">
              <input
                className="sp-password-input"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                autoComplete="current-password"
                placeholder="Ingresa tu contraseña actual"
                disabled={savingPassword || disabled}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (passwordError) setPasswordError("");
                  if (passwordSuccess) setPasswordSuccess("");
                }}
                required
              />
              <button
                type="button"
                className="sp-password-toggle"
                aria-label={showCurrent ? "Ocultar contraseña actual" : "Mostrar contraseña actual"}
                onClick={() => setShowCurrent((v) => !v)}
              >
                <IonIcon icon={showCurrent ? eyeOffOutline : eyeOutline} />
              </button>
            </div>
          </label>

          <div className="sp-grid sp-grid--two">
            <label className="sp-field">
              Nueva contraseña (mín. 8 caracteres)
              <div className="sp-password-field">
                <input
                  className="sp-password-input"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  disabled={savingPassword || disabled}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                    if (passwordSuccess) setPasswordSuccess("");
                  }}
                  required
                />
                <button
                  type="button"
                  className="sp-password-toggle"
                  aria-label={showNew ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
                  onClick={() => setShowNew((v) => !v)}
                >
                  <IonIcon icon={showNew ? eyeOffOutline : eyeOutline} />
                </button>
              </div>
            </label>

            <label className="sp-field">
              Confirmar nueva contraseña
              <div className="sp-password-field">
                <input
                  className="sp-password-input"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  autoComplete="new-password"
                  placeholder="Repite la nueva contraseña"
                  disabled={savingPassword || disabled}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                    if (passwordSuccess) setPasswordSuccess("");
                  }}
                  required
                />
                <button
                  type="button"
                  className="sp-password-toggle"
                  aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  <IonIcon icon={showConfirm ? eyeOffOutline : eyeOutline} />
                </button>
              </div>
            </label>
          </div>

          {newPassword.length > 0 && (
            <p className="sp-password-hint">
              {newPassword.length < 8
                ? `Te faltan ${8 - newPassword.length} caracter(es) para cumplir el mínimo.`
                : confirmPassword.length > 0 && confirmPassword !== newPassword
                  ? "Las contraseñas nuevas aún no coinciden."
                  : confirmPassword.length > 0
                    ? "Las contraseñas coinciden y cumplen el mínimo de seguridad."
                    : "Longitud válida. Confirma la nueva contraseña."}
            </p>
          )}

          {passwordSuccess && (
            <div className="sp-alert-success" role="alert">
              <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <p className="sp-error" role="alert">
              {passwordError}
            </p>
          )}

          <IonButton
            type="submit"
            className="sp-primary-button"
            disabled={savingPassword || disabled}
          >
            {savingPassword ? <IonSpinner name="crescent" /> : "Actualizar contraseña"}
          </IonButton>
        </form>
      </section>
    </>
  );
};
