import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonImg,
  IonInput,
  IonModal,
  IonPage,
  IonSpinner,
  IonText,
} from "@ionic/react";
import {
  arrowBackOutline,
  arrowForwardOutline,
  briefcaseOutline,
  eyeOffOutline,
  eyeOutline,
  homeOutline,
  lockClosedOutline,
  mailOutline,
  phonePortraitOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { ApiError, checkBackendHealth, getApiBaseUrl } from "../services/api";
import { authService } from "../services/auth";
import { useAuth } from "../context/AuthContext";
import { usePlatformSettings } from "../services/platformSettings";
import { getEntryRoute, isUserAdmin } from "../utils/routes";
import logo from "../Assets/logo.png";
import imagemain from "../Assets/imag/categorias-servicios-hogar.jpg";
import contractorImage from "../Assets/imag/contratista .png";
import { BlockedAccountModal } from "../components/BlockedAccountModal";
import type { BlockedAccountInfo } from "../types/serviprox";
import styles from "./Login.module.css";

const emailOk = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

const getBackendUnavailableMessage = () => {
  const apiUrl = getApiBaseUrl();
  if (!apiUrl) {
    return "No hay una URL de backend configurada para esta compilación. Configura VITE_API_URL con la dirección HTTPS de la API y vuelve a publicar.";
  }

  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(apiUrl)) {
    return "No responde el backend local. Inicia Django y verifica que http://127.0.0.1:8000/api/v1/health/ confirme la conexión con la base de datos.";
  }

  return "No pudimos conectar con el servidor o la base de datos de Serviprox. Verifica que la URL de API configurada esté disponible.";
};

const getPasswordRecoveryDeliveryError = (error: unknown) => {
  if (error instanceof TypeError) return getBackendUnavailableMessage();
  if (error instanceof ApiError) {
    if (
      typeof error.payload === "object" &&
      error.payload !== null &&
      "detail" in error.payload
    ) {
      return String(error.payload.detail);
    }
    if (error.status >= 500) {
      return "No pudimos enviar el código. Verifica que el backend y el correo estén disponibles.";
    }
  }
  return "No pudimos enviar el código de recuperación. Inténtalo nuevamente.";
};

const getLoginErrorMessage = (error: unknown) => {
  const isApi =
    error instanceof ApiError ||
    (typeof error === "object" && error !== null && "status" in error);

  if (isApi) {
    const apiErr = error as ApiError;
    if (apiErr.status === 401) {
      if (
        typeof apiErr.payload === "object" &&
        apiErr.payload !== null &&
        "detail" in apiErr.payload
      ) {
        return String(apiErr.payload.detail);
      }
      return "Correo o contraseña incorrectos.";
    }
    if (
      apiErr.status === 502 ||
      apiErr.status === 503 ||
      apiErr.status === 504 ||
      apiErr.status >= 500
    ) {
      return getBackendUnavailableMessage();
    }
    if (apiErr.status === 400 && apiErr.payload) {
      if (typeof apiErr.payload === "object" && "detail" in apiErr.payload) {
        return String((apiErr.payload as { detail: unknown }).detail);
      }
      if (typeof apiErr.payload === "object" && "non_field_errors" in apiErr.payload) {
        const errors = (apiErr.payload as { non_field_errors: unknown }).non_field_errors;
        return Array.isArray(errors) ? String(errors[0]) : String(errors);
      }
    }
    if (apiErr.message && !apiErr.message.startsWith("API request failed with status")) {
      return apiErr.message;
    }
  }

  if (error instanceof TypeError) {
    return getBackendUnavailableMessage();
  }

  return "No pudimos iniciar sesión. Inténtalo nuevamente.";
};

interface LoginProps {
  administrative?: boolean;
  pageClassName?: string;
}

