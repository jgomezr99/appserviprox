import React, { useEffect, useState } from "react";
import { financeService, type PayoutRow, type RefundRow } from "../../services/finance";
import { ActionDialog, EmptyRow, FilterChips, Notice, Pager, Pill, errorMessage, formatDateTime, money, useRemote } from "./shared";

const FILTERS: Array<[string, string]> = [
  ["requested", "En revisión"],
  ["all", "Todos"],
  ["approved", "Aprobados"],
  ["rejected", "Rechazados"],
];

const PAGE_SIZE = 10;
const INITIAL_REFUNDS: RefundRow[] = [];
const INITIAL_PAYOUTS: PayoutRow[] = [];

type Pending = { refund: RefundRow; action: "approve" | "reject" };

export const RefundsTab: React.FC = () => {
  const refunds = useRemote(financeService.admin.refunds, INITIAL_REFUNDS);
  const orders = useRemote(financeService.admin.payouts, INITIAL_PAYOUTS);
  const [filter, setFilter] = useState("requested");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Pending | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const filtered = refunds.data.filter((r) => (filter === "all" ? true : r.status === filter));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const refundable = orders.data.filter((o) => o.payout_status !== "refunded");

  const run = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await task();
      setNotice({ kind: "ok", text: success });
      await Promise.all([refunds.reload(), orders.reload()]);
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err, "No se pudo completar la acción.") });
    } finally {
      setBusy(false);
      setDialog(null);
      setCreating(false);
    }
  };

  return (
    <div className="ad-card" style={{ padding: "16px 20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" className="ad-btn ad-btn-secondary" onClick={() => void Promise.all([refunds.reload(), orders.reload()])}>
            ↻ Actualizar
          </button>
          <button type="button" className="ad-btn ad-btn-primary" onClick={() => setCreating(true)} disabled={refundable.length === 0}>
            + Nuevo reembolso
          </button>
        </div>
      </div>

      {refunds.error && <Notice kind="error">No se pudieron cargar los reembolsos.</Notice>}
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <div className="ad-table-responsive">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Orden</th>
              <th>Cliente</th>
              <th>Profesional</th>
              <th>Valor</th>
              <th>Motivo</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <EmptyRow colSpan={8} loading={refunds.loading} message="No hay reembolsos en este filtro." />
            ) : (
              visible.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td>#{r.order_id}</td>
                  <td>{r.client}</td>
                  <td>{r.professional}</td>
                  <td style={{ fontWeight: 700 }}>{money(r.amount)}</td>
                  <td>{r.reason}</td>
                  <td>
                    <Pill status={r.status} label={r.status_label} />
                    {r.note && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.note}</div>}
                  </td>
                  <td>
                    {r.status === "requested" ? (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <button type="button" className="ad-btn ad-btn-primary" disabled={busy} onClick={() => setDialog({ refund: r, action: "approve" })}>
                          Aprobar
                        </button>
                        <button type="button" className="ad-btn ad-btn-danger" disabled={busy} onClick={() => setDialog({ refund: r, action: "reject" })}>
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={filtered.length} pageSize={PAGE_SIZE} noun="reembolsos" onChange={setPage} />

      {creating && (
        <ActionDialog
          title="Nuevo reembolso"
          confirmLabel="Registrar reembolso"
          busy={busy}
          fields={[
            {
              key: "order",
              label: "Orden pagada",
              required: true,
              options: refundable.map((o) => [String(o.order_id), `#${o.order_id} · ${o.service} · ${o.client} · ${money(o.gross)}`]),
            },
            { key: "reason", label: "Motivo del reembolso", required: true, multiline: true },
          ]}
          onCancel={() => setCreating(false)}
          onConfirm={(values) =>
            void run(() => financeService.admin.createRefund(Number(values.order), values.reason), "Reembolso registrado; revísalo para aprobarlo.")
          }
        />
      )}
      {dialog?.action === "approve" && (
        <ActionDialog
          title={`Aprobar reembolso de ${money(dialog.refund.amount)}`}
          confirmLabel="Aprobar reembolso"
          busy={busy}
          fields={[{ key: "note", label: "Nota interna (opcional)", multiline: true }]}
          onCancel={() => setDialog(null)}
          onConfirm={(values) => void run(() => financeService.admin.resolveRefund(dialog.refund.id, { action: "approve", note: values.note }), "Reembolso aprobado.")}
        />
      )}
      {dialog?.action === "reject" && (
        <ActionDialog
          title="Rechazar reembolso"
          confirmLabel="Rechazar reembolso"
          busy={busy}
          fields={[{ key: "note", label: "Motivo del rechazo", required: true, multiline: true }]}
          onCancel={() => setDialog(null)}
          onConfirm={(values) => void run(() => financeService.admin.resolveRefund(dialog.refund.id, { action: "reject", note: values.note }), "Reembolso rechazado.")}
        />
      )}
    </div>
  );
};
