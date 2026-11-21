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
  callOutline,
  cardOutline,
  chatbubblesOutline,
  checkmarkCircleOutline,
  eyeOffOutline,
  eyeOutline,
  homeOutline,
  locationOutline,
  lockClosedOutline,
  mailOutline,
  personOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { PublicRegisterRole } from "../types/serviprox";
import { getEntryRoute } from "../utils/routes";
import logo from "../Assets/logo.png";
import styles from "./Login.module.css";
import { usePlatformSettings } from "../services/platformSettings";
import { LiveSupportChatModal } from "../components/pqr/LiveSupportChatModal";

const emailOk = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

const MAX_CERTIFICATE_BYTES = 5 * 1024 * 1024;
const CERTIFICATE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const slugPart = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const buildUsername = (firstName: string, lastName: string) => {
  const base = [slugPart(firstName), slugPart(lastName)].filter(Boolean).join(".");
  return base.length >= 3 ? base : `${base}user`;
};

const getApiFieldMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return "";
  const rec = payload as Record<string, unknown>;
  if (typeof rec.detail === "string" && rec.detail.trim()) return rec.detail;
  const entries = Object.entries(rec);
  const first = entries.find(([, value]) => Array.isArray(value) || typeof value === "string");
  if (!first) return "";
  const [field, value] = first;
  const message = Array.isArray(value) ? String(value[0]) : String(value);
  const labels: Record<string, string> = {
    email: "Correo",
    username: "Usuario",
    password: "Contraseña",
    confirm_password: "Confirmar contraseña",
    role: "Tipo de cuenta",
    profession: "Profesión",
    certificate: "Certificado",
  };
  return `${labels[field] || field}: ${message}`;
};

const getRegisterErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    return getApiFieldMessage(error.payload) || "No pudimos crear la cuenta.";
  }
  if (error instanceof TypeError) {
    return "No pudimos conectar con Serviprox. Revisa que el servidor esté disponible.";
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
    title: "Cliente (Perfil)",
    text: "Busca profesionales, gestiona tu hogar y crea solicitudes.",
    icon: homeOutline,
  },
  {
    value: "professional",
    title: "Profesional",
    text: "Ofrece tus servicios, recibe solicitudes y gestiona tus ingresos.",
    icon: briefcaseOutline,
  },
];

