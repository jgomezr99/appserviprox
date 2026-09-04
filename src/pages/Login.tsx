import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonImg,
  IonInput,
  IonPage,
  IonSpinner,
  IonText,
} from "@ionic/react";
import { eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import logo from "../Assets/logo.png";
import styles from "./Login.module.css";

const emailOk = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

const getLoginErrorMessage = (error: unknown) => {
  if (error instanceof ApiError && error.status === 401) {
    return "Correo o contraseña incorrectos.";
  }
  if (error instanceof TypeError) {
    return "No pudimos conectar con Serviprox. Revisa que el backend esté disponible.";
  }
  return "No pudimos iniciar sesión. Inténtalo nuevamente.";
};

const Login: React.FC = () => {
  const history = useHistory();
  const { isAuthenticated, isLoading: sessionLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      history.replace("/folder/inbox");
    }
  }, [history, isAuthenticated, sessionLoading]);

  const canSubmit = emailOk(email) && password.length >= 6 && !isSubmitting;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError("");
    setIsSubmitting(true);
    try {
      await login({ email: email.trim().toLowerCase(), password });
      history.replace("/folder/inbox");
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setIsSubmitting(false);
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
              <p>Ingresa para continuar</p>
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
                disabled
              >
                ¿Olvidaste tu contraseña?
              </IonButton>

              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
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

            <div className={styles.divider}>
              <span />
              <small>o</small>
              <span />
            </div>

            <div className={styles.footerPrompt}>
              <span>¿Aún no tienes cuenta?</span>
              <IonButton routerLink="/register" fill="clear" className={styles.linkButton}>
                Crear cuenta
              </IonButton>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Login;
