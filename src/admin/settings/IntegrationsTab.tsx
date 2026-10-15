import React, { useState } from "react";
import { Card, Empty, FieldList, FieldDef, Footer, TabProps, Toggle } from "./ui";

type Integration = {
  id: string;
  title: string;
  sub: string;
  category: string;
  icon: string;
  fields: FieldDef[];
  required: string[];
};

const INTEGRATIONS: Integration[] = [
  { id: "firebase", title: "Firebase", sub: "Base de datos y autenticación", category: "Base de datos", icon: "🔥", required: ["firebase_project", "firebase_key"], fields: [{ key: "firebase_project", label: "Proyecto" }, { key: "firebase_key", label: "API Key", kind: "password" }] },
  { id: "maps", title: "Google Maps", sub: "Mapas y ubicación", category: "Mapas", icon: "📍", required: ["maps_key"], fields: [{ key: "maps_key", label: "API Key", kind: "password" }] },
  { id: "smtp", title: "Correo Electrónico (SMTP)", sub: "Comunicaciones", category: "Comunicaciones", icon: "✉️", required: [], fields: [] },
  { id: "whatsapp", title: "WhatsApp Business", sub: "Mensajería", category: "Comunicaciones", icon: "💬", required: ["whatsapp_number", "whatsapp_key"], fields: [{ key: "whatsapp_number", label: "Número" }, { key: "whatsapp_key", label: "Token", kind: "password" }] },
  { id: "gateway", title: "Pasarela de pago", sub: "Pagos en línea", category: "Pagos", icon: "💳", required: ["gateway_provider", "gateway_key"], fields: [{ key: "gateway_provider", label: "Proveedor" }, { key: "gateway_key", label: "Clave pública", kind: "password" }] },
  { id: "analytics", title: "Google Analytics", sub: "Analítica y métricas", category: "Analítica", icon: "📊", required: ["analytics_id"], fields: [{ key: "analytics_id", label: "ID de medición" }] },
  { id: "social", title: "Inicio de sesión social", sub: "Autenticación", category: "Autenticación", icon: "🔑", required: [], fields: [{ key: "google_login", label: "Google", kind: "toggle" }, { key: "facebook_login", label: "Facebook", kind: "toggle" }] },
  { id: "webhooks", title: "Webhooks", sub: "Eventos en tiempo real", category: "Comunicaciones", icon: "🔗", required: ["webhook_endpoint"], fields: [{ key: "webhook_endpoint", label: "Endpoint", placeholder: "https://..." }] },
];

const WEBHOOK_EVENTS: Array<[string, string]> = [
  ["ev_register", "Nuevo registro de usuario"],
  ["ev_publication", "Nueva publicación"],
  ["ev_contract", "Nueva contratación"],
  ["ev_status", "Actualización de estado de servicio"],
  ["ev_chat", "Nuevo mensaje en chat"],
  ["ev_pqr", "Nuevo PQR"],
  ["ev_benefits", "Cambios en beneficios"],
];

const CREDENTIALS: Array<[string, string, string]> = [
  ["Firebase", "firebase_key", "firebase_enabled"],
  ["Google Maps", "maps_key", "maps_enabled"],
  ["Pasarela de pago", "gateway_key", "gateway_enabled"],
  ["Google Analytics", "analytics_id", "analytics_enabled"],
];

const mask = (v?: string) => (v ? `${v.slice(0, 4)}${"•".repeat(10)}` : "—");

export const IntegrationsTab: React.FC<TabProps> = ({ sec, setSec, busy, save, reset, notify }) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas las categorías");
  const [open, setOpen] = useState<string | null>(null);

  const categories = ["Todas las categorías", ...new Set(INTEGRATIONS.map((i) => i.category))];
  const visible = INTEGRATIONS.filter(
    (i) =>
      (category === "Todas las categorías" || i.category === category) &&
      i.title.toLowerCase().includes(query.toLowerCase())
  );

  const test = (i: Integration) => {
    const missing = i.required.filter((k) => !sec[k]);
    notify(
      missing.length ? "error" : "ok",
      missing.length
        ? `${i.title}: faltan credenciales por configurar.`
        : `${i.title}: credenciales completas. La prueba real con el servicio aún no está disponible.`
    );
  };

  return (
    <>
      <div className="as-row as-row-top">
        <div>
          <h3>Integraciones disponibles</h3>
          <p className="as-muted">Configura los servicios externos para mejorar la funcionalidad de la plataforma.</p>
        </div>
        <div className="as-two">
          <input className="as-search" placeholder="Buscar integración..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="as-grid as-grid-4">
        {visible.map((i) => {
          const enabled = Boolean(sec[`${i.id}_enabled`]);
          return (
            <div className="as-card" key={i.id}>
              <div className="as-row">
                <span className="as-method"><b aria-hidden="true">{i.icon}</b> <span><strong>{i.title}</strong><small>{i.sub}</small></span></span>
                <Toggle checked={enabled} label={i.title} disabled={busy} onChange={(v) => setSec({ [`${i.id}_enabled`]: v })} />
              </div>
              <span className={`as-badge ${enabled ? "" : "as-badge-off"}`}>{enabled ? "Conectado" : "Desactivado"}</span>
              {open === i.id && <FieldList fields={i.fields} values={sec} onChange={(k, v) => setSec({ [k]: v })} />}
              <div className="as-two">
                <button type="button" className="as-btn as-btn-outline" onClick={() => setOpen(open === i.id ? null : i.id)}>⚙ Configurar</button>
                <button type="button" className="as-btn as-btn-outline" onClick={() => test(i)}>⚡ Probar conexión</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="as-grid as-grid-3b">
        <Card title="Claves y credenciales" icon="🔑">
          <p className="as-muted">Gestiona las claves de API y credenciales de las integraciones.</p>
          <table className="as-table">
            <thead><tr><th>Servicio</th><th>Clave / ID</th><th>Estado</th></tr></thead>
            <tbody>
              {CREDENTIALS.map(([name, keyField, enabledField]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{mask(sec[keyField])}</td>
                  <td><span className={`as-badge ${sec[enabledField] ? "" : "as-badge-off"}`}>{sec[enabledField] ? "Activa" : "Inactiva"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Eventos de Webhook" icon="📡">
          <p className="as-muted">Selecciona los eventos que se enviarán a tu endpoint.</p>
          <FieldList fields={WEBHOOK_EVENTS.map(([key, label]) => ({ key, label, kind: "toggle" as const }))} values={sec} onChange={(k, v) => setSec({ [k]: v })} />
        </Card>

        <Card title="Registro de integraciones" icon="📋">
          <Empty text="Aún no hay actividad registrada de las integraciones." />
        </Card>
      </div>

      <Footer busy={busy} save={save} reset={reset} note="Asegúrate de mantener actualizadas las credenciales de cada integración." />
    </>
  );
};
