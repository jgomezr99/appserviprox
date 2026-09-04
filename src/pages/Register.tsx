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
import {
  briefcaseOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  homeOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { PublicRegisterRole } from "../types/serviprox";
import logo from "../Assets/logo.png";
import styles from "./Login.module.css";

const emailOk = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

const getApiFieldMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return "";
  const entries = Object.entries(payload as Record<string, unknown>);
  const first = entries.find(([, value]) => Array.isArray(value) || typeof value === "string");
  if (!first) return "";
  const [field, value] = first;
  const message = Array.isArray(value) ? String(value[0]) : String(value);
  const labels: Record<string, string> = {
    email: "Correo",
    username: "Usuario",
    password: "Contraseña",
    role: "Tipo de cuenta",
  };
  return `${labels[field] || field}: ${message}`;
};

const getRegisterErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    return getApiFieldMessage(error.payload) || "No pudimos crear la cuenta.";
  }
  if (error instanceof TypeError) {
    return "No pudimos conectar con Serviprox. Revisa que el backend esté disponible.";
  }
  return "No pudimos crear la cuenta. Inténtalo nuevamente.";
};

const roleOptions: Array<{
  value: PublicRegisterRole;
  title: string;
  text: string;
  icon: string;
}> = [
  {
    value: "client",
    title: "Necesito servicios para mi hogar",
    text: "Busca profesionales y crea solicitudes para tu vivienda.",
    icon: homeOutline,
  },
  {
    value: "professional",
    title: "Quiero ofrecer mis servicios",
    text: "Prepara tu cuenta para recibir clientes de servicios del hogar.",
    icon: briefcaseOutline,
  },
];

const Register: React.FC = () => {
  const history = useHistory();
  const { isAuthenticated, isLoading: sessionLoading, register } = useAuth();
  const [role, setRole] = useState<PublicRegisterRole>("client");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Bogotá");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      history.replace("/folder/inbox");
    }
  }, [history, isAuthenticated, sessionLoading]);

  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    emailOk(email) &&
    username.trim().length >= 3 &&
    password.length >= 8 &&
    passwordsMatch &&
    !isSubmitting;

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError("");
    setIsSubmitting(true);
    try {
      await register({
        email: email.trim().toLowerCase(),
        username: username.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        role,
        password,
      });
      history.replace("/folder/inbox");
    } catch (err) {
      setError(getRegisterErrorMessage(err));
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
              <p className={styles.kicker}>Tu punto de partida en Serviprox</p>
              <h1>Crea una cuenta para conectar hogar y profesionales.</h1>
              <p className={styles.brandCopy}>
                Elige cómo quieres usar Serviprox. El rol queda registrado en Django
                y guiará la experiencia en los siguientes sprints.
              </p>
            </IonText>
          </section>

          <section className={styles.authCard} aria-labelledby="register-title">
            <div className={styles.formHeader}>
              <span className={styles.cardEyebrow}>CREAR CUENTA</span>
              <h2 id="register-title">Empieza en Serviprox</h2>
              <p>Selecciona tu tipo de cuenta y completa tus datos</p>
            </div>

            <form className={styles.form} onSubmit={handleRegister} noValidate>
              <fieldset className={styles.roleGroup}>
                <legend>¿Qué quieres hacer en Serviprox?</legend>
                {roleOptions.map((option) => {
                  const selected = role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.roleCard} ${selected ? styles.roleCardSelected : ""}`}
                      onClick={() => setRole(option.value)}
                      aria-pressed={selected}
                    >
                      <IonIcon icon={option.icon} aria-hidden="true" />
                      <span>
                        <strong>{option.title}</strong>
                        <small>{option.text}</small>
                      </span>
                      {selected && <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />}
                    </button>
                  );
                })}
              </fieldset>

              <div className={styles.twoColumn}>
                <label className={styles.field}>
                  <span>Nombre</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={personOutline} aria-hidden="true" />
                    <IonInput
                      value={firstName}
                      autocomplete="given-name"
                      placeholder="Tu nombre"
                      onIonInput={(event) => setFirstName(String(event.detail.value ?? ""))}
                    />
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Apellido</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={personOutline} aria-hidden="true" />
                    <IonInput
                      value={lastName}
                      autocomplete="family-name"
                      placeholder="Tu apellido"
                      onIonInput={(event) => setLastName(String(event.detail.value ?? ""))}
                    />
                  </div>
                </label>
              </div>

              <label className={styles.field}>
                <span>Correo electrónico</span>
                <div className={styles.inputShell}>
                  <IonIcon icon={mailOutline} aria-hidden="true" />
                  <IonInput
                    type="email"
                    value={email}
                    autocomplete="email"
                    inputmode="email"
                    placeholder="tu@correo.com"
                    onIonInput={(event) => setEmail(String(event.detail.value ?? ""))}
                    required
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span>Nombre de usuario</span>
                <div className={styles.inputShell}>
                  <IonIcon icon={personOutline} aria-hidden="true" />
                  <IonInput
                    value={username}
                    autocomplete="username"
                    placeholder="ej: camila.serviprox"
                    onIonInput={(event) => setUsername(String(event.detail.value ?? ""))}
                    required
                  />
                </div>
              </label>

              <div className={styles.twoColumn}>
                <label className={styles.field}>
                  <span>Teléfono</span>
                  <div className={styles.inputShell}>
                    <IonInput
                      type="tel"
                      value={phone}
                      autocomplete="tel"
                      placeholder="+57 300 000 0000"
                      onIonInput={(event) => setPhone(String(event.detail.value ?? ""))}
                    />
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Ciudad</span>
                  <div className={styles.inputShell}>
                    <IonInput
                      value={city}
                      autocomplete="address-level2"
                      placeholder="Bogotá"
                      onIonInput={(event) => setCity(String(event.detail.value ?? ""))}
                    />
                  </div>
                </label>
              </div>

              <label className={styles.field}>
                <span>Contraseña</span>
                <div className={styles.inputShell}>
                  <IonIcon icon={lockClosedOutline} aria-hidden="true" />
                  <IonInput
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autocomplete="new-password"
                    placeholder="Mínimo 8 caracteres"
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

              <label className={styles.field}>
                <span>Confirmar contraseña</span>
                <div className={styles.inputShell}>
                  <IonIcon icon={lockClosedOutline} aria-hidden="true" />
                  <IonInput
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    autocomplete="new-password"
                    placeholder="Repite tu contraseña"
                    onIonInput={(event) => setConfirmPassword(String(event.detail.value ?? ""))}
                    required
                  />
                  <IonButton
                    type="button"
                    fill="clear"
                    className={styles.passwordToggle}
                    aria-label={
                      showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"
                    }
                    onClick={() => setShowConfirmPassword((current) => !current)}
                  >
                    <IonIcon icon={showConfirmPassword ? eyeOffOutline : eyeOutline} />
                  </IonButton>
                </div>
              </label>

              {!passwordsMatch && confirmPassword && (
                <p className={styles.error} role="alert">
                  Las contraseñas no coinciden.
                </p>
              )}

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
                {isSubmitting ? <IonSpinner name="crescent" /> : "Crear cuenta"}
              </IonButton>
            </form>

            <div className={styles.footerPrompt}>
              <span>¿Ya tienes cuenta?</span>
              <IonButton routerLink="/login" fill="clear" className={styles.linkButton}>
                Iniciar sesión
              </IonButton>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default Register;
