import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToggle,
  IonToolbar,
} from "@ionic/react";
import {
  businessOutline,
  calendarClearOutline,
  callOutline,
  checkmarkCircleOutline,
  closeOutline,
  createOutline,
  homeOutline,
  locationOutline,
  mailOutline,
  mapOutline,
  moonOutline,
  personCircleOutline,
  saveOutline,
} from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { householdService } from "../services/serviprox";
import type { Household } from "../types/serviprox";
import "./RolePages.css";

const ClientHome: React.FC = () => {
  const { user, updateMe } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loadingHousehold, setLoadingHousehold] = useState(true);

  // Estados de edición del perfil de cliente
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "Bogotá");
  const [address, setAddress] = useState(user?.address || "");
  const [documentId, setDocumentId] = useState(user?.document_id || "");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [darkMode, setDarkMode] = useState(() => document.body.classList.contains("dark"));

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  const toggleDarkMode = () => {
    const nextValue = !darkMode;
    setDarkMode(nextValue);
    document.body.classList.toggle("dark", nextValue);
  };

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setPhone(user.phone || "");
      setCity(user.city || "Bogotá");
      setAddress(user.address || "");
      setDocumentId(user.document_id || "");
    }
  }, [user]);

  const loadPrimaryHousehold = async () => {
    setLoadingHousehold(true);
    try {
      const list = await householdService.list();
      const primary = list.find((h) => h.is_default) || list[0] || null;
      setHousehold(primary);
      if (primary && !address && primary.address_line) {
        setAddress(primary.address_line);
      }
    } catch (err) {
      console.warn("No se pudieron cargar las viviendas:", err);
    } finally {
      setLoadingHousehold(false);
    }
  };

  useEffect(() => {
    void loadPrimaryHousehold();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setSaveSuccess(false);
    try {
      await updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        address: address.trim(),
        document_id: documentId.trim(),
      });
      setSaveSuccess(true);
      setToastMessage("¡Datos del cliente guardados con éxito en la base de datos!");
      setIsEditing(false);
      await loadPrimaryHousehold();
    } catch {
      setToastMessage("Hubo un error al guardar los datos en la base de datos.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Mi perfil de cliente</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">CUENTA DE CLIENTE</span>
            <h1>Bienvenido, {fullName || "Cliente"}</h1>
            <p>Consulta, edita y administra tu información registrada en la base de datos.</p>
          </header>

          {/* Tarjeta de Datos Personales con Modo Edición */}
          <section className="sp-card">
            <div className="sp-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="sp-icon-tile">
                  <IonIcon icon={personCircleOutline} aria-hidden="true" />
                </div>
                <div className="sp-card-title">
                  <h2>Datos del cliente</h2>
                  <p>{user?.onboarding_completed ? "Perfil verificado en base de datos" : "Perfil activo"}</p>
                </div>
              </div>
             
            </div>

            

            {saveSuccess && (
              <div className="sp-alert-success" style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "8px", color: "var(--ion-color-success)" }}>
                <IonIcon icon={checkmarkCircleOutline} />
                <span>¡Datos guardados con éxito en la base de datos!</span>
              </div>
            )}

            {isEditing ? (
              <form className="sp-form" onSubmit={handleSaveProfile} style={{ marginTop: "1rem" }}>
                <div className="sp-grid sp-grid--two">
                  <label className="sp-field">
                    Nombre
                    <IonInput
                      value={firstName}
                      placeholder="Tu nombre"
                      onIonInput={(e) => setFirstName(String(e.detail.value ?? ""))}
                    />
                  </label>
                  <label className="sp-field">
                    Apellido
                    <IonInput
                      value={lastName}
                      placeholder="Tu apellido"
                      onIonInput={(e) => setLastName(String(e.detail.value ?? ""))}
                    />
                  </label>
                </div>

                <div className="sp-grid sp-grid--two">
                  <label className="sp-field">
                    Teléfono de contacto
                    <IonInput
                      type="tel"
                      value={phone}
                      placeholder="Ej. +57 300 123 4567"
                      onIonInput={(e) => setPhone(String(e.detail.value ?? ""))}
                    />
                  </label>
                  <label className="sp-field">
                    Cédula / Documento (C.C.)
                    <IonInput
                      value={documentId}
                      placeholder="Ej. CC 1020304050"
                      onIonInput={(e) => setDocumentId(String(e.detail.value ?? ""))}
                    />
                  </label>
                </div>

                <div className="sp-grid sp-grid--two">
                  <label className="sp-field">
                    Ciudad
                    <IonInput
                      value={city}
                      placeholder="Ej. Bogotá"
                      onIonInput={(e) => setCity(String(e.detail.value ?? ""))}
                    />
                  </label>
                  <label className="sp-field">
                    Dirección principal (Hogar)
                    <IonInput
                      value={address}
                      placeholder="Ej. Calle 123 # 45-67"
                      onIonInput={(e) => setAddress(String(e.detail.value ?? ""))}
                    />
                  </label>
                </div>

                <div style={{ marginTop: "1rem", display: "flex", gap: "10px" }}>
                  <IonButton type="submit" disabled={saving}>
                    {saving ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={saveOutline} /> Guardar en base de datos</>}
                  </IonButton>
                  <IonButton fill="clear" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </IonButton>
                </div>
              </form>
            ) : (
              <IonList lines="full" className="sp-profile-list" style={{ marginTop: "0.5rem" }}>
                <IonItem>
                  <IonIcon slot="start" icon={mailOutline} aria-hidden="true" />
                  <IonLabel>
                    <strong>Correo electrónico</strong><br />
                    <span>{user?.email || "No registrado"}</span>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonIcon slot="start" icon={callOutline} aria-hidden="true" />
                  <IonLabel>
                    <strong>Teléfono</strong><br />
                    <span>{user?.phone || "No registrado"}</span>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonIcon slot="start" icon={locationOutline} aria-hidden="true" />
                  <IonLabel>
                    <strong>Ciudad</strong><br />
                    <span>{user?.city || "No registrada"}</span>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonIcon slot="start" icon={homeOutline} aria-hidden="true" />
                  <IonLabel>
                    <strong>Dirección principal</strong><br />
                    <span>{user?.address || household?.address_line || "No registrada"}</span>
                  </IonLabel>
                </IonItem>
              </IonList>
            )}
          </section>

          {/* Tarjeta de Vivienda Principal en Base de Datos */}
          <section className="sp-card">
            <div className="sp-card-header">
              <div className="sp-icon-tile">
                <IonIcon icon={homeOutline} aria-hidden="true" />
              </div>
              <div className="sp-card-title">
                <h2>Vivienda registrada para servicios</h2>
                <p>Dirección donde los contratistas te ubicarán en el mapa.</p>
              </div>
            </div>

            {loadingHousehold ? (
              <div style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <IonSpinner name="crescent" />
                <span>Cargando datos de vivienda...</span>
              </div>
            ) : household ? (
              <div style={{ padding: "0.5rem 1rem" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>{household.label}</strong> ({household.property_type === "apartment" ? "Apartamento" : "Casa"})
                </p>
                <p style={{ margin: "4px 0", color: "var(--ion-color-medium)" }}>
                  {household.address_line || "Sin dirección definida"} · {household.neighborhood || household.city}
                </p>
                <div style={{ marginTop: "0.8rem" }}>
                  <IonButton routerLink="/cliente/viviendas" fill="outline" size="small">
                    <IonIcon slot="start" icon={businessOutline} />
                    Gestionar mis viviendas
                  </IonButton>
                </div>
              </div>
            ) : (
              <div style={{ padding: "1rem" }}>
                <p style={{ color: "var(--ion-color-medium)" }}>Aún no tienes una vivienda registrada en la base de datos.</p>
                <IonButton routerLink="/cliente/viviendas" size="small">
                  Crear vivienda ahora
                </IonButton>
              </div>
            )}
          </section>

          {/* Enlaces de Acción Rápida */}
          <section className="sp-grid sp-grid--two sp-home-actions">
            <a className="sp-card sp-home-link" href="/cliente/mapa">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <IonIcon icon={mapOutline} style={{ fontSize: "1.3rem" }} />
                <h2>Mapa de contratistas</h2>
              </div>
              <p>Ubica profesionales activos y disponibles cerca a tu ubicación.</p>
            </a>
            <a className="sp-card sp-home-link" href="/cliente/servicios">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <IonIcon icon={homeOutline} style={{ fontSize: "1.3rem" }} />
                <h2>Buscar un servicio</h2>
              </div>
              <p>Solicita plomería, electricidad, cerrajería y más para tu hogar.</p>
            </a>
            <a className="sp-card sp-home-link" href="/cliente/solicitudes">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <IonIcon icon={calendarClearOutline} style={{ fontSize: "1.3rem" }} />
                <h2>Mis solicitudes</h2>
              </div>
              <p>Revisa el historial y estado de servicios agendados en la base de datos.</p>
            </a>
            <a className="sp-card sp-home-link" href="/cliente/viviendas">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <IonIcon icon={businessOutline} style={{ fontSize: "1.3rem" }} />
                <h2>Mis viviendas</h2>
              </div>
              <p>Administra los inmuebles registrados para tus solicitudes.</p>
            </a>
          </section>
        </main>
      </IonContent>

      <IonToast
        isOpen={!!toastMessage}
        message={toastMessage}
        duration={3500}
        color={saveSuccess ? "success" : "danger"}
        onDidDismiss={() => setToastMessage("")}
      />
    </IonPage>
  );
};

export default ClientHome;
