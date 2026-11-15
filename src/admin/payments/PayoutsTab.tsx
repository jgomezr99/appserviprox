import React, { useEffect, useState } from "react";
import { financeService, type PayoutRow } from "../../services/finance";
import { EmptyRow, FilterChips, Notice, Pager, Pill, errorMessage, formatDateTime, money, useRemote } from "./shared";

const FILTERS: Array<[string, string]> = [
  ["all", "Todas"],
  ["eligible", "Listas para liquidar"],
  ["pending", "Pendientes"],
  ["settled", "Liquidadas"],
  ["refunded", "Reembolsadas"],
];

const PAGE_SIZE = 10;
const INITIAL: PayoutRow[] = [];

export const PayoutsTab: React.FC = () => {
  const { data: rows, loading, error, reload } = useRemote(financeService.admin.payouts, INITIAL);
  const [filter, setFilter] = useState("eligible");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const eligible = rows.filter((r) => r.eligible);
  const filtered = rows.filter((r) => (filter === "all" ? true : filter === "eligible" ? r.eligible : r.payout_status === filter));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedEligible = selected.filter((id) => eligible.some((r) => r.order_id === id));

  const toggle = (id: number) =>
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  const settle = async (body: { order_ids: number[] } | { all: true }) => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await financeService.admin.settle(body);
      setNotice({ kind: "ok", text: result.detail });
      setSelected([]);
      await reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err, "No se pudo liquidar.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card" style={{ padding: "16px 20px", marginBottom: "24px" }}>
      <p style={{ marginTop: 0, color: "#64748b", fontSize: "0.88rem" }}>
        Un pago queda listo para liquidar cuando la orden está completada. Al liquidarlo, el valor neto pasa al saldo disponible del profesional.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" className="ad-btn ad-btn-secondary" disabled={busy || selectedEligible.length === 0} onClick={() => void settle({ order_ids: selectedEligible })}>
            Liquidar seleccionadas ({selectedEligible.length})
          </button>
          <button type="button" className="ad-btn ad-btn-primary" disabled={busy || eligible.length === 0} onClick={() => void settle({ all: true })}>
            Liquidar todas ({eligible.length})
          </button>
        </div>
      </div>

      {error && <Notice kind="error">No se pudieron cargar las liquidaciones.</Notice>}
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <div className="ad-table-responsive">
        <table className="ad-table">
          <thead>
            <tr>
              <th />
              <th>Pago</th>
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
            {visible.length === 0 ? (
              <EmptyRow colSpan={9} loading={loading} message="No hay órdenes en este filtro." />
            ) : (
              visible.map((r) => (
                <tr key={r.order_id}>
                  <td>
                    {r.eligible && (
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar orden ${r.order_id}`}
                        checked={selected.includes(r.order_id)}
                        onChange={() => toggle(r.order_id)}
                      />
                    )}
                  </td>
                  <td>{formatDateTime(r.date)}</td>
                  <td>
                    #{r.order_id}
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.order_status_label}</div>
                  </td>
                  <td>{r.professional}</td>
                  <td>{r.service}</td>
                  <td>{money(r.gross)}</td>
                  <td>
                    {money(r.commission)} <small style={{ color: "#64748b" }}>({r.commission_rate}%)</small>
                  </td>
                  <td style={{ fontWeight: 700 }}>{money(r.net)}</td>
                  <td>
                    <Pill status={r.payout_status} label={r.payout_status_label} />
                    {r.payout_settled_at && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{formatDateTime(r.payout_settled_at)}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={filtered.length} pageSize={PAGE_SIZE} noun="órdenes" onChange={setPage} />
    </div>
  );
};
