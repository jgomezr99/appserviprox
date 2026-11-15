import React, { useState } from "react";
import { financeService, type FinanceReport } from "../../services/finance";
import { EmptyRow, KpiCard, Notice, Pill, errorMessage, formatDateTime, money } from "./shared";

const PREVIEW_ROWS = 50;

export const ReportsTab: React.FC = () => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const invalidRange = Boolean(from && to && from > to);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await financeService.admin.report(from, to));
    } catch (err) {
      setError(errorMessage(err, "No se pudo generar el reporte."));
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    setError("");
    try {
      const blob = await financeService.admin.reportCsv(from, to);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte-financiero-serviprox${from ? `-${from}` : ""}${to ? `-a-${to}` : ""}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, "No se pudo descargar el reporte."));
    }
  };

  return (
    <div>
      <div className="ad-card" style={{ padding: "16px 20px", marginBottom: "24px" }}>
        <p style={{ marginTop: 0, color: "#64748b", fontSize: "0.88rem" }}>
          Reporte de pagos confirmados con su comisión de Serviprox y el neto de cada profesional. Déjalo vacío para incluir todo el histórico.
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "grid", gap: "6px", fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
            Desde
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
          </label>
          <label style={{ display: "grid", gap: "6px", fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
            Hasta
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
          </label>
          <button type="button" className="ad-btn ad-btn-primary" disabled={loading || invalidRange} onClick={() => void generate()}>
            {loading ? "Generando..." : "Generar reporte"}
          </button>
          <button type="button" className="ad-btn ad-btn-secondary" disabled={invalidRange} onClick={() => void download()}>
            ⬇ Descargar CSV
          </button>
        </div>
        {invalidRange && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>La fecha inicial no puede ser posterior a la final.</p>}
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      {report && (
        <>
          <div className="ad-kpi-grid" style={{ marginBottom: "24px" }}>
            <KpiCard label="Órdenes pagadas" value={report.totals.orders} icon="🧾" tone="blue" />
            <KpiCard label="Recaudo bruto" value={money(report.totals.gross)} icon="✅" tone="teal" />
            <KpiCard label="Comisiones Serviprox" value={money(report.totals.commissions)} icon="🏷️" tone="purple" />
            <KpiCard label="Neto profesionales" value={money(report.totals.professionals)} icon="🏦" tone="orange" />
          </div>
          <div className="ad-card" style={{ padding: "16px 20px" }}>
            <div className="ad-table-responsive">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Fecha de pago</th>
                    <th>Orden</th>
                    <th>Profesional</th>
                    <th>Servicio</th>
                    <th>Bruto</th>
                    <th>Comisión</th>
                    <th>Neto</th>
                    <th>Liquidación</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <EmptyRow colSpan={8} loading={false} message="No hay pagos en el rango seleccionado." />
                  ) : (
                    report.rows.slice(0, PREVIEW_ROWS).map((r) => (
                      <tr key={r.order_id}>
                        <td>{formatDateTime(r.date)}</td>
                        <td>#{r.order_id}</td>
                        <td>{r.professional}</td>
                        <td>{r.service}</td>
                        <td>{money(r.gross)}</td>
                        <td>{money(r.commission)}</td>
                        <td style={{ fontWeight: 700 }}>{money(r.net)}</td>
                        <td>
                          <Pill status={r.payout_status} label={r.payout_status_label} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {report.rows.length > PREVIEW_ROWS && (
              <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
                Se muestran {PREVIEW_ROWS} de {report.rows.length} filas. Descarga el CSV para ver el reporte completo.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
