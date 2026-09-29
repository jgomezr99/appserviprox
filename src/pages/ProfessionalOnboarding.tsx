import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonContent,
  IonInput,
  IonPage,
  IonSpinner,
  IonTextarea,
  IonToggle,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ApiError } from "../services/api";
import { catalogService, professionalProfileService } from "../services/serviprox";
import { useAuth } from "../context/AuthContext";
import type { Service, ServiceCategory } from "../types/serviprox";
import "./RolePages.css";

const ProfessionalOnboarding: React.FC = () => {
  const history = useHistory();
  const { user, updateMe, completeOnboarding } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "Bogotá");
  const [displayName, setDisplayName] = useState(
    user?.first_name ? `${user.first_name} ${user.last_name}`.trim() : ""
  );
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [coverageRadiusKm, setCoverageRadiusKm] = useState(8);
  const [acceptsUrgent, setAcceptsUrgent] = useState(false);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      catalogService.listCategories(),
      catalogService.listServices(),
      professionalProfileService.getMine(),
    ])
      .then(([categoryResult, serviceResult, profileResult]) => {
        if (!active) return;
        if (categoryResult.status === "fulfilled") {
          setCategories(categoryResult.value);
        }
        if (serviceResult.status === "fulfilled") {
          setServices(serviceResult.value);
        }
        if (profileResult.status === "fulfilled") {
          const profile = profileResult.value;
          setProfileExists(true);
          setDisplayName(profile.display_name);
          setHeadline(profile.headline);
          setBio(profile.bio);
          setNeighborhood(profile.neighborhood);
          setCity(profile.city);
          setCoverageRadiusKm(profile.coverage_radius_km);
          setAcceptsUrgent(profile.accepts_urgent);
          setSelectedServices(profile.services.map((service) => service.service));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleService = (serviceId: number) => {
    setSelectedServices((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
  };

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    phone.trim() &&
    city.trim() &&
    displayName.trim() &&
    headline.trim() &&
    selectedServices.length > 0 &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setError("");
    setSaving(true);
    try {
      await updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        city: city.trim(),
      });

      const payload = {
        display_name: displayName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        coverage_radius_km: coverageRadiusKm,
        accepts_urgent: acceptsUrgent,
        service_ids: selectedServices,
      };

      if (profileExists) {
        await professionalProfileService.updateMine(payload);
      } else {
        await professionalProfileService.createMine(payload);
      }

      await completeOnboarding();
      history.replace("/profesional/inicio");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError("Revisa la información requerida antes de continuar.");
      } else {
        setError("No pudimos guardar tu perfil profesional. Inténtalo nuevamente.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <div className="sp-progress" aria-label="Paso 2 de 4">
            <span className="is-active" />
            <span className="is-active" />
            <span />
            <span />
          </div>

          <header className="sp-role-header">
            <span className="sp-role-kicker">PROFESIONAL</span>
            <h1>Configura tu perfil profesional</h1>
            <p>
              Completa la información que Serviprox puede guardar hoy: datos básicos,
              perfil público, servicios y cobertura general.
            </p>
          </header>

          <section className="sp-card">
            {loading ? (
              <div className="sp-route-loading">
                <IonSpinner name="crescent" />
                <span>Cargando catálogo...</span>
              </div>
            ) : (
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

                <label className="sp-field">
                  Nombre público
                  <IonInput
                    value={displayName}
                    placeholder="Ej: Reparaciones Juan Pérez"
                    onIonInput={(event) => setDisplayName(String(event.detail.value ?? ""))}
                  />
                </label>

                <label className="sp-field">
                  Especialidad principal
                  <IonInput
                    value={headline}
                    placeholder="Ej: Plomería residencial y mantenimiento"
                    onIonInput={(event) => setHeadline(String(event.detail.value ?? ""))}
                  />
                </label>

                <label className="sp-field">
                  Descripción
                  <IonTextarea
                    value={bio}
                    autoGrow
                    placeholder="Cuenta brevemente qué haces y cómo atiendes servicios del hogar."
                    onIonInput={(event) => setBio(String(event.detail.value ?? ""))}
                  />
                </label>

                <div className="sp-grid sp-grid--two">
                  <label className="sp-field">
                    Barrio base
                    <IonInput
                      value={neighborhood}
                      placeholder="Ej: Chapinero"
                      onIonInput={(event) => setNeighborhood(String(event.detail.value ?? ""))}
                    />
                  </label>
                  <label className="sp-field">
                    Radio de cobertura aproximado (km)
                    <IonInput
                      type="number"
                      min="1"
                      max="50"
                      value={coverageRadiusKm}
                      onIonInput={(event) =>
                        setCoverageRadiusKm(Number(event.detail.value || 8))
                      }
                    />
                  </label>
                </div>

                <div className="sp-card">
                  <div className="sp-card-header">
                    <div className="sp-card-title">
                      <h2>Servicios que ofreces</h2>
                      <p>Selecciona servicios reales del catálogo Serviprox.</p>
                    </div>
                  </div>

                  {services.length ? (
                    <div className="sp-choice-list">
                      {services.map((service) => {
                        const selected = selectedServices.includes(service.id);
                        return (
                          <button
                            className={`sp-choice-card ${selected ? "is-selected" : ""}`}
                            type="button"
                            key={service.id}
                            onClick={() => toggleService(service.id)}
                            aria-pressed={selected}
                          >
                            <span>
                              <strong>{service.name}</strong>
                              <small>{categoryNameById.get(service.category) || service.category_slug}</small>
                            </span>
                            <span>{selected ? "Seleccionado" : "Agregar"}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="sp-empty">
                      Carga el catálogo en Django para seleccionar servicios reales.
                    </div>
                  )}
                </div>

                <div className="sp-card">
                  <div className="sp-card-header">
                    <div className="sp-card-title">
                      <h2>Disponibilidad inicial</h2>
                      <p>La agenda por franjas se configurará en un siguiente Sprint.</p>
                    </div>
                    <IonToggle
                      checked={acceptsUrgent}
                      onIonChange={(event) => setAcceptsUrgent(event.detail.checked)}
                    />
                  </div>
                  <p className="sp-muted">Acepto solicitudes urgentes cuando esté disponible.</p>
                </div>

                {error && <p className="sp-error">{error}</p>}

                <div className="sp-actions">
                  <IonButton
                    type="submit"
                    className="sp-primary-button"
                    disabled={!canSubmit}
                  >
                    {saving ? <IonSpinner name="crescent" /> : "Completar perfil"}
                  </IonButton>
                </div>
              </form>
            )}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default ProfessionalOnboarding;
