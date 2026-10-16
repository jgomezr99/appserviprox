import React, { useEffect, useState } from "react";
import {
  platformSettingsService,
  DEFAULT_SETTINGS,
  PlatformFeatures,
  PlatformSettings,
} from "../services/platformSettings";
import "./AdminSettings.css";
import { SECTION_DEFAULTS, mergeDeep } from "./settings/defaults";
import { AppearanceTab } from "./settings/AppearanceTab";
import { NotificationsTab } from "./settings/NotificationsTab";
import { PaymentsTab } from "./settings/PaymentsTab";
import { SecurityTab } from "./settings/SecurityTab";
import { IntegrationsTab } from "./settings/IntegrationsTab";
import { AppParamsTab } from "./settings/AppParamsTab";
import { MaintenanceTab } from "./settings/MaintenanceTab";
import type { ConfirmRequest, FieldDef, TabProps } from "./settings/ui";
import { FieldList } from "./settings/ui";

const T = "toggle" as const;
const ROLE_CARDS: Array<[string, string, FieldDef[]]> = [
  [
    "client",
    "🏠 Home del cliente",
    [
      { key: "map", label: "Mapa de contratistas", kind: T },
      { key: "services", label: "Buscar un servicio", kind: T },
      { key: "requests", label: "Mis solicitudes", kind: T },
      { key: "homes", label: "Mis viviendas", kind: T },
      { key: "favorites", label: "Favoritos", kind: T },
      { key: "pqr", label: "PQRS y quejas", kind: T },
      { key: "store", label: "Tienda de productos", kind: T },
      { key: "publish_store", label: "Publicar en tienda", kind: T },
      { key: "benefits", label: "Beneficios y puntos", kind: T },
    ],
  ],
  [
    "professional",
    "🧰 Home del profesional",
    [
      { key: "profile_status", label: "Estado del perfil", kind: T },
      { key: "profile", label: "Perfil profesional", kind: T },
      { key: "services_offered", label: "Servicios ofrecidos", kind: T },
      { key: "availability", label: "Disponibilidad", kind: T },
      { key: "requests", label: "Mis solicitudes", kind: T },
      { key: "jobs", label: "Trabajos activos", kind: T },
      { key: "chat", label: "Chat con clientes", kind: T },
      { key: "ads", label: "Publicidad de profesionales", kind: T },
      { key: "benefits", label: "Beneficios", kind: T },
      { key: "store", label: "Tienda de herramientas", kind: T },
      { key: "publish_store", label: "Publicar en tienda", kind: T },
    ],
  ],
];

const TAB_SECTIONS: Record<string, { section: string; Component: React.FC<TabProps> }> = {
  Notificaciones: { section: "notifications", Component: NotificationsTab },
  "Métodos de pago": { section: "payments", Component: PaymentsTab },
  Seguridad: { section: "security", Component: SecurityTab },
  Integraciones: { section: "integrations", Component: IntegrationsTab },
  "Personalización": { section: "appearance", Component: AppearanceTab },
  "Parámetros de la app": { section: "app_params", Component: AppParamsTab },
  Mantenimiento: { section: "maintenance", Component: MaintenanceTab },
};

const withSections = (data: PlatformSettings): PlatformSettings => ({
  ...data,
  sections: Object.fromEntries(
    Object.entries(SECTION_DEFAULTS).map(([name, defaults]) => [name, mergeDeep(defaults, data.sections?.[name])])
  ),
});

const TABS = [
  "General",
  "Notificaciones",
  "Métodos de pago",
  "Seguridad",
  "Integraciones",
  "Personalización",
  "Parámetros de la app",
  "Mantenimiento",
];

const FEATURE_LABELS: Array<[keyof PlatformFeatures, string]> = [
  ["new_users", "Registro de nuevos usuarios"],
  ["professionals", "Registro de profesionales"],
  ["services", "Publicación de servicios"],
  ["products", "Publicación de productos (tienda)"],
  ["chat", "Chat entre usuarios"],
  ["hirings", "Contrataciones"],
  ["pqr", "PQR y reportes"],
  ["benefits", "Sistema de beneficios"],
  ["email_notifications", "Notificaciones por correo"],
  ["push_notifications", "Notificaciones push"],
  ["maintenance", "Modo mantenimiento"],
];

