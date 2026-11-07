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
    if (!user) return;
    if (!firstName && user.first_name) setFirstName(user.first_name);
    if (!lastName && user.last_name) setLastName(user.last_name);
    if (!phone && user.phone) setPhone(user.phone);
    if ((!city || city === "Bogotá") && user.city) setCity(user.city);
    if (!displayName && user.first_name) {
      setDisplayName(`${user.first_name} ${user.last_name || ""}`.trim());
    }
  }, [user]);

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
          setDisplayName(profile.display_name || "");
          setHeadline(profile.headline || "");
          setBio(profile.bio || "");
          setNeighborhood(profile.neighborhood || "");
          setCity(profile.city || user?.city || "Bogotá");
          setCoverageRadiusKm(profile.coverage_radius_km || 8);
          setAcceptsUrgent(profile.accepts_urgent || false);
          setSelectedServices(profile.services?.map((service) => service.service) || []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const toggleService = (serviceId: number) => {
    setSelectedServices((current) =>
      current.includes(serviceId)
        ? current.filter((id) => id !== serviceId)
        : [...current, serviceId]
    );
  };

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  const validateForm = () => {
    if (!firstName.trim()) return "Por favor ingresa tu nombre.";
    if (!lastName.trim()) return "Por favor ingresa tu apellido.";
    if (!phone.trim()) return "Por favor ingresa tu número de teléfono.";
    if (!city.trim()) return "Por favor ingresa tu ciudad.";
    if (!displayName.trim()) return "Por favor ingresa tu nombre público profesional.";
    if (!headline.trim()) return "Por favor ingresa tu especialidad principal.";
    if (selectedServices.length === 0) return "Por favor selecciona al menos un servicio del catálogo.";
    return null;
  };

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
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

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
        neighborhood: neighborhood.trim() || "Bogotá",
        city: city.trim(),
        coverage_radius_km: coverageRadiusKm,
        accepts_urgent: acceptsUrgent,
        service_ids: selectedServices,
      };

      try {
        if (profileExists) {
          await professionalProfileService.updateMine(payload);
        } else {
          await professionalProfileService.createMine(payload);
        }
      } catch (profileErr) {
        // Respaldo de alternancia: si el perfil ya existía o se creó en backend, usar el otro método
        if (profileErr instanceof ApiError) {
          if (profileExists) {
            await professionalProfileService.createMine(payload);
          } else {
            await professionalProfileService.updateMine(payload);
          }
        } else {
          throw profileErr;
        }
      }

      await completeOnboarding();
      history.replace("/profesional/inicio");
    } catch (err) {
      if (err instanceof ApiError) {
        const payload = err.payload as Record<string, unknown> | undefined;
        let detail = "";
        if (payload && typeof payload === "object") {
          if (Array.isArray(payload.missing) && payload.missing.length > 0) {
            const labels: Record<string, string> = {
              first_name: "Nombre",
              last_name: "Apellido",
              phone: "Teléfono",
              city: "Ciudad",
              display_name: "Nombre público",
              headline: "Especialidad principal",
              services: "Al menos un servicio del catálogo",
            };
            const missingLabels = payload.missing.map((k) => labels[String(k)] || String(k));
            detail = `Falta completar: ${missingLabels.join(", ")}.`;
          } else if (payload.detail) {
            detail = String(payload.detail);
          } else {
            const firstEntry = Object.entries(payload)[0];
            if (firstEntry) {
              const [k, v] = firstEntry;
              const msg = Array.isArray(v) ? String(v[0]) : String(v);
              detail = `${k}: ${msg}`;
            }
          }
        }
        setError(detail || err.message || "Revisa la información requerida antes de continuar.");
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
