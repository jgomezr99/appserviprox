import React, { useEffect, useState } from "react";
import { financeService, type WithdrawalRow } from "../../services/finance";
import { ActionDialog, EmptyRow, FilterChips, Notice, Pager, Pill, errorMessage, formatDateTime, money, useRemote } from "./shared";

const FILTERS: Array<[string, string]> = [
  ["open", "Por gestionar"],
  ["all", "Todos"],
  ["paid", "Transferidos"],
  ["rejected", "Rechazados"],
];

const PAGE_SIZE = 10;
const INITIAL: WithdrawalRow[] = [];

type Pending = { row: WithdrawalRow; action: "reject" | "pay" };

export const WithdrawalsTab: React.FC = () => {
  const { data: rows, loading, error, reload } = useRemote(financeService.admin.withdrawals, INITIAL);
  const [filter, setFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const filtered = rows.filter((r) =>
    filter === "all" ? true : filter === "open" ? r.status === "pending" || r.status === "approved" : r.status === filter
  );
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resolve = async (row: WithdrawalRow, action: "approve" | "reject" | "pay", values: Record<string, string> = {}) => {
    setBusy(true);
    setNotice(null);
    try {
      await financeService.admin.resolveWithdrawal(row.id, { action, reference: values.reference, note: values.note });
      setNotice({ kind: "ok", text: "Solicitud actualizada." });
      setDialog(null);
      await reload();
    } catch (err) {
      setNotice({ kind: "error", text: errorMessage(err, "No se pudo actualizar la solicitud.") });
      setDialog(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ad-card" style={{ padding: "16px 20px", marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <button type="button" className="ad-btn ad-btn-secondary" onClick={() => void reload()}>
          ↻ Actualizar
        </button>
      </div>

      {error && <Notice kind="error">No se pudieron cargar los retiros.</Notice>}
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <div className="ad-table-responsive">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Solicitud</th>
              <th>Profesional</th>
              <th>Valor</th>
              <th>Cuenta de destino</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <EmptyRow colSpan={6} loading={loading} message="No hay solicitudes de retiro en este filtro." />
            ) : (
              visible.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td>{r.professional}</td>
                  <td style={{ fontWeight: 700 }}>{money(r.amount)}</td>
                  <td>{r.destination}</td>
                  <td>
                    <Pill status={r.status} label={r.status_label} />
                    {r.transfer_reference && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Ref. {r.transfer_reference}</div>}
                    {r.note && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{r.note}</div>}
                  </td>
                  <td>
                    {r.status === "pending" || r.status === "approved" ? (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {r.status === "pending" && (
                          <button type="button" className="ad-btn ad-btn-secondary" disabled={busy} onClick={() => void resolve(r, "approve")}>
                            Aprobar
                          </button>
                        )}
                        <button type="button" className="ad-btn ad-btn-primary" disabled={busy} onClick={() => setDialog({ row: r, action: "pay" })}>
                          Marcar transferido
                        </button>
                        <button type="button" className="ad-btn ad-btn-danger" disabled={busy} onClick={() => setDialog({ row: r, action: "reject" })}>
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
      <Pager page={page} total={filtered.length} pageSize={PAGE_SIZE} noun="retiros" onChange={setPage} />

      {dialog?.action === "pay" && (
        <ActionDialog
          title={`Transferencia a ${dialog.row.professional}`}
          confirmLabel="Confirmar transferencia"
          busy={busy}
          fields={[
            { key: "reference", label: "Referencia de la transferencia", required: true },
            { key: "note", label: "Nota (opcional)", multiline: true },
          ]}
          onCancel={() => setDialog(null)}
          onConfirm={(values) => void resolve(dialog.row, "pay", values)}
        />
      )}
      {dialog?.action === "reject" && (
        <ActionDialog
          title={`Rechazar retiro de ${dialog.row.professional}`}
          confirmLabel="Rechazar retiro"
          busy={busy}
          fields={[{ key: "note", label: "Motivo del rechazo", required: true, multiline: true }]}
          onCancel={() => setDialog(null)}
          onConfirm={(values) => void resolve(dialog.row, "reject", values)}
        />
      )}
    </div>
  );
};