const Login: React.FC<LoginProps> = ({ administrative = false, pageClassName = "" }) => {
  const history = useHistory();
  const { isAuthenticated, isLoading: sessionLoading, login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<"email" | "code">("email");
  const [recoveryChannel, setRecoveryChannel] = useState<"both" | "email" | "sms">("both");
  const [recoveryIdentifier, setRecoveryIdentifier] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryPreviewCode, setRecoveryPreviewCode] = useState("");
  const [recoveryPreviewNotice, setRecoveryPreviewNotice] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);
  const [showLoginForm, setShowLoginForm] =   useState(administrative);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isAdminLogin, setIsAdminLogin] = useState(administrative);
  const [blockedAccountInfo, setBlockedAccountInfo] = useState<BlockedAccountInfo | null>(null);
  const platform = usePlatformSettings();
  const showMaintenance = platform.features.maintenance && !administrative;

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent<{ connected?: boolean }>).detail;
      if (detail?.connected) {
        if (error && (error.includes("backend") || error.includes("puerto 8000") || error.includes("conexión"))) {
          setError("");
          setConnectionSuccess("¡Conexión restablecida con el servidor y la base de datos!");
          setTimeout(() => setConnectionSuccess(""), 4000);
        }
      }
    };
    window.addEventListener("serviprox:connection-status", handleStatus);
    return () => window.removeEventListener("serviprox:connection-status", handleStatus);
  }, [error]);

  const handleRetryConnection = async () => {
    setCheckingConnection(true);
    setConnectionSuccess("");
    try {
      const health = await checkBackendHealth();
      if (health.ok) {
        setError("");
        setConnectionSuccess("¡Conexión verificada exitosamente con la base de datos!");
        setTimeout(() => setConnectionSuccess(""), 4000);
      } else {
        setError("El backend aún no responde en el servidor configurado. Verifica la URL o ábrela en Configurar servidor.");
      }
    } finally {
      setCheckingConnection(false);
    }
  };
  /* conexion de login  direccion home*/
  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      if (isUserAdmin(user)) {
        history.replace("/admin");
      } else if (administrative) {
        history.replace(getEntryRoute(user));
      } else {
        history.replace(getEntryRoute(user));
      }
    }
  }, [administrative, history, isAuthenticated, sessionLoading, user]);

  const canSubmit = emailOk(email) && password.length >= 6 && !isSubmitting;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError("");
    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Revisar si la cuenta está suspendida en almacenamiento local (ej. demo o bloqueo reciente)
    try {
      const stored = JSON.parse(localStorage.getItem("serviprox_blocked_users") || "{}");
      if (stored[normalizedEmail] && stored[normalizedEmail].is_blocked) {
        setBlockedAccountInfo({
          ...stored[normalizedEmail],
          user_name: normalizedEmail,
        });
        setIsSubmitting(false);
        return;
      }
    } catch {
      /* almacenamiento local ilegible: se ignora */
    }

    try {
      const currentUser = await login({ email: normalizedEmail, password });

      // Si el usuario autenticado tiene indicador de suspensión
      if (currentUser?.is_blocked || (currentUser?.is_active === false && currentUser?.block_reason)) {
        setBlockedAccountInfo({
          is_blocked: true,
          block_type: currentUser.block_type || "temporal",
          block_duration_days: currentUser.block_duration_days || 7,
          block_reason: currentUser.block_reason || "Suspensión administrativa",
          blocked_until: currentUser.blocked_until,
          blocked_at: currentUser.blocked_at,
          user_name: `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() || currentUser.username,
          role: currentUser.role,
        });
        return;
      }

      // Si es cuenta de administrador, dirigir inmediatamente a /admin
      if (isUserAdmin(currentUser)) {
        history.replace("/admin");
        return;
      }

      if (administrative && !isUserAdmin(currentUser)) {
        setError("Esta cuenta no tiene permisos administrativos.");
        return;
      }

      history.replace(getEntryRoute(currentUser));
    } catch (err) {
      // 2. Revisar si la API devolvió rechazo por cuenta suspendida
      const payload = (err as { payload?: Partial<BlockedAccountInfo> & { maintenance?: boolean; detail?: unknown } })?.payload;
      if (payload && payload.is_blocked) {
        setBlockedAccountInfo(payload as BlockedAccountInfo);
        return;
      }
      if (payload && payload.maintenance) {
        setError(String(payload.detail));
        return;
      }
      if (typeof payload?.detail === "string" && payload.detail.startsWith("Cuenta bloqueada")) {
        setError(payload.detail);
        return;
      }
      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const recoveryTargetValid = () => {
    const raw = (recoveryIdentifier || email).trim();
    if (!raw) return false;
    if (recoveryChannel === "email") return emailOk(raw);
    if (recoveryChannel === "sms") return raw.replace(/\D/g, "").length >= 7 || emailOk(raw);
    return emailOk(raw) || raw.replace(/\D/g, "").length >= 7;
  };

  const requestRecoveryCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = (recoveryIdentifier || email).trim();
    if (!recoveryTargetValid() || recoverySubmitting) return;
    setRecoveryError("");
    setRecoveryMessage("");
    setRecoveryPreviewCode("");
    setRecoveryPreviewNotice("");
    setRecoverySubmitting(true);
    try {
      const res = await authService.requestPasswordReset({
        identifier: target,
        email: target.includes("@") ? target.toLowerCase() : "",
        phone: target.replace(/\D/g, "").length >= 7 ? target : "",
        channel: recoveryChannel,
        portal: administrative ? "admin" : "user",
      });
      setRecoveryStep("code");
      setRecoveryMessage(
        res.detail ||
          "Si la cuenta está registrada, enviamos tu código de 6 dígitos por correo electrónico y/o SMS."
      );
      if (res.preview_code) {
        setRecoveryPreviewCode(res.preview_code);
        setRecoveryPreviewNotice(res.preview_notice || "");
      }
    } catch (err) {
      setRecoveryError(getPasswordRecoveryDeliveryError(err));
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const confirmRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = (recoveryIdentifier || email).trim();
    if (recoveryCode.length !== 6 || newPassword.length < 6 || recoverySubmitting) return;
    if (confirmNewPassword && confirmNewPassword !== newPassword) {
      setRecoveryError("Las contraseñas no coinciden.");
      return;
    }
    setRecoveryError("");
    setRecoverySubmitting(true);
    try {
      await authService.confirmPasswordReset({
        identifier: target,
        email: target.includes("@") ? target.toLowerCase() : "",
        phone: target.replace(/\D/g, "").length >= 7 ? target : "",
        code: recoveryCode,
        new_password: newPassword,
        portal: administrative ? "admin" : "user",
      });
      setRecoveryOpen(false);
      setRecoveryStep("email");
      setRecoveryCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setRecoveryPreviewCode("");
      setRecoveryPreviewNotice("");
      setConnectionSuccess("Contraseña actualizada correctamente. Ya puedes iniciar sesión.");
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const payload = err.payload as { detail?: unknown };
        setRecoveryError(
          typeof payload.detail === "string"
            ? payload.detail
            : "El código no es válido o la contraseña no cumple los requisitos."
        );
      } else {
        setRecoveryError("No pudimos actualizar la contraseña. Inténtalo nuevamente.");
      }
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const resendRecoveryCode = async () => {
    const target = (recoveryIdentifier || email).trim();
    if (!target || recoverySubmitting) return;
    setRecoveryError("");
    setRecoveryMessage("");
    setRecoveryPreviewCode("");
    setRecoveryPreviewNotice("");
    setRecoveryCode("");
    setRecoverySubmitting(true);
    try {
      const res = await authService.requestPasswordReset({
        identifier: target,
        email: target.includes("@") ? target.toLowerCase() : "",
        phone: target.replace(/\D/g, "").length >= 7 ? target : "",
        channel: recoveryChannel,
        portal: administrative ? "admin" : "user",
      });
      setRecoveryMessage(res.detail || "Enviamos un código nuevo. El código anterior ya no es válido.");
      if (res.preview_code) {
        setRecoveryPreviewCode(res.preview_code);
        setRecoveryPreviewNotice(res.preview_notice || "");
      }
    } catch (err) {
      setRecoveryError(getPasswordRecoveryDeliveryError(err));
    } finally {
      setRecoverySubmitting(false);
    }
  };

  return (
    <IonPage className={`${styles.authPage} ${pageClassName}`}>
      <IonContent fullscreen className={styles.authContent}>
        <main className={`${styles.authShell} ${showLoginForm ? styles.loginShell : ""} ${administrative ? `${styles.administrativeLogin} admin-login-shell` : ""}`}>
          {!showLoginForm ? (
            <section className={`${styles.welcomePanel} ${activeSlide === 2 ? styles.welcomePanelTrust : ""}`} aria-labelledby="welcome-title">
              <div className={styles.welcomeBrand}>
                <IonImg src={logo} alt="Serviprox" />
                <p>Servicios cerca de ti</p>
              </div>
              <div className={styles.welcomeCopy}>
                {activeSlide === 0 && <><h1 id="welcome-title">Tu hogar en <span>buenas manos</span></h1><p>Contrata profesionales confiables para tus servicios del hogar, de forma rápida, segura y en tu zona.</p></>}
                {activeSlide === 1 && <><h1 id="welcome-title">Todo lo que tu hogar <span>necesita</span></h1><p>Plomeros, electricistas, personal de limpieza y más, todo en un solo lugar.</p></>}
                {activeSlide === 2 && <><h1 id="welcome-title">Profesionales de confianza <span>en tu zona</span></h1><p>Personas verificadas, con experiencia y bien valoradas, listas para ayudarte.</p></>}
              </div>
              <div className={styles.welcomeLine} aria-hidden="true" />
              {activeSlide === 0 && <div className={styles.welcomeBenefits}>
                <div><IonIcon icon={shieldCheckmarkOutline} /><strong>Profesionales<br />verificados</strong><small>Tu seguridad es primero</small></div>
                <div><IonIcon icon={arrowForwardOutline} /><strong>Atención<br />rápida</strong><small>Cuando lo necesites</small></div>
                <div><IonIcon icon={homeOutline} /><strong>Cerca<br />de ti</strong><small>Encuentra servicios en tu zona</small></div>
                <div><IonIcon icon={briefcaseOutline} /><strong>Valoraciones<br />reales</strong><small>Confía en la comunidad</small></div>
              </div>}
              {activeSlide === 1 && <>
                <IonImg className={styles.welcomeImage} src={imagemain} alt="Categorías de servicios para el hogar" />
                <div className={styles.serviceGrid} />
              </>}
              {activeSlide === 2 && <div className={styles.trustList}>
                <span><IonIcon icon={shieldCheckmarkOutline} /><strong>Perfiles verificados</strong></span><span><IonIcon icon={arrowForwardOutline} /><strong>Servicio rápido</strong></span><span><IonIcon icon={briefcaseOutline} /><strong>Valoraciones reales</strong></span>
              </div>}
              {activeSlide === 2 && <IonImg className={styles.contractorImage} src={contractorImage} alt="Perfil de profesional ubicado cerca de ti" />}
              <IonButton className={styles.startButton} expand="block" onClick={() => {
                if (activeSlide < 2) {
                  setActiveSlide(activeSlide + 1);
                } else {
                  setIsAdminLogin(false);
                  setShowLoginForm(true);
                }
              }}>
                {activeSlide < 2 ? "Continuar" : "Continuar al login"} <IonIcon slot="end" icon={arrowForwardOutline} />
              </IonButton>
              {!administrative && !showLoginForm && activeSlide < 2 && (
                <IonButton
                  fill="clear"
                  className={styles.adminLoginButton}
                  onClick={() => {
                    setIsAdminLogin(false);
                    setShowLoginForm(true);
                  }}
                >
                  Ya tengo cuenta · Iniciar sesión
                </IonButton>
              )}
              {!administrative && !showLoginForm && platform.features.new_users !== false && (
                <IonButton
                  routerLink="/register"
                  fill="clear"
                  className={styles.adminLoginButton}
                >
                  ¿Eres nuevo? Crear cuenta
                </IonButton>
              )}
              {!administrative && !showLoginForm && activeSlide === 2 && (
                <IonButton routerLink="/login/administrativo" fill="clear" className={styles.adminLoginButton}>
                  Acceso administrador
                </IonButton>
              )}
              <div className={styles.welcomeDots} aria-label="Navegación del onboarding">{[0, 1, 2].map((slide) => <button key={slide} type="button" className={slide === activeSlide ? styles.activeDot : ""} aria-label={`Pantalla ${slide + 1}`} onClick={() => setActiveSlide(slide)} />)}</div>
            </section>
          ) : (
            <section className={`${styles.brandPanel} ${administrative ? "admin-login-brand" : ""}`} aria-label="Serviprox">
            <div className={styles.brandMark}>
              <IonImg src={logo} alt="Serviprox" />
            </div>
            {!administrative && <IonText>
              <p className={styles.kicker}>Servicios confiables para el hogar</p>
              <h1>Encuentra ayuda para tu casa con más claridad.</h1>
              <p className={styles.brandCopy}>
                Ingresa para continuar con tus servicios, solicitudes y profesionales
                disponibles en Serviprox.
              </p>
            </IonText>}
            </section>
          )}

          {showLoginForm && <section className={`${styles.authCard} ${administrative ? "admin-login-card" : ""}`} aria-labelledby="login-title">
            <IonButton fill="clear" className={styles.backButton} onClick={() => {
              if (administrative) {
                history.replace("/login");
              } else {
                setIsAdminLogin(false);
                setShowLoginForm(false);
              }
            }}>
              <IonIcon slot="start" icon={arrowBackOutline} />
              Volver
            </IonButton>
            <div className={styles.formHeader}>
              <span className={styles.cardEyebrow}>SERVIPROX</span>
              <h2 id="login-title">{isAdminLogin ? "Login administrativo" : "Bienvenido de nuevo"}</h2>
              <p>Ingresa tus credenciales para acceder</p>
            </div>

            {showMaintenance && (
              <div
                role="alert"
                style={{
                  padding: "12px 14px",
                  borderRadius: "16px",
                  background: "#fff7e6",
                  border: "1px solid #ffd591",
                  color: "#ad6800",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  marginBottom: "12px",
                }}
              >
                🛠️ {platform.maintenance_message}
              </div>
            )}

            <form className={styles.form} onSubmit={handleLogin} noValidate>
              <label className={styles.field}>
                <span>Correo electrónico</span>
                <div className={styles.inputShell}>
                  <IonIcon icon={mailOutline} aria-hidden="true" />
                  <IonInput
                    type="email"
                    value={email}
                    autocomplete="username"
                    enterkeyhint="next"
                    placeholder="tu@correo.com"
                    onIonInput={(event) => setEmail(String(event.detail.value ?? ""))}
                    required
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span>Contraseña</span>
                <div className={styles.inputShell}>
                  <IonIcon icon={lockClosedOutline} aria-hidden="true" />
                  <IonInput
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autocomplete="current-password"
                    enterkeyhint="go"
                    placeholder="Tu contraseña"
                    onIonInput={(event) => setPassword(String(event.detail.value ?? ""))}
                    required
                  />
                  <IonButton
                    type="button"
                    fill="clear"
                    className={styles.passwordToggle}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                  </IonButton>
                </div>
              </label>

              <IonButton
                type="button"
                fill="clear"
                className={styles.recoverButton}
                onClick={() => {
                  setRecoveryOpen(true);
                  setRecoveryStep("email");
                  setRecoveryChannel("both");
                  setRecoveryIdentifier(email.trim());
                  setRecoveryCode("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setRecoveryPreviewCode("");
                  setRecoveryPreviewNotice("");
                  setRecoveryError("");
                  setRecoveryMessage("");
                }}
              >
                Olvidaste la contraseña (Correo / SMS)
              </IonButton>

              {connectionSuccess && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "16px",
                    background: "#e8f5e9",
                    border: "1px solid #a5d6a7",
                    color: "#2e7d32",
                    fontSize: "0.88rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>✓</span>
                  <span>{connectionSuccess}</span>
                </div>
              )}

              {error && (
                <div className={styles.error} role="alert">
                  <p style={{ margin: 0 }}>{error}</p>
                  {(error.includes("backend") || error.includes("servidor") || error.includes("puerto 8000") || error.includes("conexión")) && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                      <IonButton
                        fill="outline"
                        size="small"
                        style={{
                          flex: 1,
                          "--border-radius": "12px",
                          textTransform: "none",
                          fontWeight: 800,
                        }}
                        disabled={checkingConnection}
                        onClick={handleRetryConnection}
                      >
                        {checkingConnection ? (
                          <>
                            <IonSpinner name="crescent" style={{ width: "14px", height: "14px", marginRight: "6px" }} />
                            Probando...
                          </>
                        ) : (
                          "🔄 Reintentar"
                        )}
                      </IonButton>
                    
                    </div>
                  )}
                </div>
              )}

              <IonButton
                expand="block"
                type="submit"
                className={styles.primaryButton}
                disabled={!canSubmit}
              >
                {isSubmitting ? <IonSpinner name="crescent" /> : "Iniciar sesión"}
              </IonButton>

            </form>

            {!administrative && platform.features.new_users !== false && <div className={styles.footerPrompt}>
              <span>¿Aún no tienes cuenta?</span>
              <IonButton routerLink="/register" fill="clear" className={styles.linkButton}>
                Crear cuenta
              </IonButton>
            </div>}

          </section>}
        </main>
        <IonModal
          isOpen={recoveryOpen}
          onDidDismiss={() => setRecoveryOpen(false)}
          className={styles.recoveryModal}
        >
          <div className={styles.recoveryContent}>
            <span className={styles.cardEyebrow}>RECUPERAR CUENTA (CLIENTE / PROFESIONAL)</span>
            <h2>Restablece tu contraseña</h2>
            <p>Recibe un código de verificación de 6 dígitos en tu correo electrónico y/o por SMS a tu celular registrado.</p>
            {recoveryStep === "email" ? (
              <form className={styles.form} onSubmit={requestRecoveryCode}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px", marginBottom: "6px" }}>
                  {(
                    [
                      { id: "both", label: "Correo y SMS" },
                      { id: "email", label: "Solo Correo" },
                      { id: "sms", label: "Solo SMS" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRecoveryChannel(opt.id)}
                      style={{
                        padding: "9px 8px",
                        borderRadius: "12px",
                        border: recoveryChannel === opt.id ? "2px solid #1d4ed8" : "1px solid #cbd5e1",
                        background: recoveryChannel === opt.id ? "#eff6ff" : "#ffffff",
                        color: recoveryChannel === opt.id ? "#1d4ed8" : "#475569",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <label className={styles.field}>
                  <span>
                    {recoveryChannel === "sms"
                      ? "Número de teléfono o correo registrado"
                      : recoveryChannel === "email"
                        ? "Correo electrónico registrado"
                        : "Correo electrónico o número de teléfono"}
                  </span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={recoveryChannel === "sms" ? phonePortraitOutline : mailOutline} aria-hidden="true" />
                    <IonInput
                      type={recoveryChannel === "email" ? "email" : "text"}
                      value={recoveryIdentifier}
                      placeholder={
                        recoveryChannel === "sms"
                          ? "Ej: 3101234567"
                          : recoveryChannel === "email"
                            ? "tu@correo.com"
                            : "tu@correo.com o 3101234567"
                      }
                      onIonInput={(event) => setRecoveryIdentifier(String(event.detail.value ?? ""))}
                    />
                  </div>
                </label>
                <IonButton expand="block" type="submit" className={styles.primaryButton} disabled={!recoveryTargetValid() || recoverySubmitting}>
                  {recoverySubmitting ? <IonSpinner name="crescent" /> : "Enviar código de recuperación"}
                </IonButton>
              </form>
            ) : (
              <form className={styles.form} onSubmit={confirmRecovery}>
                {recoveryMessage && <p className={styles.recoveryMessage}>{recoveryMessage}</p>}
                {recoveryPreviewCode && (
                  <div
                    style={{
                      background: "#eff6ff",
                      border: "1px solid #93c5fd",
                      borderRadius: "14px",
                      padding: "12px 14px",
                      marginBottom: "6px",
                      color: "#1e3a8a",
                      fontSize: "0.84rem",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: "4px" }}>
                      Código generado: <span style={{ fontSize: "1.05rem", letterSpacing: "2px" }}>{recoveryPreviewCode}</span>
                    </div>
                    {recoveryPreviewNotice && (
                      <p style={{ margin: "0 0 8px", fontSize: "0.76rem", color: "#334155" }}>{recoveryPreviewNotice}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setRecoveryCode(recoveryPreviewCode)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#1d4ed8",
                        color: "#ffffff",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Usar este código
                    </button>
                  </div>
                )}
                <label className={styles.field}>
                  <span>Código de 6 dígitos</span>
                  <div className={styles.inputShell}>
                    <IonInput
                      value={recoveryCode}
                      inputmode="numeric"
                      maxlength={6}
                      placeholder="000000"
                      onIonInput={(event) => setRecoveryCode(String(event.detail.value ?? "").replace(/\D/g, ""))}
                    />
                  </div>
                </label>
                <label className={styles.field}>
                  <span>Nueva contraseña (mínimo 6 caracteres)</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={lockClosedOutline} aria-hidden="true" />
                    <IonInput
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      autocomplete="new-password"
                      placeholder="Nueva contraseña"
                      onIonInput={(event) => setNewPassword(String(event.detail.value ?? ""))}
                    />
                    <IonButton
                      type="button"
                      fill="clear"
                      className={styles.passwordToggle}
                      onClick={() => setShowNewPassword((v) => !v)}
                    >
                      <IonIcon icon={showNewPassword ? eyeOffOutline : eyeOutline} />
                    </IonButton>
                  </div>
                </label>
                <label className={styles.field}>
                  <span>Confirmar nueva contraseña</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={lockClosedOutline} aria-hidden="true" />
                    <IonInput
                      type={showNewPassword ? "text" : "password"}
                      value={confirmNewPassword}
                      autocomplete="new-password"
                      placeholder="Repite la nueva contraseña"
                      onIonInput={(event) => setConfirmNewPassword(String(event.detail.value ?? ""))}
                    />
                  </div>
                </label>
                <IonButton
                  expand="block"
                  type="submit"
                  className={styles.primaryButton}
                  disabled={
                    recoveryCode.length !== 6 ||
                    newPassword.length < 6 ||
                    (confirmNewPassword.length > 0 && confirmNewPassword !== newPassword) ||
                    recoverySubmitting
                  }
                >
                  {recoverySubmitting ? <IonSpinner name="crescent" /> : "Confirmar y cambiar contraseña"}
                </IonButton>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                  <IonButton
                    type="button"
                    fill="clear"
                    onClick={() => {
                      setRecoveryStep("email");
                      setRecoveryError("");
                    }}
                    disabled={recoverySubmitting}
                  >
                    Cambiar medio
                  </IonButton>
                  <IonButton
                    type="button"
                    fill="clear"
                    onClick={() => void resendRecoveryCode()}
                    disabled={recoverySubmitting}
                  >
                    Reenviar código
                  </IonButton>
                </div>
              </form>
            )}
            {recoveryError && <p className={styles.error} role="alert">{recoveryError}</p>}
            <IonButton fill="clear" onClick={() => setRecoveryOpen(false)}>Cancelar</IonButton>
          </div>
        </IonModal>
      </IonContent>
      {blockedAccountInfo && (
        <BlockedAccountModal
          info={blockedAccountInfo}
          allowClose={true}
          onClose={() => setBlockedAccountInfo(null)}
        />
      )}
    </IonPage>
  );
};

export default Login;
