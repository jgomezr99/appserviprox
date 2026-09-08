import React, { useEffect, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonMenuButton,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToggle,
  IonToolbar,
} from "@ionic/react";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { catalogService, professionalProfileService } from "../services/serviprox";
import type { ProfessionalProfile, Service, ServiceCategory } from "../types/serviprox";
import "./RolePages.css";

type OfferingDraft = {
  price_min: string;
  price_max: string;
  observaciones: string;
  years_experience: number;
};

const ProfessionalProfilePage: React.FC = () => {
  const { user, updateMe } = useAuth();
  const isProfessional = user?.role === "professional";
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accountCity, setAccountCity] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("es");
  const [displayName, setDisplayName] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("Bogotá");
  const [coverageRadiusKm, setCoverageRadiusKm] = useState(8);
  const [acceptsUrgent, setAcceptsUrgent] = useState(false);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [offerings, setOfferings] = useState<Record<number, OfferingDraft>>({});
  const [customCategory, setCustomCategory] = useState<number | "">("");
  const [customName, setCustomName] = useState("");
  const [customPriceMin, setCustomPriceMin] = useState("");
  const [customPriceMax, setCustomPriceMax] = useState("");
  const [customObservations, setCustomObservations] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name || "");
    setLastName(user.last_name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setAccountCity(user.city || "");
    if (!displayName) {
      setDisplayName([user.first_name, user.last_name].filter(Boolean).join(" ") || user.email);
    }
    if (!city && user.city) setCity(user.city);
  }, [user]);

  useEffect(() => {
    if (!isProfessional) {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.allSettled([
      catalogService.listCategories(),
      catalogService.listServices(),
      professionalProfileService.getMine(),
    ])
      .then(([categoryResult, serviceResult, profileResult]) => {
        if (!active) return;
        if (categoryResult.status === "fulfilled") setCategories(categoryResult.value);
        if (serviceResult.status === "fulfilled") setServices(serviceResult.value);
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
          setSelectedServices(currentProfile.services.map((service) => service.service));
          setOfferings(
            Object.fromEntries(
              currentProfile.services.map((service) => [
                service.service,
                {
                  price_min: service.price_min || "",
                  price_max: service.price_max || "",
                  observaciones: service.observaciones || "",
                  years_experience: service.years_experience || 0,
                },
              ])
            )
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isProfessional]);

  const toggleService = (serviceId: number) => {
    setSelectedServices((current) => {
      if (current.includes(serviceId)) {
        return current.filter((id) => id !== serviceId);
      }
      setOfferings((drafts) => ({
        ...drafts,
        [serviceId]: drafts[serviceId] || {
          price_min: "",
          price_max: "",
          observaciones: "",
          years_experience: 0,
        },
      }));
      return [...current, serviceId];
    });
  };

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

  const updateOffering = (serviceId: number, patch: Partial<OfferingDraft>) => {
    setOfferings((current) => ({
      ...current,
      [serviceId]: {
        price_min: current[serviceId]?.price_min || "",
        price_max: current[serviceId]?.price_max || "",
        observaciones: current[serviceId]?.observaciones || "",
        years_experience: current[serviceId]?.years_experience || 0,
        ...patch,
      },
    }));
  };

  const toggleDarkMode = () => {
    const nextValue = !darkMode;
    setDarkMode(nextValue);
    document.body.classList.toggle("dark", nextValue);
  };

  const handleAccountSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingAccount) return;
    setSavingAccount(true);
    setAccountError("");
    try {
      await updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        city: accountCity.trim(),
      });
      setToast("Datos personales actualizados");
    } catch {
      setAccountError("No pudimos guardar tus datos personales.");
    } finally {
      setSavingAccount(false);
    }
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
        service_offerings: selectedServices.map((serviceId) => ({
          service: serviceId,
          price_min: offerings[serviceId]?.price_min || null,
          price_max: offerings[serviceId]?.price_max || null,
          observaciones: offerings[serviceId]?.observaciones || "",
          years_experience: offerings[serviceId]?.years_experience || 0,
        })),
        custom_services:
          customCategory && customName.trim()
            ? [
                {
                  category: customCategory,
                  name: customName.trim(),
                  price_min: customPriceMin || null,
                  price_max: customPriceMax || null,
                  observaciones: customObservations.trim(),
                  years_experience: 0,
                },
              ]
            : [],
      };
      const nextProfile = profile
        ? await professionalProfileService.updateMine(payload)
        : await professionalProfileService.createMine(payload);
      setProfile(nextProfile);
      setSelectedServices(nextProfile.services.map((service) => service.service));
      setOfferings(
        Object.fromEntries(
          nextProfile.services.map((service) => [
            service.service,
            {
              price_min: service.price_min || "",
              price_max: service.price_max || "",
              observaciones: service.observaciones || "",
              years_experience: service.years_experience || 0,
            },
          ])
        )
      );
      setCustomCategory("");
      setCustomName("");
      setCustomPriceMin("");
      setCustomPriceMax("");
      setCustomObservations("");
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
          <IonTitle>Mi perfil</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">{isProfessional ? "PROFESIONAL" : "CLIENTE"}</span>
            <h1>Mi perfil</h1>
            <p>Gestiona tu información personal y los datos propios de tu rol en Serviprox.</p>
          </header>

          <section className="sp-card">
            <div className="sp-card-title">
              <h2>Información personal</h2>
              <p>Datos de contacto guardados en tu cuenta.</p>
            </div>
            <form className="sp-form sp-actions--spaced" onSubmit={handleAccountSubmit}>
              <div className="sp-grid sp-grid--two">
                <label className="sp-field">
                  Nombre
                  <IonInput
                    value={firstName}
                    onIonInput={(event) => setFirstName(String(event.detail.value ?? ""))}
                  />
                </label>
                <label className="sp-field">
                  Apellido
                  <IonInput
                    value={lastName}
                    onIonInput={(event) => setLastName(String(event.detail.value ?? ""))}
                  />
                </label>
              </div>
              <div className="sp-grid sp-grid--two">
                <label className="sp-field">
                  Email
                  <IonInput type="email" value={email} readonly />
                </label>
                <label className="sp-field">
                  Teléfono
                  <IonInput
                    type="tel"
                    value={phone}
                    onIonInput={(event) => setPhone(String(event.detail.value ?? ""))}
                  />
                </label>
              </div>
              <label className="sp-field">
                Ciudad
                <IonInput
                  value={accountCity}
                  onIonInput={(event) => setAccountCity(String(event.detail.value ?? ""))}
                />
              </label>
              {accountError ? <p className="sp-error">{accountError}</p> : null}
              <IonButton type="submit" className="sp-primary-button" disabled={savingAccount}>
                {savingAccount ? <IonSpinner name="crescent" /> : "Guardar información"}
              </IonButton>
            </form>
          </section>

          <section className="sp-card sp-actions--spaced">
            <div className="sp-card-title">
              <h2>Cuenta y seguridad</h2>
              <p>Preferencias locales de uso de la aplicación.</p>
            </div>
            <div className="sp-settings-list">
              <label>
                <span>Modo oscuro</span>
                <IonToggle checked={darkMode} onIonChange={toggleDarkMode} />
              </label>
              <label>
                <span>Notificaciones</span>
                <IonToggle
                  checked={notifications}
                  onIonChange={(event) => setNotifications(event.detail.checked)}
                />
              </label>
              <label>
                <span>Idioma</span>
                <IonSelect
                  value={language}
                  interface="popover"
                  onIonChange={(event) => setLanguage(event.detail.value)}
                >
                  <IonSelectOption value="es">Español</IonSelectOption>
                  <IonSelectOption value="en">English</IonSelectOption>
                </IonSelect>
              </label>
              <p className="sp-muted">Versión 1.0.0</p>
            </div>
          </section>

          {isProfessional ? (
            <section className="sp-card sp-actions--spaced">
              <div className="sp-card-title">
                <h2>Información profesional</h2>
                <p>Servicios, tarifas y cobertura visibles para clientes.</p>
              </div>
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
                    <p>Gestiona servicios concretos existentes del catálogo.</p>
                  </div>
                  <div className="sp-choice-list">
                    {services.map((service) => {
                      const selected = selectedServices.includes(service.id);
                      return (
                        <button
                          className={`sp-choice-card ${selected ? "is-selected" : ""}`}
                          type="button"
                          key={service.id}
                          onClick={() => toggleService(service.id)}
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
                </div>

                {selectedServices.length ? (
                  <div className="sp-list">
                    {selectedServices.map((serviceId) => (
                      <div className="sp-list-item" key={serviceId}>
                        <strong>{serviceNameById.get(serviceId) || `Servicio #${serviceId}`}</strong>
                        <div className="sp-grid sp-grid--three">
                          <label className="sp-field">
                            Tarifa mínima
                            <IonInput
                              type="number"
                              min="0"
                              value={offerings[serviceId]?.price_min || ""}
                              onIonInput={(event) =>
                                updateOffering(serviceId, {
                                  price_min: String(event.detail.value ?? ""),
                                })
                              }
                            />
                          </label>
                          <label className="sp-field">
                            Tarifa máxima
                            <IonInput
                              type="number"
                              min="0"
                              value={offerings[serviceId]?.price_max || ""}
                              onIonInput={(event) =>
                                updateOffering(serviceId, {
                                  price_max: String(event.detail.value ?? ""),
                                })
                              }
                            />
                          </label>
                          <label className="sp-field">
                            Años de experiencia
                            <IonInput
                              type="number"
                              min="0"
                              max="80"
                              value={offerings[serviceId]?.years_experience || 0}
                              onIonInput={(event) =>
                                updateOffering(serviceId, {
                                  years_experience: Number(event.detail.value || 0),
                                })
                              }
                            />
                          </label>
                        </div>
                        <label className="sp-field">
                          Observaciones
                          <IonTextarea
                            value={offerings[serviceId]?.observaciones || ""}
                            autoGrow
                            rows={2}
                            maxlength={280}
                            placeholder="Ejemplo: cobro $45.000 por metro cuadrado."
                            onIonInput={(event) =>
                              updateOffering(serviceId, {
                                observaciones: String(event.detail.value ?? ""),
                              })
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="sp-card">
                  <div className="sp-card-title">
                    <h2>Otro servicio</h2>
                    <p>Publica un servicio nuevo bajo una categoría existente.</p>
                  </div>
                  <div className="sp-grid sp-grid--two">
                    <label className="sp-field">
                      Categoría
                      <IonSelect
                        value={customCategory}
                        interface="popover"
                        onIonChange={(event) => setCustomCategory(event.detail.value)}
                      >
                        {categories.map((category) => (
                          <IonSelectOption value={category.id} key={category.id}>
                            {category.name}
                          </IonSelectOption>
                        ))}
                      </IonSelect>
                    </label>
                    <label className="sp-field">
                      Nombre del servicio
                      <IonInput
                        value={customName}
                        onIonInput={(event) =>
                          setCustomName(String(event.detail.value ?? ""))
                        }
                      />
                    </label>
                  </div>
                  <div className="sp-grid sp-grid--two">
                    <label className="sp-field">
                      Tarifa mínima
                      <IonInput
                        type="number"
                        min="0"
                        value={customPriceMin}
                        onIonInput={(event) =>
                          setCustomPriceMin(String(event.detail.value ?? ""))
                        }
                      />
                    </label>
                    <label className="sp-field">
                      Tarifa máxima
                      <IonInput
                        type="number"
                        min="0"
                        value={customPriceMax}
                        onIonInput={(event) =>
                          setCustomPriceMax(String(event.detail.value ?? ""))
                        }
                      />
                    </label>
                  </div>
                  <label className="sp-field">
                    Observaciones
                    <IonTextarea
                      value={customObservations}
                      autoGrow
                      rows={2}
                      maxlength={280}
                      placeholder="Ejemplo: instalación desde $45.000 por metro cuadrado."
                      onIonInput={(event) =>
                        setCustomObservations(String(event.detail.value ?? ""))
                      }
                    />
                  </label>
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
          ) : null}
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