const SOCIALS = [
  ["facebook", "Facebook", "f"],
  ["instagram", "Instagram", "◎"],
  ["x", "X", "𝕏"],
  ["youtube", "YouTube", "▶"],
  ["linkedin", "LinkedIn", "in"],
] as const;

const DOCS = [
  ["terms", "Términos y condiciones"],
  ["privacy", "Política de privacidad"],
  ["refunds", "Política de reembolsos"],
  ["rules", "Reglamento de uso"],
  ["contract", "Contrato de prestación de servicios"],
] as const;

const COUNTRIES = ["Colombia", "México", "Perú", "Ecuador", "Chile", "Argentina"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type Confirm = ConfirmRequest | null;

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "No se pudo completar la operación.";

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleString("es-CO") : "—");

export const AdminSettings: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [tab, setTab] = useState(TABS[0]);
  const [form, setForm] = useState<PlatformSettings>(withSections(DEFAULT_SETTINGS));
  const [citiesText, setCitiesText] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [confirmText, setConfirmText] = useState("");
  const [doc, setDoc] = useState<(typeof DOCS)[number] | null>(null);

  useEffect(() => {
    platformSettingsService
      .getAdmin()
      .then((data) => {
        setForm(withSections(data));
        setCitiesText(data.cities.join("\n"));
      })
      .catch((err) => setMsg({ type: "error", text: errorMessage(err) }));
  }, []);

  const set = <K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const email = form.email ?? { host: "", port: "", cipher: "TLS", sender: "", sender_name: "", requires_auth: true };
  const social = form.social ?? { facebook: "", instagram: "", x: "", youtube: "", linkedin: "" };
  const documents = form.documents ?? { terms: "", privacy: "", refunds: "", rules: "", contract: "" };

  const run = async (task: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ type: "ok", text: await task() });
    } catch (err) {
      setMsg({ type: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const cities = citiesText.split("\n").map((c) => c.trim()).filter(Boolean);
      const role_params = form.sections?.role_params;
      const saved = await platformSettingsService.saveAdmin({ ...form, cities, role_params });
      setForm((prev) => withSections({ ...prev, ...saved, system: prev.system }));
      onChanged?.();
      return "Cambios guardados.";
    });

  const testEmail = () => {
    const ok = email.host && email.port && email.sender;
    setMsg(
      ok
        ? { type: "ok", text: "Datos SMTP completos. El envío de prueba aún no está disponible." }
        : { type: "error", text: "Completa servidor, puerto y correo remitente." }
    );
  };

  const onLogo = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > MAX_LOGO_BYTES) {
      setMsg({ type: "error", text: "Logo: solo PNG o JPG de máximo 2 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logo", String(reader.result));
    reader.readAsDataURL(file);
  };

  const toggleMaintenance = (enabled: boolean) => runAction({ action: "toggle_maintenance", enabled });

  const setSection = (name: string) => (patch: Record<string, unknown>) =>
    setForm((prev) => ({
      ...prev,
      sections: { ...prev.sections, [name]: { ...prev.sections?.[name], ...patch } },
    }));

  const resetSection = (name: string) => () => {
    setForm((prev) => ({ ...prev, sections: { ...prev.sections, [name]: { ...SECTION_DEFAULTS[name] } } }));
    setMsg({ type: "ok", text: "Valores restablecidos. Pulsa Guardar cambios para aplicarlos." });
  };

  const refreshSystem = () =>
    platformSettingsService.getAdmin().then((data) => setForm((prev) => ({ ...prev, system: data.system, last_backup: data.last_backup })));

  const runAction = (body: Record<string, unknown> & { action: string }) =>
    run(async () => {
      const res = await platformSettingsService.systemAction(body);
      if (res.settings) setForm((prev) => ({ ...prev, features: res.settings!.features }));
      if (res.last_backup) set("last_backup", res.last_backup);
      await platformSettingsService.fetchPublic().catch(() => undefined);
      await refreshSystem().catch(() => undefined);
      return res.detail;
    });

  const toggleFeature = (key: keyof PlatformFeatures) => {
    if (key === "maintenance") {
      toggleMaintenance(!form.features.maintenance);
      return;
    }
    set("features", { ...form.features, [key]: !form.features[key] });
  };

  const backupNow = () => runAction({ action: "backup_now" });

  const runDestructive = () => {
    if (!confirm) return;
    const { action, extra } = confirm;
    runAction({ action, confirm: confirmText, ...extra });
    setConfirm(null);
    setConfirmText("");
    onChanged?.();
  };

  const saveButton = (
    <button type="button" className="as-btn as-btn-primary as-btn-block" disabled={busy} onClick={save}>
      💾 Guardar cambios
    </button>
  );

  const renderSwitch = (checked: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      className={`as-switch ${checked ? "on" : ""}`}
      onClick={onClick}
    />
  );

  return (
    <section className="as-view" aria-label="Configuración">
      <div className="as-header">
        <h2 className="as-title">Configuración</h2>
        <p className="as-sub">Administra los parámetros y preferencias de la plataforma {form.platform_name}.</p>
      </div>

      <div className="as-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`as-tab ${tab === t ? "active" : ""}`}
            onClick={() => {
              setTab(t);
              setMsg(null);
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {msg && <div className={`as-msg as-msg-${msg.type}`} role="alert">{msg.text}</div>}

      {TAB_SECTIONS[tab] && (() => {
        const { section, Component } = TAB_SECTIONS[tab];
        return (
          <Component
            form={form}
            setForm={setForm}
            sec={form.sections?.[section] ?? SECTION_DEFAULTS[section]}
            setSec={setSection(section)}
            busy={busy}
            save={save}
            reset={resetSection(section)}
            notify={(type, text) => setMsg({ type, text })}
            askConfirm={setConfirm}
            runAction={runAction}
          />
        );
      })()}

      {tab === "General" && (
        <>
          <div className="as-grid">
            <div className="as-card">
              <h3>🏢 Información de la plataforma</h3>
              <label>Nombre de la plataforma
                <input value={form.platform_name} onChange={(e) => set("platform_name", e.target.value)} />
              </label>
              <label>Descripción
                <textarea rows={3} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </label>
              <span className="as-label">Logo actual</span>
              <div className="as-logo">
                {form.logo ? <img src={form.logo} alt="Logo actual" /> : <strong className="as-logo-text">{form.platform_name}</strong>}
                <label className="as-btn as-btn-outline">
                  ⬆ Cambiar logo
                  <input type="file" accept="image/png,image/jpeg" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
                </label>
              </div>
              <small>Formatos: PNG, JPG (máx. 2 MB)</small>
              {saveButton}
            </div>

            <div className="as-card">
              <h3>🌐 Configuración regional</h3>
              <label>País
                <select value={form.country} onChange={(e) => set("country", e.target.value)}>
                  {[...new Set([form.country, ...COUNTRIES])].map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label>Zona horaria
                <input value={form.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} />
              </label>
              <label>Idioma
                <input value={form.language} onChange={(e) => set("language", e.target.value)} />
              </label>
              <label>Formato de fecha
                <input value={form.date_format ?? ""} onChange={(e) => set("date_format", e.target.value)} />
              </label>
              <label>Formato de hora
                <input value={form.time_format ?? ""} onChange={(e) => set("time_format", e.target.value)} />
              </label>
              <label>Moneda
                <input value={form.currency} onChange={(e) => set("currency", e.target.value)} />
              </label>
              <label>Ciudades disponibles (una por línea)
                <textarea rows={3} value={citiesText} onChange={(e) => setCitiesText(e.target.value)} />
              </label>
              {saveButton}
            </div>

            <div className="as-card">
              <h3>⚙️ Parámetros generales</h3>
              {FEATURE_LABELS.map(([key, label]) => (
                <div className="as-row" key={key}>
                  <span>{label}</span>
                  {renderSwitch(form.features[key], label, () => toggleFeature(key))}
                </div>
              ))}
              {saveButton}
            </div>

            <div className="as-side">
              <div className="as-card">
                <h3>🖥️ Estado del sistema <span className="as-badge">Operativo</span></h3>
                <dl className="as-dl">
                  <dt>Versión de la aplicación</dt><dd>{form.system?.version ?? "—"}</dd>
                  <dt>Última actualización</dt><dd>{fmtDate(form.system?.updated_at)}</dd>
                  <dt>Servidor</dt><dd>Serviprox Cloud</dd>
                  <dt>Base de datos</dt><dd>{form.system?.db_engine === "postgresql" ? "PostgreSQL" : form.system?.db_engine ?? "—"}</dd>
                  <dt>Entorno</dt><dd><span className="as-badge as-badge-green">{form.system?.environment ?? "—"}</span></dd>
                </dl>
              </div>

              <div className="as-card">
                <h3>🗄️ Copias de seguridad</h3>
                <dl className="as-dl">
                  <dt>Última copia</dt><dd>{fmtDate(form.last_backup)}</dd>
                </dl>
                <button type="button" className="as-btn as-btn-primary as-btn-block" disabled={busy} onClick={backupNow}>
                  ☁ Realizar copia ahora
                </button>
              </div>
            </div>
          </div>

          <div className="as-grid as-grid-2b">
            {ROLE_CARDS.map(([role, title, fields]) => (
              <div className="as-card" key={role}>
                <h3>{title}</h3>
                <p className="as-muted">Secciones visibles en el home. También deben estar activas en Parámetros generales.</p>
                <FieldList
                  fields={fields}
                  values={{ ...SECTION_DEFAULTS.role_params[role], ...(form.sections?.role_params?.[role] || form.role_params?.[role] || {}) }}
                  onChange={(k, v) =>
                    setSection("role_params")({
                      [role]: {
                        ...SECTION_DEFAULTS.role_params[role],
                        ...(form.sections?.role_params?.[role] || form.role_params?.[role] || {}),
                        [k]: v,
                      },
                    })
                  }
                  disabled={busy}
                />
                {saveButton}
              </div>
            ))}
          </div>

          <div className="as-grid">
            <div className="as-card">
              <h3>✉️ Correo electrónico</h3>
              <label>Servidor SMTP
                <input value={email.host} onChange={(e) => set("email", { ...email, host: e.target.value })} />
              </label>
              <div className="as-two">
                <label>Puerto
                  <input value={email.port} onChange={(e) => set("email", { ...email, port: e.target.value })} />
                </label>
                <label>Cifrado
                  <select value={email.cipher} onChange={(e) => set("email", { ...email, cipher: e.target.value })}>
                    <option>TLS</option><option>SSL</option><option>Ninguno</option>
                  </select>
                </label>
              </div>
              <label>Correo remitente
                <input value={email.sender} onChange={(e) => set("email", { ...email, sender: e.target.value })} />
              </label>
              <label>Nombre remitente
                <input value={email.sender_name} onChange={(e) => set("email", { ...email, sender_name: e.target.value })} />
              </label>
              <div className="as-row">
                <span>Requiere autenticación</span>
                {renderSwitch(email.requires_auth, "Requiere autenticación", () => set("email", { ...email, requires_auth: !email.requires_auth }))}
              </div>
              <div className="as-two">
                <button type="button" className="as-btn as-btn-outline" onClick={testEmail}>➤ Probar conexión</button>
                <button type="button" className="as-btn as-btn-primary" disabled={busy} onClick={save}>💾 Guardar cambios</button>
              </div>
            </div>

            <div className="as-card">
              <h3>🔗 Redes sociales</h3>
              {SOCIALS.map(([key, label, icon]) => (
                <label key={key} className="as-social">
                  <span className="as-social-icon" aria-hidden="true">{icon}</span>
                  <span className="as-social-body">
                    {label}
                    <input value={social[key]} onChange={(e) => set("social", { ...social, [key]: e.target.value })} />
                  </span>
                </label>
              ))}
              {saveButton}
            </div>

            <div className="as-card">
              <h3>📄 Políticas y documentos</h3>
              {DOCS.map((d) => (
                <div className="as-row" key={d[0]}>
                  <span>{d[1]}</span>
                  <button type="button" className="as-btn as-btn-outline as-btn-sm" onClick={() => setDoc(d)}>Ver / Editar</button>
                </div>
              ))}
            </div>

            <div className="as-side">
              <div className="as-card">
                <h3>🔧 Acciones del sistema</h3>
                <button
                  type="button"
                  className="as-btn as-btn-info as-btn-block"
                  onClick={() => setConfirm({
                    action: "clear_cache",
                    title: "Limpiar caché",
                    text: "Se borrarán todos los pedidos, PQR y fallas técnicas de clientes y profesionales.",
                  })}
                >
                  Limpiar caché
                </button>
                <button
                  type="button"
                  className="as-btn as-btn-warn as-btn-block"
                  onClick={() => setConfirm({
                    action: "reset_services",
                    title: "Reiniciar servicios",
                    text: "Se eliminarán todas las cuentas de clientes y profesionales de la base de datos.",
                  })}
                >
                  Reiniciar servicios
                </button>
                <button
                  type="button"
                  className="as-btn as-btn-danger as-btn-block"
                  disabled={busy}
                  onClick={() => toggleMaintenance(!form.features.maintenance)}
                >
                  {form.features.maintenance ? "Desactivar mantenimiento" : "Modo mantenimiento"}
                </button>
                <button
                  type="button"
                  className="as-btn as-btn-danger-outline as-btn-block"
                  onClick={() => setConfirm({
                    action: "restore_backup",
                    title: "Restaurar copia de seguridad",
                    text: "Se restaurará la última copia de seguridad sobre los datos actuales.",
                  })}
                >
                  Restaurar copia de seguridad
                </button>
              </div>

              <div className="as-card as-risk">
                <h3>🗑️ Zona de riesgo</h3>
                <p className="as-muted">Esta acción eliminará permanentemente todos los datos de la plataforma.</p>
                <button
                  type="button"
                  className="as-btn as-btn-solid-danger as-btn-block"
                  onClick={() => setConfirm({
                    action: "delete_platform",
                    title: "Eliminar plataforma",
                    text: "Se eliminarán cuentas, pedidos, PQR, fallas, catálogo y configuración.",
                  })}
                >
                  🗑 Eliminar plataforma
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {doc && (
        <div className="as-modal" role="dialog" aria-modal="true">
          <div className="as-modal-box as-modal-wide">
            <h3>{doc[1]}</h3>
            <textarea
              rows={12}
              value={documents[doc[0]]}
              onChange={(e) => set("documents", { ...documents, [doc[0]]: e.target.value })}
            />
            <div className="as-actions">
              <button type="button" className="as-btn as-btn-outline" onClick={() => setDoc(null)}>Cerrar</button>
              <button type="button" className="as-btn as-btn-primary" disabled={busy} onClick={() => { save(); setDoc(null); }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="as-modal" role="dialog" aria-modal="true">
          <div className="as-modal-box">
            <h3>{confirm.title}</h3>
            <p>{confirm.text} Esta acción no se puede deshacer.</p>
            <label>Escribe BORRAR para confirmar
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </label>
            <div className="as-actions">
              <button type="button" className="as-btn as-btn-outline" onClick={() => { setConfirm(null); setConfirmText(""); }}>
                Cancelar
              </button>
              <button type="button" className="as-btn as-btn-solid-danger" disabled={busy || confirmText !== "BORRAR"} onClick={runDestructive}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminSettings;
