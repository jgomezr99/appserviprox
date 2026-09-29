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
  IonToolbar,
} from "@ionic/react";
import { householdService } from "../services/serviprox";
import type { Household, HouseholdPayload } from "../types/serviprox";
import "./RolePages.css";

const emptyForm: HouseholdPayload = {
  label: "Mi hogar",
  property_type: "apartment",
  address_line: "",
  neighborhood: "",
  city: "Bogotá",
  country: "Colombia",
  area_m2: null,
  build_year: null,
  notes: "",
  is_default: false,
};

const HouseholdsPage: React.FC = () => {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [form, setForm] = useState<HouseholdPayload>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const loadHouseholds = async () => {
    setLoading(true);
    setError("");
    try {
      setHouseholds(await householdService.list());
    } catch {
      setError("No pudimos cargar tus viviendas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHouseholds();
  }, []);

  const updateForm = <K extends keyof HouseholdPayload>(key: K, value: HouseholdPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const editHousehold = (household: Household) => {
    setEditingId(household.id);
    setForm({
      label: household.label,
      property_type: household.property_type,
      address_line: household.address_line,
      neighborhood: household.neighborhood,
      city: household.city,
      country: household.country,
      area_m2: household.area_m2,
      build_year: household.build_year,
      notes: household.notes,
      is_default: household.is_default,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.label.trim() || !form.city.trim() || saving) return;

    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await householdService.update(editingId, form);
        setToast("Vivienda actualizada");
      } else {
        await householdService.create(form);
        setToast("Vivienda creada");
      }
      resetForm();
      await loadHouseholds();
    } catch {
      setError("No pudimos guardar la vivienda.");
    } finally {
      setSaving(false);
    }
  };

  const removeHousehold = async (id: number) => {
    setSaving(true);
    setError("");
    try {
      await householdService.remove(id);
      setToast("Vivienda eliminada");
      await loadHouseholds();
    } catch {
      setError("No pudimos eliminar la vivienda.");
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
          <IonTitle>Mis viviendas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">CLIENTE</span>
            <h1>Ubicaciones de servicio</h1>
            <p>
              Guarda las viviendas donde necesitas servicios. Las coordenadas quedarán
              pendientes hasta incorporar selector de dirección, mapa o geocoding.
            </p>
          </header>

          <section className="sp-grid sp-grid--two">
            <article className="sp-card">
              <div className="sp-card-title">
                <h2>{editingId ? "Editar vivienda" : "Agregar vivienda"}</h2>
                <p>Solo pedimos datos residenciales útiles para Serviprox.</p>
              </div>

              <form className="sp-form" onSubmit={handleSubmit}>
                <label className="sp-field">
                  Nombre
                  <IonInput
                    value={form.label}
                    onIonInput={(event) => updateForm("label", String(event.detail.value ?? ""))}
                  />
                </label>

                <label className="sp-field">
                  Tipo de vivienda
                  <IonSelect
                    value={form.property_type}
                    interface="popover"
                    onIonChange={(event) => updateForm("property_type", event.detail.value)}
                  >
                    <IonSelectOption value="apartment">Apartamento</IonSelectOption>
                    <IonSelectOption value="house">Casa</IonSelectOption>
                  </IonSelect>
                </label>

                <label className="sp-field">
                  Dirección
                  <IonInput
                    value={form.address_line}
                    autocomplete="street-address"
                    onIonInput={(event) =>
                      updateForm("address_line", String(event.detail.value ?? ""))
                    }
                  />
                </label>

                <div className="sp-grid sp-grid--two">
                  <label className="sp-field">
                    Barrio
                    <IonInput
                      value={form.neighborhood}
                      onIonInput={(event) =>
                        updateForm("neighborhood", String(event.detail.value ?? ""))
                      }
                    />
                  </label>
                  <label className="sp-field">
                    Ciudad
                    <IonInput
                      value={form.city}
                      autocomplete="address-level2"
                      onIonInput={(event) => updateForm("city", String(event.detail.value ?? ""))}
                    />
                  </label>
                </div>

                <label className="sp-field">
                  Notas de acceso
                  <IonTextarea
                    value={form.notes}
                    autoGrow
                    onIonInput={(event) => updateForm("notes", String(event.detail.value ?? ""))}
                  />
                </label>

                {error && <p className="sp-error">{error}</p>}

                <div className="sp-actions">
                  <IonButton
                    type="submit"
                    className="sp-primary-button"
                    disabled={saving || !form.label.trim() || !form.city.trim()}
                  >
                    {saving ? <IonSpinner name="crescent" /> : editingId ? "Actualizar" : "Guardar"}
                  </IonButton>
                  {editingId && (
                    <IonButton type="button" fill="clear" onClick={resetForm}>
                      Cancelar
                    </IonButton>
                  )}
                </div>
              </form>
            </article>

            <article className="sp-card">
              <div className="sp-card-title">
                <h2>Viviendas guardadas</h2>
                <p>Estas ubicaciones pertenecen a tu cuenta cliente.</p>
              </div>

              {loading ? (
                <div className="sp-route-loading">
                  <IonSpinner name="crescent" />
                  <span>Cargando viviendas...</span>
                </div>
              ) : households.length ? (
                <div className="sp-list">
                  {households.map((household) => (
                    <div className="sp-list-item" key={household.id}>
                      <strong>{household.label}</strong>
                      <span className="sp-muted">
                        {household.address_line || "Dirección pendiente"}
                      </span>
                      <span className="sp-muted">{household.short_location}</span>
                      <div className="sp-actions">
                        <IonButton fill="outline" onClick={() => editHousehold(household)}>
                          Editar
                        </IonButton>
                        <IonButton
                          fill="clear"
                          color="danger"
                          disabled={saving}
                          onClick={() => removeHousehold(household.id)}
                        >
                          Eliminar
                        </IonButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="sp-empty">Aún no tienes viviendas guardadas.</div>
              )}
            </article>
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

export default HouseholdsPage;
