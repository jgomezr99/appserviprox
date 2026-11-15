import React, { useEffect, useState } from "react";
import { financeService, type PaymentRow } from "../../services/finance";
import PaymentDetailDialog from "./PaymentDetailDialog";
import { EmptyRow, FilterChips, KpiCard, Notice, Pager, Pill, errorMessage, formatDateTime, money, useRemote } from "./shared";

const STATUS_FILTERS: Array<[string, string]> = [
  ["all", "Todos"],
  ["approved", "Aprobados"],
  ["pending", "Pendientes"],
  ["declined", "Rechazados"],
  ["voided", "Anulados"],
  ["error", "Con error"],
  ["refunded", "Reembolsados"],
];

const PAGE_SIZE = 10;
const INITIAL: PaymentRow[] = [];

export const TransactionsTab: React.FC = () => {
  const { data: rows, loading, error, errorText, reload } = useRemote(financeService.admin.payments, INITIAL);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [verifying, setVerifying] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const sum = (status: string) => rows.filter((r) => r.status === status).reduce((acc, r) => acc + r.amount, 0);
  const failed = rows.filter((r) => r.status === "declined" || r.status === "error").length;

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.reference, r.user, r.method, r.professional, r.service].some((v) => v.toLowerCase().includes(q));
  });
  const start = (Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))) - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const verify = async (row: PaymentRow) => {
    setVerifying(row.id);
    setNotice(null);
    try {
      const result = await financeService.admin.verifyPayment(row.id);
      setNotice({ kind: "ok", text: result.detail });
      await reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err, "No se pudo verificar el pago.") });
    } finally {
      setVerifying(null);
    }
  };

  return (
    <div>
      <div className="ad-kpi-grid" style={{ marginBottom: "24px" }}>
        <KpiCard label="Transacciones" value={rows.length} icon="🧾" tone="blue" />
        <KpiCard label="Recaudado (aprobado)" value={money(sum("approved"))} icon="✅" tone="teal" />
        <KpiCard label="Pendiente de cobro" value={money(sum("pending"))} icon="⏳" tone="orange" />
        <KpiCard label="Rechazados o con error" value={failed} icon="⚠️" tone="purple" />
      </div>

      <div className="ad-card" style={{ padding: "16px 20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          <FilterChips options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Buscar por referencia, usuario, servicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: "260px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.88rem" }}
            />
            <button type="button" className="ad-btn ad-btn-secondary" onClick={() => void reload()}>
              ↻ Actualizar
            </button>
          </div>
        </div>

        {error && <Notice kind="error">No se pudieron cargar los pagos. {errorText || "Verifica la conexión con el servidor."}</Notice>}
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <div className="ad-table-responsive">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Referencia</th>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Profesional</th>
                <th>Método</th>
                <th>Descuento</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <EmptyRow
                  colSpan={10}
                  loading={loading}
                  message={rows.length === 0 ? "Aún no hay transacciones registradas." : "No hay pagos que coincidan con los filtros."}
                />
              ) : (
                visible.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.date)}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{r.reference}</td>
                    <td>#{r.order_id}</td>
                    <td>{r.user}</td>
                    <td>{r.professional}</td>
                    <td>{r.method}</td>
                    <td>{r.discount ? `-${money(r.discount)}` : "—"}</td>
                    <td style={{ fontWeight: 700 }}>{money(r.amount)}</td>
                    <td>
                      <Pill status={r.status} label={r.status_label} />
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button type="button" className="ad-btn ad-btn-secondary" onClick={() => setDetailId(r.id)}>
                        Ver detalle
                      </button>{" "}
                      {r.can_verify && (
                        <button type="button" className="ad-btn ad-btn-secondary" disabled={verifying === r.id} onClick={() => void verify(r)}>
                          {verifying === r.id ? "Verificando..." : "Verificar pago"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {detailId !== null && (
          <PaymentDetailDialog paymentId={detailId} onClose={() => setDetailId(null)} onChanged={() => void reload()} />
        )}

        <Pager page={page} total={filtered.length} pageSize={PAGE_SIZE} noun="pagos" onChange={setPage} />
      </div>
    </div>
  );
};
