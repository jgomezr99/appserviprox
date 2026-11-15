import React, { useCallback, useEffect, useState } from "react";
import { hiringService, STATUS_OPTIONS, type HiringAlertKey, type HiringPage, type HiringRow } from "../../services/hirings";
import { describeFailure, EmptyRow, Notice, Pager, Pill, money } from "../payments/shared";
import HiringDetailDialog from "./HiringDetailDialog";
import { ALERT_META, AlertChip, StatusPill } from "./shared";

const PAGE_SIZE = 12;
const input = { padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.85rem", background: "#fff" } as const;

type Props = { preset: { alert?: HiringAlertKey; status?: string; token: number } };

export const ListTab: React.FC<Props> = ({ preset }) => {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(preset.status ?? "");
  const [payment, setPayment] = useState("");
  const [city, setCity] = useState("");
  const [alert, setAlert] = useState<string>(preset.alert ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HiringPage<HiringRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

  // Cuando llega un filtro desde el resumen, se aplica y se vuelve a la primera página.
  useEffect(() => {
    setStatus(preset.status ?? "");
    setAlert(preset.alert ?? "");
    setPage(1);
  }, [preset.token, preset.status, preset.alert]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await hiringService.list({ q, status, payment, city, alert, date_from: from, date_to: to, ordering, page, page_size: PAGE_SIZE }));
      setError("");
    } catch (failure) {
      setError(describeFailure(failure) || "No se pudieron cargar las contrataciones.");
    } finally {
      setLoading(false);
    }
  }, [q, status, payment, city, alert, from, to, ordering, page]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), q ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, q]);

  const reset = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <div className="ad-card" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input type="search" placeholder="Buscar por #orden, cliente, profesional, servicio o barrio" value={q} onChange={reset(setQ)} style={{ ...input, flex: "1 1 280px" }} aria-label="Buscar contrataciones" />
        <select value={status} onChange={reset(setStatus)} style={input} aria-label="Estado">
          {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={payment} onChange={reset(setPayment)} style={input} aria-label="Pago">
          <option value="">Todos los pagos</option>
          <option value="paid">Pagadas</option>
          <option value="pending">Pago pendiente</option>
          <option value="refunded">Reembolsadas</option>
        </select>
        <select value={alert} onChange={reset(setAlert)} style={input} aria-label="Alerta">
          <option value="">Todas las alertas</option>
          {(Object.keys(ALERT_META) as HiringAlertKey[]).map((key) => <option key={key} value={key}>{ALERT_META[key].short}</option>)}
        </select>
        <input type="text" placeholder="Ciudad" value={city} onChange={reset(setCity)} style={{ ...input, width: 130 }} aria-label="Ciudad" />
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem", color: "#64748b" }}>Desde
          <input type="date" value={from} onChange={reset(setFrom)} style={input} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8rem", color: "#64748b" }}>Hasta
          <input type="date" value={to} onChange={reset(setTo)} style={input} />
        </label>
        <select value={ordering} onChange={reset(setOrdering)} style={input} aria-label="Orden">
          <option value="-created_at">Más recientes</option>
          <option value="created_at">Más antiguas</option>
          <option value="-final_price">Mayor valor</option>
          <option value="final_price">Menor valor</option>
        </select>
        <button type="button" className="ad-btn ad-btn-secondary" onClick={() => void load()}>↻ Actualizar</button>
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="ad-table-responsive">
        <table className="ad-table">
          <thead>
            <tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Profesional</th><th>Servicio</th><th>Ciudad</th><th>Valor</th><th>Estado</th><th>Pago</th><th>Alertas</th><th></th></tr>
          </thead>
          <tbody>
            {!data || data.results.length === 0 ? (
              <EmptyRow colSpan={11} loading={loading && !data} message="No hay contrataciones que coincidan con los filtros." />
            ) : (
              data.results.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontWeight: 700 }}>#{row.id}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(row.created_at).toLocaleDateString("es-CO")}</td>
                  <td>{row.client.name}</td>
                  <td>{row.professional.name}</td>
                  <td>{row.service}</td>
                  <td>{row.city}{row.neighborhood ? <small style={{ display: "block", color: "#64748b" }}>{row.neighborhood}</small> : null}</td>
                  <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{row.final_price != null ? money(row.final_price) : "Por acordar"}</td>
                  <td><StatusPill status={row.status} label={row.status_label} /></td>
                  <td><Pill status={row.payment_status} label={row.payment_status_label} /></td>
                  <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{row.alerts.length ? row.alerts.map((a) => <AlertChip key={a} kind={a} />) : "—"}</div></td>
                  <td><button type="button" className="ad-btn ad-btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => setDetailId(row.id)}>Ver detalle</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager page={page} total={data?.count ?? 0} pageSize={PAGE_SIZE} noun="contrataciones" onChange={setPage} />

      {detailId !== null && (
        <HiringDetailDialog orderId={detailId} onClose={() => setDetailId(null)} onChanged={() => void load()} />
      )}
    </div>
  );
};
