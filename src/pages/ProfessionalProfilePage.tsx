import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToggle,
  IonToolbar,
} from "@ionic/react";
import { ApiError } from "../services/api";
import { catalogService, professionalProfileService } from "../services/serviprox";
import type { ProfessionalProfile, ServiceCategory } from "../types/serviprox";
import "./RolePages.css";

const ProfessionalProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Bogotá");
  const [coverageRadiusKm, setCoverageRadiusKm] = useState(8);
  const [acceptsUrgent, setAcceptsUrgent] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      catalogService.listCategories(),
      professionalProfileService.getMine(),
    ])
      .then(([categoryResult, profileResult]) => {
        if (!active) return;
        if (categoryResult.status === "fulfilled") setCategories(categoryResult.value);
        if (profileResult.status === "fulfilled") {
          const currentProfile = profileResult.value;
          setProfile(currentProfile);
          setDisplayName(currentProfile.display_name);
          setHeadline(currentProfile.headline);
          setBio(currentProfile.bio);
          setNeighborhood(currentProfile.neighborhood);
          setCity(currentProfile.city);
          setCoverageRadiusKm(currentProfile.coverage_radius_km);
          setAcceptsUrgent(currentProfile.accepts_urgent);
          setSelectedCategories(currentProfile.services.map((service) => service.category));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!displayName.trim() || !headline.trim() || !city.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      const payload = {
        display_name: displayName.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        coverage_radius_km: coverageRadiusKm,
        accepts_urgent: acceptsUrgent,
        service_category_ids: selectedCategories,
      };
      const nextProfile = profile
        ? await professionalProfileService.updateMine(payload)
        : await professionalProfileService.createMine(payload);
      setProfile(nextProfile);
      setToast("Perfil profesional actualizado");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError("Revisa los campos requeridos y los servicios seleccionados.");
      } else {
        setError("No pudimos guardar tu perfil profesional.");
      }
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
          <IonTitle>Mi perfil profesional</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">PROFESIONAL</span>
            <h1>Perfil profesional</h1>
            <p>Actualiza la información pública con datos reales guardados en Django.</p>
          </header>

          <section className="sp-card">
            {loading ? (
              <div className="sp-route-loading">
                <IonSpinner name="crescent" />
                <span>Cargando perfil...</span>
              </div>
            ) : (
              <form className="sp-form" onSubmit={handleSubmit}>
                <label className="sp-field">
                  Nombre público
                  <IonInput
                    value={displayName}
                    onIonInput={(event) => setDisplayName(String(event.detail.value ?? ""))}
                  />
                </label>
                <label className="sp-field">
                  Especialidad principal
                  <IonInput
                    value={headline}
                    onIonInput={(event) => setHeadline(String(event.detail.value ?? ""))}
                  />
                </label>
                <label className="sp-field">
                  Descripción
                  <IonTextarea
                    value={bio}
                    autoGrow
                    onIonInput={(event) => setBio(String(event.detail.value ?? ""))}
                  />
                </label>
                <div className="sp-grid sp-grid--two">
                  <label className="sp-field">
                    Barrio base
                    <IonInput
                      value={neighborhood}
                      onIonInput={(event) => setNeighborhood(String(event.detail.value ?? ""))}
                    />
                  </label>
                  <label className="sp-field">
                    Ciudad
                    <IonInput
                      value={city}
                      onIonInput={(event) => setCity(String(event.detail.value ?? ""))}
                    />
                  </label>
                </div>
                <div className="sp-grid sp-grid--two">
                  <label className="sp-field">
                    Radio de cobertura aproximado (km)
                    <IonInput
                      type="number"
                      value={coverageRadiusKm}
                      onIonInput={(event) =>
                        setCoverageRadiusKm(Number(event.detail.value || 8))
                      }
                    />
                  </label>
                  <div className="sp-card">
                    <div className="sp-card-header">
                      <div className="sp-card-title">
                        <h2>Urgencias</h2>
                        <p>Aceptar solicitudes urgentes.</p>
                      </div>
                      <IonToggle
                        checked={acceptsUrgent}
                        onIonChange={(event) => setAcceptsUrgent(event.detail.checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="sp-card">
                  <div className="sp-card-title">
                    <h2>Servicios</h2>
                    <p>Gestiona categorías existentes del catálogo.</p>
                  </div>
                  <div className="sp-choice-list">
                    {categories.map((category) => {
                      const selected = selectedCategories.includes(category.id);
                      return (
                        <button
                          className={`sp-choice-card ${selected ? "is-selected" : ""}`}
                          type="button"
                          key={category.id}
                          onClick={() => toggleCategory(category.id)}
                        >
                          <span>
                            <strong>{category.name}</strong>
                            <small>{category.description}</small>
                          </span>
                          <span>{selected ? "Seleccionado" : "Agregar"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="sp-error">{error}</p>}

                <IonButton
                  type="submit"
                  className="sp-primary-button"
                  disabled={saving || !displayName.trim() || !headline.trim() || !city.trim()}
                >
                  {saving ? <IonSpinner name="crescent" /> : "Guardar perfil"}
                </IonButton>
              </form>
            )}
          </section>
        </main>
        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={1800}
          onDidDismiss={() => setToast("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default ProfessionalProfilePage;