const Register: React.FC = () => {
  const history = useHistory();
  const { isAuthenticated, isLoading: sessionLoading, register, user } = useAuth();
  const platform = usePlatformSettings();
  const registrationClosed = platform.features.new_users === false || platform.features.maintenance;
  const professionalsOpen = platform.features.professionals !== false;
  const visibleRoleOptions = roleOptions.filter((option) => option.value !== "professional" || professionalsOpen);

  const [role, setRole] = useState<PublicRegisterRole>("client");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Bogotá");
  const [documentId, setDocumentId] = useState("");
  const [address, setAddress] = useState("");
  const [profession, setProfession] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [certificateError, setCertificateError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [registerChatOpen, setRegisterChatOpen] = useState(false);

  const pickCertificate = (file: File | null) => {
    setCertificateError("");
    if (file && !CERTIFICATE_TYPES.includes(file.type)) {
      setCertificateError("El certificado debe ser un archivo PDF, JPG, PNG o WEBP.");
      setCertificate(null);
      return;
    }
    if (file && file.size > MAX_CERTIFICATE_BYTES) {
      setCertificateError("El certificado no puede superar 5 MB.");
      setCertificate(null);
      return;
    }
    setCertificate(file);
  };

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) {
      history.replace(getEntryRoute(user));
    }
  }, [history, isAuthenticated, sessionLoading, user]);

  useEffect(() => {
    const targetClass = role === "professional" ? "theme-professional" : "theme-client";
    document.documentElement.classList.remove("theme-client", "theme-professional");
    document.body.classList.remove("theme-client", "theme-professional");
    document.documentElement.classList.add(targetClass);
    document.body.classList.add(targetClass);
    document.documentElement.setAttribute("data-theme", role);
    document.body.setAttribute("data-theme", role);
  }, [role]);

  useEffect(() => {
    if (!professionalsOpen && role === "professional") setRole("client");
  }, [professionalsOpen, role]);

  const passwordsMatch = password === confirmPassword;

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || registrationClosed) return;

    if (!firstName.trim()) {
      setError("Por favor ingresa tu nombre.");
      return;
    }
    if (!lastName.trim()) {
      setError("Por favor ingresa tu apellido.");
      return;
    }
    if (!emailOk(email)) {
      setError("Por favor ingresa un correo electrónico válido.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!passwordsMatch) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!phone.trim()) {
      setError("Por favor ingresa tu número de teléfono.");
      return;
    }
    if (!city.trim()) {
      setError("Por favor ingresa tu ciudad.");
      return;
    }
    if (!documentId.trim()) {
      setError("Por favor ingresa tu cédula o documento.");
      return;
    }
    if (!address.trim()) {
      setError("Por favor ingresa la dirección del inmueble.");
      return;
    }
    if (role === "professional" && profession.trim().length < 3) {
      setError("Por favor indica tu profesión u oficio (mínimo 3 caracteres).");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const baseUsername = buildUsername(firstName, lastName);
      const payload = {
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        document_id: documentId.trim(),
        address: address.trim(),
        role,
        password,
        confirm_password: confirmPassword,
        ...(role === "professional"
          ? {
              profession: profession.trim(),
              ...(certificate ? { certificate } : {}),
            }
          : {}),
      };
      const currentUser = await register({ ...payload, username: baseUsername });
      history.replace(getEntryRoute(currentUser));
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
              <h1>Crea tu cuenta de Cliente o Profesional.</h1>
              <p className={styles.brandCopy}>
                Completa el formulario o crea tu cuenta en segundos conversando con nuestro chat guiado.
              </p>
            </IonText>
          </section>

          <section className={styles.authCard} aria-labelledby="register-title">
            <div className={styles.formHeader}>
              <span className={styles.cardEyebrow}>CREAR CUENTA</span>
              <h2 id="register-title">Empieza en Serviprox</h2>
              <p>
                Selecciona si eres Cliente (Perfil) o Profesional y completa todos tus datos en este formulario.
              </p>
            </div>

            {registrationClosed && (
              <p
                role="alert"
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: 12,
                  padding: "12px 14px",
                  fontWeight: 600,
                }}
              >
                {platform.features.maintenance
                  ? platform.maintenance_message
                  : "El registro de nuevos usuarios está deshabilitado por el momento."}
              </p>
            )}

            <form
              className={styles.form}
              onSubmit={handleRegister}
              noValidate
              style={registrationClosed ? { display: "none" } : undefined}
            >
              <fieldset className={styles.roleGroup}>
                <legend>Tipo de cuenta</legend>
                {visibleRoleOptions.map((option) => {
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
                      required
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
                      required
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

              <div className={styles.twoColumn}>
                <label className={styles.field}>
                  <span>Teléfono</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={callOutline} aria-hidden="true" />
                    <IonInput
                      type="tel"
                      value={phone}
                      autocomplete="tel"
                      placeholder="+57 300 000 0000"
                      onIonInput={(event) => setPhone(String(event.detail.value ?? ""))}
                      required
                    />
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Ciudad</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={locationOutline} aria-hidden="true" />
                    <IonInput
                      value={city}
                      autocomplete="address-level2"
                      placeholder="Bogotá"
                      onIonInput={(event) => setCity(String(event.detail.value ?? ""))}
                      required
                    />
                  </div>
                </label>
              </div>

              <div className={styles.twoColumn}>
                <label className={styles.field}>
                  <span>Cédula / documento</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={cardOutline} aria-hidden="true" />
                    <IonInput
                      value={documentId}
                      placeholder="Ej: 1020345678"
                      onIonInput={(event) => setDocumentId(String(event.detail.value ?? ""))}
                      required
                    />
                  </div>
                </label>

                <label className={styles.field}>
                  <span>Dirección del inmueble</span>
                  <div className={styles.inputShell}>
                    <IonIcon icon={homeOutline} aria-hidden="true" />
                    <IonInput
                      value={address}
                      placeholder="Ej: Calle 72 # 11-45, Chapinero"
                      onIonInput={(event) => setAddress(String(event.detail.value ?? ""))}
                      required
                    />
                  </div>
                </label>
              </div>

              {role === "professional" && (
                <>
                  <label className={styles.field}>
                    <span>Profesión u oficio</span>
                    <div className={styles.inputShell}>
                      <IonIcon icon={briefcaseOutline} aria-hidden="true" />
                      <IonInput
                        value={profession}
                        maxlength={120}
                        placeholder="Ej: Electricista, Plomero, Técnico en aires"
                        onIonInput={(event) => setProfession(String(event.detail.value ?? ""))}
                        required
                      />
                    </div>
                  </label>

                  <label className={styles.field}>
                    <span>Certificado profesional (opcional — PDF, JPG o PNG, máx. 5 MB)</span>
                    <input
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) => pickCertificate(event.target.files?.[0] ?? null)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "14px",
                        border: "1px dashed #cbd5e1",
                        background: "#f8fafc",
                        fontSize: "0.86rem",
                        color: "#334155",
                      }}
                    />
                    {certificate && <small>Archivo seleccionado: {certificate.name}</small>}
                  </label>
                  {certificateError && (
                    <p className={styles.error} role="alert">
                      {certificateError}
                    </p>
                  )}
                </>
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
                disabled={isSubmitting}
              >
                {isSubmitting ? <IonSpinner name="crescent" /> : "Crear cuenta"}
              </IonButton>

              {platform.features.chat !== false && (
                <button
                  type="button"
                  id="btn-register-create-chat"
                  onClick={() => setRegisterChatOpen(true)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    padding: "13px 16px",
                    borderRadius: "16px",
                    background: "#fff1f2",
                    border: "1.5px solid #fecdd3",
                    color: "#e11d48",
                    fontWeight: 800,
                    fontSize: "0.94rem",
                    cursor: "pointer",
                    marginTop: "2px",
                  }}
                >
                  <IonIcon icon={chatbubblesOutline} style={{ fontSize: "20px" }} aria-hidden="true" />
                  <span>Crear cuenta por el chat (Cliente o Profesional)</span>
                </button>
              )}
            </form>

            <div className={styles.footerPrompt} style={{ marginTop: "16px" }}>
              <span>¿Ya tienes cuenta?</span>
              <IonButton routerLink="/login" fill="clear" className={styles.linkButton}>
                Iniciar sesión
              </IonButton>
            </div>
          </section>
        </main>
      </IonContent>

      <LiveSupportChatModal
        isOpen={registerChatOpen}
        onClose={() => setRegisterChatOpen(false)}
        initialFlow="crear_cuenta"
      />
    </IonPage>
  );
};

export default Register;
