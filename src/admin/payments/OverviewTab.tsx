import React, { useEffect, useState } from "react";
import { financeService, type FinanceSummary, type PaymentRow } from "../../services/finance";
import { KpiCard, Notice, Pill, formatDateTime, money, useRemote } from "./shared";

const EMPTY: FinanceSummary | null = null;
const NO_ROWS: PaymentRow[] = [];

const STATUS_LABELS: Array<[string, string, string]> = [
  ["approved", "Aprobados", "#15803d"],
  ["pending", "Pendientes", "#b45309"],
  ["declined", "Rechazados", "#b91c1c"],
  ["error", "Con error", "#b91c1c"],
  ["voided", "Anulados", "#475569"],
  ["refunded", "Reembolsados", "#475569"],
];

export const OverviewTab: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { data, loading, error, errorText, reload } = useRemote<FinanceSummary | null>(financeService.admin.summary, EMPTY);
  const { data: payments, reload: reloadPayments } = useRemote(financeService.admin.payments, NO_ROWS);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (data) setUpdatedAt(new Date());
  }, [data]);

  if (!data) {
    return error ? (
      <div>
        <Notice kind="error">
          No se pudo cargar el resumen financiero. {errorText || "Verifica la conexión con el servidor."}
        </Notice>
        <button type="button" className="ad-btn ad-btn-secondary" onClick={() => void reload()}>
          ↻ Reintentar
        </button>
      </div>
    ) : (
      <p>{loading ? "Cargando resumen financiero..." : ""}</p>
    );
  }

  const maxCollected = Math.max(1, ...data.series.map((item) => item.collected));
  const alerts: Array<[string, string, string]> = [];
  if (data.eligible_settlement_orders > 0)
    alerts.push(["payouts", `${data.eligible_settlement_orders} orden(es) listas para liquidar`, "💼"]);
  if (data.withdrawals_open_count > 0)
    alerts.push(["withdrawals", `${data.withdrawals_open_count} retiro(s) por revisar (${money(data.withdrawals_open_amount)})`, "🏦"]);
  if (data.refunds_open_count > 0)
    alerts.push(["refunds", `${data.refunds_open_count} reembolso(s) en revisión`, "↩️"]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
        <span style={{ color: "#166534", fontWeight: 600, fontSize: "0.85rem" }}>
          ● Conectado a la base de datos · {data.payments_total ?? 0} transacciones registradas
          {updatedAt ? ` · actualizado ${updatedAt.toLocaleTimeString("es-CO")}` : ""}
        </span>
        <button type="button" className="ad-btn ad-btn-secondary" onClick={() => { void reload(); void reloadPayments(); }}>
          ↻ Actualizar
        </button>
      </div>

      <div className="ad-kpi-grid" style={{ marginBottom: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
        <KpiCard label="Recaudado (aprobado)" value={money(data.collected)} icon="✅" tone="teal" />
        <KpiCard label="Pendiente de cobro" value={money(data.pending_collection)} icon="⏳" tone="orange" />
        <KpiCard label={`Comisiones Serviprox (${data.commission_rate}%)`} value={money(data.commissions)} icon="🏷️" tone="blue" />
        <KpiCard label="Pagado a profesionales" value={money(data.withdrawals_paid)} icon="🏦" tone="purple" />
        <KpiCard label="Por liquidar" value={money(data.pending_settlement)} icon="💼" tone="orange" />
        <KpiCard label="Liquidado (saldos)" value={money(data.settled)} icon="🧾" tone="teal" />
        <KpiCard label="Retiros en trámite" value={money(data.withdrawals_open_amount)} icon="🔄" tone="blue" />
        <KpiCard label="Reembolsado" value={money(data.refunds_total)} icon="↩️" tone="purple" />
        <KpiCard label="Descuentos otorgados" value={money(data.discounts_total)} icon="🎟️" tone="orange" />
      </div>

      {alerts.length > 0 && (
        <div className="ad-card" style={{ padding: "16px 20px", marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 12px" }}>Pendientes de gestión</h3>
          <div style={{ display: "grid", gap: "8px" }}>
            {alerts.map(([tab, text, icon]) => (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(tab)}
                style={{ textAlign: "left", padding: "10px 14px", borderRadius: "10px", border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", cursor: "pointer", fontWeight: 600 }}
              >
                {icon} {text} →
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ad-card" style={{ padding: "16px 20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0 }}>Últimas transacciones</h3>
          <button type="button" className="ad-btn ad-btn-secondary" onClick={() => onNavigate("transactions")}>
            Ver todas y su detalle →
          </button>
        </div>
        {payments.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>Aún no hay transacciones registradas.</p>
        ) : (
          <div className="ad-table-responsive">
            <table className="ad-table">
              <thead>
                <tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th>Método</th><th>Monto</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {payments.slice(0, 5).map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.date)}</td>
                    <td>{row.user}</td>
                    <td>{row.service}</td>
                    <td>{row.method}</td>
                    <td style={{ fontWeight: 700 }}>{money(row.amount)}</td>
                    <td><Pill status={row.status} label={row.status_label} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        <div className="ad-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 16px" }}>Recaudo y comisiones (últimos 6 meses)</h3>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", height: "160px" }}>
            {data.series.map((item) => (
              <div key={item.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                <div
                  title={`${item.month}: recaudo ${money(item.collected)} · comisión ${money(item.commissions)}`}
                  style={{ width: "100%", height: `${Math.max(2, (item.collected / maxCollected) * 100)}%`, background: "#bfdbfe", borderRadius: "6px 6px 0 0", position: "relative", overflow: "hidden" }}
                >
                  <div
                    style={{ position: "absolute", bottom: 0, width: "100%", height: `${item.collected ? (item.commissions / item.collected) * 100 : 0}%`, background: "#2563eb" }}
                  />
                </div>
                <small style={{ color: "#64748b", marginTop: "6px" }}>{item.month.slice(2)}</small>
              </div>
            ))}
          </div>
          <p style={{ margin: "12px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
            Barra clara: recaudo total · barra oscura: comisión de Serviprox.
          </p>
        </div>

        <div className="ad-card" style={{ padding: "16px 20px" }}>
          <h3 style={{ margin: "0 0 16px" }}>Transacciones por estado</h3>
          <div style={{ display: "grid", gap: "10px" }}>
            {STATUS_LABELS.map(([status, label, color]) => (
              <div key={status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#475569" }}>{label}</span>
                <strong style={{ color }}>{data.payments_by_status[status] ?? 0}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
