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
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  mailOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { ApiError, checkBackendHealth } from "../services/api";
import { authService } from "../services/auth";
import { useAuth } from "../context/AuthContext";
import { getEntryRoute } from "../utils/routes";
import logo from "../Assets/logo.png";
import styles from "./Login.module.css";

const emailOk = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

const getLoginErrorMessage = (error: unknown) => {
  const isApi =
    error instanceof ApiError ||
    (typeof error === "object" && error !== null && "status" in error);

  if (isApi) {
    const apiErr = error as ApiError;
    if (apiErr.status === 401) {
      return "Correo o contraseña incorrectos.";
    }
    if (
      apiErr.status === 502 ||
      apiErr.status === 503 ||
      apiErr.status === 504 ||
      apiErr.status >= 500
    ) {
      return "No pudimos conectar con el backend de Serviprox. Verifica que esté iniciado en el puerto 8000 (iniciar_serviprox.bat o backend\\start_local.bat).";
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
    return "No pudimos conectar con Serviprox. Revisa tu conexión o que el backend esté disponible.";
  }

  return "No pudimos iniciar sesión. Inténtalo nuevamente.";
};

const Login: React.FC = () => {
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
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoverySubmitting, setRecoverySubmitting] = useState(false);

  useEffect(() => {
    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
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
        setError("El backend aún no responde en el puerto 8000. Verifica que iniciar_serviprox.bat esté activo.");
      }
    } finally {
      setCheckingConnection(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      history.replace(getEntryRoute(user));
    }
  }, [history, isAuthenticated, sessionLoading, user]);

  const canSubmit = emailOk(email) && password.length >= 6 && !isSubmitting;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError("");
    setIsSubmitting(true);
    try {
      const currentUser = await login({ email: email.trim().toLowerCase(), password });
      history.replace(getEntryRoute(currentUser));
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestRecoveryCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailOk(email) || recoverySubmitting) return;
    setRecoveryError("");
    setRecoveryMessage("");
    setRecoverySubmitting(true);
    try {
      await authService.requestPasswordReset(email.trim().toLowerCase());
      setRecoveryStep("code");
      setRecoveryMessage("Si el correo está registrado, recibirás un código de 6 dígitos.");
    } catch {
      setRecoveryError("No pudimos enviar el código. Revisa que el backend esté disponible.");
    } finally {
      setRecoverySubmitting(false);
    }
  };

  const confirmRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (recoveryCode.length !== 6 || newPassword.length < 6 || recoverySubmitting) return;
    setRecoveryError("");
    setRecoverySubmitting(true);
    try {
      await authService.confirmPasswordReset({
        email: email.trim().toLowerCase(),
        code: recoveryCode,
        new_password: newPassword,
      });
      setRecoveryOpen(false);
      setRecoveryStep("email");
      setRecoveryCode("");
      setNewPassword("");
      setError("Contraseña actualizada. Ya puedes iniciar sesión.");
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
    if (!emailOk(email) || recoverySubmitting) return;
    setRecoveryError("");
    setRecoveryMessage("");
    setRecoveryCode("");
    setRecoverySubmitting(true);
    try {
      await authService.requestPasswordReset(email.trim().toLowerCase());
      setRecoveryMessage("Enviamos un código nuevo. El código anterior ya no es válido.");
    } catch {
      setRecoveryError("No pudimos enviar otro código. Revisa que el backend esté disponible.");
    } finally {
      setRecoverySubmitting(false);
    }
  };

  return (
    <IonPage className={styles.authPage}>
      <IonContent fullscreen className={styles.authContent}>
        <main className={styles.authShell}>
          <section className={styles.brandPanel} aria-label="Serviprox">
            <div className={styles.brandMark}>
              <IonImg src={logo} alt="Serviprox" />
            </div>
            <IonText>
              <p className={styles.kicker}>Servicios confiables para el hogar</p>
              <h1>Encuentra ayuda para tu casa con más claridad.</h1>
              <p className={styles.brandCopy}>
                Ingresa para continuar con tus servicios, solicitudes y profesionales
                disponibles en Serviprox.
              </p>
            </IonText>
          </section>

          <section className={styles.authCard} aria-labelledby="login-title">
            <div className={styles.formHeader}>
              <span className={styles.cardEyebrow}>SERVIPROX</span>
              <h2 id="login-title">Bienvenido de nuevo</h2>
              <p>Ingresa tus credenciales para acceder</p>
            </div>

            
            <form className={styles.form} onSubmit={handleLogin} noValidate>
              <label className={styles.field}>
                <span>Correo electrónico</span>
                <div className={styles.inputShell}>
                  <IonIcon icon={mailOutline} aria-hidden="true" />
                  <IonInput
                    type="email"
                    value={email}
                    autocomplete="email"
                    inputmode="email"
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
                  setRecoveryError("");
                  setRecoveryMessage("");
                }}
              >
                ¿Olvidaste tu contraseña?
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
                  {(error.includes("backend") || error.includes("puerto 8000") || error.includes("conexión")) && (
                    <IonButton
                      fill="outline"
                      size="small"
                      style={{
                        marginTop: "10px",
                        width: "100%",
                        "--border-radius": "12px",
                        textTransform: "none",
                        fontWeight: 800,
                      }}
                      disabled={checkingConnection}
                      onClick={handleRetryConnection}
                    >
                      {checkingConnection ? (
                        <>
                          <IonSpinner name="crescent" style={{ width: "16px", height: "16px", marginRight: "6px" }} />
                          Verificando backend...
                        </>
                      ) : (
                        "🔄 Reintentar conexión con el servidor"
                      )}
                    </IonButton>
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

            

            <div className={styles.footerPrompt}>
              <span>¿Aún no tienes cuenta?</span>
              <IonButton routerLink="/register" fill="clear" className={styles.linkButton}>
                Crear cuenta
              </IonButton>
            </div>

            
          </section>
        </main>
        <IonModal
          isOpen={recoveryOpen}
          onDidDismiss={() => setRecoveryOpen(false)}
          className={styles.recoveryModal}
        >
          <div className={styles.recoveryContent}>
            <span className={styles.cardEyebrow}>RECUPERAR ACCESO</span>
            <h2>Restablece tu contraseña</h2>
            <p>Te enviaremos un código temporal a tu correo electrónico.</p>
            {recoveryStep === "email" ? (
              <form className={styles.form} onSubmit={requestRecoveryCode}>
                <label className={styles.field}>
                  <span>Correo electrónico</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={mailOutline} aria-hidden="true" />
                    <IonInput
                      type="email"
                      value={email}
                      autocomplete="email"
                      onIonInput={(event) => setEmail(String(event.detail.value ?? ""))}
                    />
                  </div>
                </label>
                <IonButton expand="block" type="submit" disabled={!emailOk(email) || recoverySubmitting}>
                  {recoverySubmitting ? <IonSpinner name="crescent" /> : "Enviar código"}
                </IonButton>
              </form>
            ) : (
              
              <form className={styles.form} onSubmit={confirmRecovery}>
                <label className={styles.field}>
                  <span>Código de 6 dígitos</span>
                  <IonInput
                    value={recoveryCode}
                    inputmode="numeric"
                    maxlength={6}
                    onIonInput={(event) => setRecoveryCode(String(event.detail.value ?? "").replace(/\D/g, ""))}
                  />
                </label>
                <label className={styles.field}>
                  <span>Nueva contraseña</span>
                  <IonInput
                    type="password"
                    value={newPassword}
                    autocomplete="new-password"
                    onIonInput={(event) => setNewPassword(String(event.detail.value ?? ""))}
                  />
                </label>
                {recoveryMessage && <p className={styles.recoveryMessage}>{recoveryMessage}</p>}
                <IonButton expand="block" type="submit" disabled={recoveryCode.length !== 6 || newPassword.length < 6 || recoverySubmitting}>
                  {recoverySubmitting ? <IonSpinner name="crescent" /> : "Cambiar contraseña"}
                </IonButton>
                <IonButton
                  type="button"
                  fill="clear"
                  onClick={() => void resendRecoveryCode()}
                  disabled={recoverySubmitting}
                >
                  Enviar otro código
                </IonButton>
              </form>
            )}
            {recoveryError && <p className={styles.error} role="alert">{recoveryError}</p>}
            <IonButton fill="clear" onClick={() => setRecoveryOpen(false)}>Cancelar</IonButton>
          </div>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Login;
