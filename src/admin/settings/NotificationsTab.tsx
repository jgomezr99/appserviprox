import React, { useState } from "react";
import { Card, FieldList, Footer, TabProps, Toggle } from "./ui";

const EVENTS: Array<[string, string]> = [
  ["user_registered", "Nuevo registro de usuario"],
  ["new_hiring", "Nueva contratación"],
  ["pqr_received", "PQR recibida"],
  ["status_change", "Cambio de estado del servicio"],
  ["payment_confirmed", "Confirmación de pago"],
  ["tech_incident", "Incidencias técnicas"],
  ["security_alert", "Alertas de seguridad"],
];

const CHANNELS = [
  ["email", "Correo"],
  ["push", "Push"],
  ["sms", "SMS"],
] as const;

const SAMPLE: Record<string, string> = {
  "{{nombre}}": "Ana",
  "{{categoria}}": "Plomería",
  "{{profesional}}": "Carlos Díaz",
  "{{fecha}}": "18 de octubre",
};

const fill = (text: string) => Object.entries(SAMPLE).reduce((acc, [k, v]) => acc.split(k).join(v), text);

export const NotificationsTab: React.FC<TabProps> = ({ form, setForm, sec, setSec, busy, save, reset, notify }) => {
  const [channel, setChannel] = useState<"email" | "push" | "sms">("email");
  const email = form.email ?? { host: "", port: "", cipher: "TLS", sender: "", sender_name: "", requires_auth: true };
  const tpl = sec.templates[channel];

  const setEvent = (id: string, ch: string, value: boolean) =>
    setSec({ events: { ...sec.events, [id]: { ...sec.events[id], [ch]: value } } });
  const setTpl = (patch: Record<string, string>) =>
    setSec({ templates: { ...sec.templates, [channel]: { ...tpl, ...patch } } });

  const test = (label: string, ok: boolean) =>
    notify(ok ? "ok" : "error", ok ? `${label}: datos completos. El envío de prueba aún no está disponible.` : `${label}: completa los datos requeridos.`);

  return (
    <>
      <div className="as-grid">
        <Card title="Notificaciones por correo" icon="✉️" badge={sec.email_enabled ? "Activo" : "Inactivo"}>
          <p className="as-muted">Envía notificaciones importantes a los usuarios por correo electrónico.</p>
          <label>Servidor SMTP
            <input value={email.host} onChange={(e) => setForm((p) => ({ ...p, email: { ...email, host: e.target.value } }))} />
          </label>
          <div className="as-two">
            <label>Puerto
              <input value={email.port} onChange={(e) => setForm((p) => ({ ...p, email: { ...email, port: e.target.value } }))} />
            </label>
            <label>Cifrado
              <select value={email.cipher} onChange={(e) => setForm((p) => ({ ...p, email: { ...email, cipher: e.target.value } }))}>
                <option>TLS</option><option>SSL</option><option>Ninguno</option>
              </select>
            </label>
          </div>
          <div className="as-row">
            <span>Requiere autenticación</span>
            <Toggle checked={email.requires_auth} label="Requiere autenticación" onChange={(v) => setForm((p) => ({ ...p, email: { ...email, requires_auth: v } }))} />
          </div>
          <div className="as-row">
            <span>Canal activo</span>
            <Toggle checked={sec.email_enabled} label="Correo activo" onChange={(v) => setSec({ email_enabled: v })} />
          </div>
          <button type="button" className="as-btn as-btn-outline as-btn-block" onClick={() => test("Correo", Boolean(email.host && email.port))}>✉ Probar correo</button>
        </Card>

        <Card title="Notificaciones push" icon="📱" badge={sec.push_enabled ? "Activo" : "Inactivo"}>
          <p className="as-muted">Notificaciones en tiempo real en la app móvil y navegadores.</p>
          <FieldList
            fields={[
              { key: "push_provider", label: "Proveedor", kind: "select", options: ["Firebase Cloud Messaging", "OneSignal"] },
              { key: "push_key", label: "Clave del servidor", kind: "password" },
              { key: "push_enabled", label: "Canal activo", kind: "toggle" },
            ]}
            values={sec}
            onChange={(k, v) => setSec({ [k]: v })}
          />
          <button type="button" className="as-btn as-btn-outline as-btn-block" onClick={() => test("Push", Boolean(sec.push_key))}>➤ Probar notificación push</button>
        </Card>

        <Card title="Alertas por SMS" icon="💬" badge={sec.sms_enabled ? "Activo" : "Inactivo"}>
          <p className="as-muted">Mensajes de texto para eventos críticos y confirmaciones.</p>
          <FieldList
            fields={[
              { key: "sms_provider", label: "Proveedor", kind: "select", options: ["Twilio", "Infobip"] },
              { key: "sms_key", label: "Clave API", kind: "password" },
              { key: "sms_enabled", label: "Canal activo", kind: "toggle" },
            ]}
            values={sec}
            onChange={(k, v) => setSec({ [k]: v })}
          />
          <button type="button" className="as-btn as-btn-outline as-btn-block" onClick={() => test("SMS", Boolean(sec.sms_key))}>💬 Probar SMS</button>
        </Card>

        <Card title="Horario de notificaciones" icon="🕒">
          <p className="as-muted">Define el horario en el que se enviarán las notificaciones automáticas.</p>
          <label>Zona horaria
            <input value={sec.quiet_tz} onChange={(e) => setSec({ quiet_tz: e.target.value })} />
          </label>
          <span className="as-label">Horas de silencio</span>
          <div className="as-two">
            <input type="time" value={sec.quiet_from} onChange={(e) => setSec({ quiet_from: e.target.value })} />
            <input type="time" value={sec.quiet_to} onChange={(e) => setSec({ quiet_to: e.target.value })} />
          </div>
          <div className="as-row">
            <span>Aplicar horario a todos los canales</span>
            <Toggle checked={sec.quiet_all} label="Aplicar a todos los canales" onChange={(v) => setSec({ quiet_all: v })} />
          </div>
          <div className="as-note">Durante el horario de silencio solo se enviarán notificaciones críticas (seguridad y fallas técnicas).</div>
        </Card>
      </div>

      <div className="as-grid as-grid-3b">
        <Card title="Eventos y preferencias de notificación" icon="🔔">
          <p className="as-muted">Selecciona los eventos que generarán notificaciones y los canales de envío.</p>
          <table className="as-table">
            <thead>
              <tr><th>Evento</th>{CHANNELS.map(([, l]) => <th key={l}>{l}</th>)}<th>Estado</th></tr>
            </thead>
            <tbody>
              {EVENTS.map(([id, label]) => {
                const ev = sec.events[id];
                const active = ev.email || ev.push || ev.sms;
                return (
                  <tr key={id}>
                    <td>{label}</td>
                    {CHANNELS.map(([ch, l]) => (
                      <td key={ch}><Toggle checked={Boolean(ev[ch])} label={`${label} ${l}`} onChange={(v) => setEvent(id, ch, v)} /></td>
                    ))}
                    <td><span className={`as-badge ${active ? "" : "as-badge-off"}`}>{active ? "Activo" : "Inactivo"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Plantillas de notificación" icon="📝">
          <p className="as-muted">Personaliza los mensajes que se enviarán a los usuarios.</p>
          <div className="as-tabs as-tabs-sm">
            {CHANNELS.map(([ch, l]) => (
              <button key={ch} type="button" className={`as-tab ${channel === ch ? "active" : ""}`} onClick={() => setChannel(ch)}>{l}</button>
            ))}
          </div>
          <label>Plantilla
            <select defaultValue="Confirmación de contratación"><option>Confirmación de contratación</option></select>
          </label>
          {channel !== "sms" && (
            <label>Asunto
              <input value={tpl.subject} onChange={(e) => setTpl({ subject: e.target.value })} />
            </label>
          )}
          <label>Mensaje
            <textarea rows={8} value={tpl.message} onChange={(e) => setTpl({ message: e.target.value })} />
          </label>
          <small>Variables disponibles: {Object.keys(SAMPLE).join(" ")}</small>
        </Card>

        <div className="as-side">
          <Card title="Frecuencia de notificaciones" icon="🔁">
            <p className="as-muted">Define la frecuencia de envío de notificaciones no críticas.</p>
            <FieldList
              fields={[{ key: "frequency", label: "Frecuencia", kind: "select", options: ["Inmediata (en tiempo real)", "Resumen diario", "Resumen semanal"] }]}
              values={sec}
              onChange={(k, v) => setSec({ [k]: v })}
            />
          </Card>
          <Card title="Vista previa de notificación" icon="👁">
            <div className="as-notice">
              <strong>{form.platform_name}</strong>
              <span>{fill(tpl.subject || tpl.message.split("\n")[0])}</span>
              <small>{fill(tpl.message).slice(0, 110)}</small>
            </div>
          </Card>
        </div>
      </div>

      <Footer busy={busy} save={save} reset={reset} />
    </>
  );
};
