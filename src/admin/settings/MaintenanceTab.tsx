import React, { useState } from "react";
import { Card, Empty, Footer, TabProps, Toggle } from "./ui";

const SERVICES = [
  ["API (Backend)", true],
  ["Base de datos", true],
  ["Almacenamiento (Storage)", null],
  ["Servicio de correo", null],
  ["Pasarela de pagos", null],
  ["Notificaciones push", null],
  ["Chat en tiempo real", null],
] as const;

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString("es-CO") : "—");

export const MaintenanceTab: React.FC<TabProps> = ({ form, sec, setSec, busy, save, reset, notify, askConfirm, runAction }) => {
  const [ip, setIp] = useState("");
  const [selected, setSelected] = useState("");
  const active = form.features.maintenance;
  const backups = form.system?.backups ?? [];
  const history = form.system?.history ?? [];
  const months = parseInt(String(sec.purge_months), 10) || 3;

  const addIp = () => {
    if (!IPV4.test(ip.trim())) {
      notify("error", "Dirección IP inválida.");
      return;
    }
    if (!sec.ips.includes(ip.trim())) setSec({ ips: [...sec.ips, ip.trim()] });
    setIp("");
  };

  const schedule = () => {
    if (!sec.window_start || !sec.window_end || sec.window_end <= sec.window_start) {
      notify("error", "Indica un inicio y un fin válidos.");
      return;
    }
    setSec({
      schedule: [
        ...sec.schedule,
        { start: sec.window_start, end: sec.window_end, description: sec.title, status: "Programado" },
      ],
    });
    save();
  };

  return (
    <>
      <div className="as-grid as-grid-3b">
        <div className={`as-card as-state ${active ? "as-state-on" : ""}`}>
          <strong>{active ? "🛠️ En mantenimiento" : "✅ Sistema operativo"}</strong>
          <small>{active ? "Los usuarios ven el aviso de mantenimiento." : "Todos los servicios funcionan correctamente."}</small>
        </div>

        <Card title="Mantenimiento programado" icon="🗓️">
          <div className="as-two">
            <label>Fecha y hora de inicio
              <input type="datetime-local" value={sec.window_start} onChange={(e) => setSec({ window_start: e.target.value })} />
            </label>
            <label>Fecha y hora de fin
              <input type="datetime-local" value={sec.window_end} onChange={(e) => setSec({ window_end: e.target.value })} />
            </label>
          </div>
          <button type="button" className="as-btn as-btn-primary" disabled={busy} onClick={schedule}>Programar mantenimiento</button>
          <small className="as-muted">Durante este periodo la plataforma no estará disponible para usuarios.</small>
        </Card>

        <Card title="Modo de mantenimiento" icon="🔧">
          <div className="as-row">
            <span>Activar modo de mantenimiento</span>
            <Toggle checked={active} label="Activar modo de mantenimiento" disabled={busy} onChange={(v) => runAction({ action: "toggle_maintenance", enabled: v })} />
          </div>
          <small className="as-muted">Cuando esta opción está activa, los usuarios verán un mensaje personalizado.</small>
        </Card>
      </div>

      <div className="as-grid as-grid-3b">
        <Card title="Mensaje para usuarios" icon="💬">
          <label>Título
            <input value={sec.title} onChange={(e) => setSec({ title: e.target.value })} />
          </label>
          <label>Descripción
            <textarea rows={4} value={sec.description} onChange={(e) => setSec({ description: e.target.value })} />
          </label>
          <div className="as-row">
            <span>Mostrar fecha estimada de regreso</span>
            <Toggle checked={sec.show_end} label="Mostrar fecha estimada" onChange={(v) => setSec({ show_end: v })} />
          </div>
          <label>Enlace de soporte (opcional)
            <input value={sec.support_url} placeholder="https://" onChange={(e) => setSec({ support_url: e.target.value })} />
          </label>
        </Card>

        <Card title="IPs permitidas (administradores)" icon="🛡️">
          <p className="as-muted">Solo estas direcciones podrán acceder durante el modo de mantenimiento.</p>
          {sec.ips.length === 0 && <Empty text="Sin IPs permitidas." />}
          {sec.ips.map((p: string) => (
            <div className="as-row" key={p}>
              <span>{p}</span>
              <button type="button" className="as-btn as-btn-danger as-btn-sm" aria-label={`Quitar ${p}`} onClick={() => setSec({ ips: sec.ips.filter((x: string) => x !== p) })}>🗑</button>
            </div>
          ))}
          <div className="as-two">
            <input placeholder="Agregar dirección IP" value={ip} onChange={(e) => setIp(e.target.value)} />
            <button type="button" className="as-btn as-btn-primary" onClick={addIp}>Agregar</button>
          </div>
        </Card>

        <Card title="Estado de servicios" icon="📶">
          {SERVICES.map(([name, ok]) => (
            <div className="as-row" key={name}>
              <span>{name}</span>
              <span className={`as-badge ${ok ? "as-badge-green" : "as-badge-off"}`}>{ok ? "Operativo" : "Sin monitoreo"}</span>
            </div>
          ))}
        </Card>

        <Card title="Acciones del sistema" icon="⚙️">
          <button type="button" className="as-btn as-btn-info as-btn-block" onClick={() => askConfirm({ action: "reset_services", title: "Reiniciar servicios", text: "Se eliminarán todas las cuentas de clientes y profesionales." })}>Reiniciar servicios</button>
          <button type="button" className="as-btn as-btn-info as-btn-block" onClick={() => askConfirm({ action: "clear_cache", title: "Limpiar caché", text: "Se borrarán pedidos, PQR y fallas técnicas." })}>Limpiar caché</button>
          <button type="button" className="as-btn as-btn-warn as-btn-block" onClick={() => askConfirm({ action: "cleanup_logs", title: "Limpiar logs antiguos", text: `Se eliminarán los registros de auditoría de más de ${months} meses.`, extra: { months } })}>Limpiar logs antiguos</button>
          <button type="button" className="as-btn as-btn-danger as-btn-block" disabled={busy || active} onClick={() => runAction({ action: "toggle_maintenance", enabled: true })}>Detener servicios</button>
        </Card>
      </div>

      <div className="as-grid as-grid-4">
        <Card title="Copias de seguridad" icon="🗄️">
          <div className="as-note">Última copia: {fmt(form.last_backup ?? "")}</div>
          <button type="button" className="as-btn as-btn-primary as-btn-block" disabled={busy} onClick={() => runAction({ action: "backup_now" })}>☁ Realizar copia ahora</button>
        </Card>

        <Card title="Puntos de restauración" icon="⏱️">
          {backups.length === 0 && <Empty text="No hay copias disponibles." />}
          {backups.map((b) => (
            <label className="as-radio" key={b.name}>
              <input type="radio" name="restore" checked={selected === b.name} onChange={() => setSelected(b.name)} />
              <span>{new Date(b.created_at * 1000).toLocaleString("es-CO")} · {(b.size / 1048576).toFixed(1)} MB</span>
            </label>
          ))}
          <button
            type="button"
            className="as-btn as-btn-danger-outline as-btn-block"
            disabled={!selected}
            onClick={() => askConfirm({ action: "restore_backup", title: "Restaurar copia seleccionada", text: "Se restaurará la copia sobre los datos actuales.", extra: { name: selected } })}
          >
            Restaurar copia seleccionada
          </button>
        </Card>

        <Card title="Limpieza de registros" icon="🧹">
          <label>Eliminar registros anteriores a
            <select value={sec.purge_months} onChange={(e) => setSec({ purge_months: e.target.value })}>
              {["1 mes", "3 meses", "6 meses", "12 meses"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
          <button type="button" className="as-btn as-btn-info as-btn-block" onClick={() => askConfirm({ action: "cleanup_logs", title: "Ejecutar limpieza", text: `Se eliminarán los registros de auditoría de más de ${months} meses.`, extra: { months } })}>Ejecutar limpieza</button>
          <div className="as-note">Esta acción eliminará logs antiguos del sistema para liberar espacio en la base de datos.</div>
        </Card>

        <Card title="Versión y actualizaciones" icon="⬆️">
          <div className="as-row"><span>Versión actual</span><strong>{form.system?.version ?? "—"}</strong></div>
          <div className="as-row"><span>Última actualización</span><strong>{fmt(form.system?.updated_at ?? "")}</strong></div>
          <button type="button" className="as-btn as-btn-primary as-btn-block" onClick={() => notify("ok", "No hay un servicio de actualizaciones configurado.")}>Verificar actualizaciones</button>
        </Card>
      </div>

      <div className="as-grid as-grid-2b">
        <Card title="Historial de mantenimiento" icon="📜">
          {history.length === 0 ? (
            <Empty text="Sin registros." />
          ) : (
            <table className="as-table">
              <thead><tr><th>Fecha y hora</th><th>Acción</th><th>Descripción</th><th>Ejecutado por</th></tr></thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx}><td>{fmt(h.date)}</td><td>{h.action}</td><td>{h.target}</td><td>{h.admin}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Próximos mantenimientos" icon="🗓️">
          {sec.schedule.length === 0 ? (
            <Empty text="No hay mantenimientos programados." />
          ) : (
            <table className="as-table">
              <thead><tr><th>Fecha y hora</th><th>Descripción</th><th>Estado</th></tr></thead>
              <tbody>
                {sec.schedule.map((s: { start: string; end: string; description: string; status: string }, idx: number) => (
                  <tr key={idx}><td>{fmt(s.start)} – {fmt(s.end)}</td><td>{s.description}</td><td><span className="as-badge">{s.status}</span></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Footer busy={busy} save={save} reset={reset} />
    </>
  );
};
