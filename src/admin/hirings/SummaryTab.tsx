import React from "react";
import { hiringService, type HiringAlertKey, type HiringSummary } from "../../services/hirings";
import { KpiCard, Notice, money, useRemote } from "../payments/shared";
import { ALERT_META, shortDate } from "./shared";

const EMPTY: HiringSummary | null = null;

const Bars: React.FC<{ values: Array<{ label: string; count: number }>; color: string; height?: number }> = ({ values, color, height = 140 }) => {
  const max = Math.max(1, ...values.map((v) => v.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height }} role="img" aria-label="Gráfica de contrataciones">
      {values.map((v) => (
        <div key={v.label} title={`${v.label}: ${v.count}`} style={{ flex: 1, minWidth: 3, height: `${Math.max(2, (v.count / max) * 100)}%`, background: v.count ? color : "#e2e8f0", borderRadius: "3px 3px 0 0" }} />
      ))}
    </div>
  );
};

type Props = {
  onOpenList: (preset: { alert?: HiringAlertKey; status?: string }) => void;
  onOpenRequests: (kind?: string) => void;
};

export const SummaryTab: React.FC<Props> = ({ onOpenList, onOpenRequests }) => {
  const { data, loading, error, errorText, reload } = useRemote<HiringSummary | null>(hiringService.summary, EMPTY);

  if (!data) {
    return error ? (
      <div>
        <Notice kind="error">No se pudo cargar el resumen de contrataciones. {errorText || "Verifica la conexión con el servidor."}</Notice>
        <button type="button" className="ad-btn ad-btn-secondary" onClick={() => void reload()}>↻ Reintentar</button>
      </div>
    ) : (
      <p>{loading ? "Cargando resumen de contrataciones..." : ""}</p>
    );
  }

  const stale = data.requests.awaiting_stale;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <span style={{ color: "#166534", fontWeight: 600, fontSize: "0.85rem" }}>
          ● Datos en vivo de la base de datos · actualizado {new Date(data.generated_at).toLocaleTimeString("es-CO")}
        </span>
        <button type="button" className="ad-btn ad-btn-secondary" onClick={() => void reload()}>↻ Actualizar</button>
      </div>

      <div className="ad-kpi-grid" style={{ marginBottom: 24, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        <KpiCard label="Contrataciones" value={data.total.toLocaleString("es-CO")} icon="📅" tone="blue" />
        <KpiCard label="En curso" value={data.active.toLocaleString("es-CO")} icon="🛠️" tone="orange" />
        <KpiCard label="Completadas" value={data.completed.toLocaleString("es-CO")} icon="✅" tone="teal" />
        <KpiCard label="Canceladas" value={data.cancelled.toLocaleString("es-CO")} icon="🚫" tone="purple" />
        <KpiCard label="Valor contratado" value={money(data.value_total)} icon="💰" tone="teal" />
        <KpiCard label="Ticket promedio" value={money(data.avg_ticket)} icon="🧾" tone="blue" />
      </div>

      {(data.alerts.length > 0 || data.requests.no_professional > 0 || stale > 0) && (
        <div className="ad-card" style={{ padding: "16px 20px", marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 12px" }}>Requiere atención</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {data.alerts.map((alert) => {
              const meta = ALERT_META[alert.key];
              return (
                <button key={alert.key} type="button" onClick={() => onOpenList({ alert: alert.key })}
                  style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, border: "1px solid #fde68a", background: meta.bg, color: meta.color, cursor: "pointer", fontWeight: 600 }}>
                  {meta.icon} {alert.count} · {alert.label} →
                </button>
              );
            })}
            {data.requests.no_professional > 0 && (
              <button type="button" onClick={() => onOpenRequests("no_professional")}
                style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, border: "1px solid #fecaca", background: "#fee2e2", color: "#991b1b", cursor: "pointer", fontWeight: 600 }}>
                🙋 {data.requests.no_professional} solicitud(es) abiertas sin profesional · asignar →
              </button>
            )}
            {stale > 0 && (
              <button type="button" onClick={() => onOpenRequests("awaiting")}
                style={{ textAlign: "left", padding: "10px 14px", borderRadius: 10, border: "1px solid #fde68a", background: "#fef3c7", color: "#92400e", cursor: "pointer", fontWeight: 600 }}>
                ⌛ {stale} solicitud(es) sin respuesta del profesional hace más de 24 horas · reasignar →
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 24 }}>
        <div className="ad-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 12px" }}>Contrataciones por día (últimos 30 días)</h3>
          <Bars values={data.daily.map((d) => ({ label: shortDate(d.date), count: d.count }))} color="#2563eb" />
          <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
            {data.daily[0] ? shortDate(data.daily[0].date) : ""} → hoy · {data.daily.reduce((a, d) => a + d.count, 0)} contrataciones
          </p>
        </div>
        <div className="ad-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 12px" }}>Contrataciones por mes</h3>
          <Bars values={data.monthly.map((m) => ({ label: m.month, count: m.count }))} color="#7c3aed" />
          <div style={{ display: "flex", gap: 3, marginTop: 6 }}>
            {data.monthly.map((m) => <small key={m.month} style={{ flex: 1, textAlign: "center", color: "#64748b" }}>{m.month.slice(5)}</small>)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        <div className="ad-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 12px" }}>Servicios más contratados</h3>
          {data.top_services.length === 0 ? <p style={{ color: "#64748b" }}>Aún no hay contrataciones.</p> : (
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              {data.top_services.map((s) => (
                <li key={s.name}><span>{s.name}</span> <strong style={{ float: "right" }}>{s.count}</strong></li>
              ))}
            </ol>
          )}
        </div>
        <div className="ad-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 12px" }}>Profesionales con más contrataciones</h3>
          {data.top_professionals.length === 0 ? <p style={{ color: "#64748b" }}>Aún no hay contrataciones.</p> : (
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
              {data.top_professionals.map((p) => (
                <li key={p.id}>
                  <span>{p.name}</span>{p.rating ? <small style={{ color: "#b45309" }}> ★ {p.rating}</small> : null}
                  <strong style={{ float: "right" }}>{p.count}</strong>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="ad-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 12px" }}>Por estado</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {Object.entries(data.by_status).map(([status, count]) => (
              <button key={status} type="button" onClick={() => onOpenList({ status })}
                style={{ display: "flex", justifyContent: "space-between", border: 0, background: "transparent", padding: "2px 0", cursor: "pointer", color: "#334155" }}>
                <span>{STATUS_LABEL[status] ?? status}</span><strong>{count}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Solicitadas", accepted: "Aceptadas", scheduled: "Agendadas", traveling: "En camino", arrived: "En el lugar",
  in_progress: "En ejecución", break: "En descanso", lunch: "En almuerzo", other_service: "Otro servicio",
  completed: "Completadas", cancelled: "Canceladas",
};
