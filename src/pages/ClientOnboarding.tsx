import React, { useState } from "react";
import {
  IonButton,
  IonContent,
  IonInput,
  IonPage,
  IonSpinner,
  IonText,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./RolePages.css";

const ClientOnboarding: React.FC = () => {
  const history = useHistory();
  const { user, updateMe, completeOnboarding } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "Bogotá");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit =
    firstName.trim() && lastName.trim() && phone.trim() && city.trim() && !saving;

  const saveClientOnboarding = async () => {
    await updateMe({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone: phone.trim(),
      city: city.trim(),
    });
    await completeOnboarding();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError("");
    setSaving(true);
    try {
      await saveClientOnboarding();
      history.replace("/cliente/inicio");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError("Completa los datos básicos antes de continuar.");
      } else {
        setError("No pudimos guardar tu onboarding. Inténtalo nuevamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddHousehold = async () => {
    if (!canSubmit) return;
    setError("");
    setSaving(true);
    try {
      await saveClientOnboarding();
      history.replace("/cliente/viviendas");
    } catch {
      setError("No pudimos guardar tus datos antes de crear la vivienda.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <div className="sp-progress" aria-label="Paso 1 de 2">
            <span className="is-active" />
            <span />
          </div>

          <header className="sp-role-header">
            <span className="sp-role-kicker">CLIENTE</span>
            <h1>Preparemos tu experiencia de hogar</h1>
            <p>
              Completa tus datos básicos. Podrás agregar tus viviendas ahora o después.
            </p>
          </header>

          <section className="sp-card">
            <form className="sp-form" onSubmit={handleSubmit}>
              <div className="sp-grid sp-grid--two">
                <label className="sp-field">
                  Nombre
                  <IonInput
                    value={firstName}
                    autocomplete="given-name"
                    onIonInput={(event) => setFirstName(String(event.detail.value ?? ""))}
                  />
                </label>
                <label className="sp-field">
                  Apellido
                  <IonInput
                    value={lastName}
                    autocomplete="family-name"
                    onIonInput={(event) => setLastName(String(event.detail.value ?? ""))}
                  />
                </label>
              </div>

              <div className="sp-grid sp-grid--two">
                <label className="sp-field">
                  Teléfono
                  <IonInput
                    type="tel"
                    value={phone}
                    autocomplete="tel"
                    onIonInput={(event) => setPhone(String(event.detail.value ?? ""))}
                  />
                </label>
                <label className="sp-field">
                  Ciudad
                  <IonInput
                    value={city}
                    autocomplete="address-level2"
                    onIonInput={(event) => setCity(String(event.detail.value ?? ""))}
                  />
                </label>
              </div>

              {error && (
                <IonText color="danger">
                  <p className="sp-error">{error}</p>
                </IonText>
              )}

              <div className="sp-actions">
                <IonButton
                  type="submit"
                  className="sp-primary-button"
                  disabled={!canSubmit}
                >
                  {saving ? <IonSpinner name="crescent" /> : "Completar onboarding"}
                </IonButton>
                <IonButton
                  type="button"
                  fill="outline"
                  className="sp-outline-button"
                  disabled={!canSubmit}
                  onClick={handleAddHousehold}
                >
                  Agregar vivienda
                </IonButton>
                <IonButton type="submit" fill="clear" disabled={!canSubmit}>
                  Lo haré después
                </IonButton>
              </div>
            </form>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default ClientOnboarding;
