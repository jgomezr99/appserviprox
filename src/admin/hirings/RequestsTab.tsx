import React, { useCallback, useEffect, useState } from "react";
import { hiringService, type AssignableProfessional, type HiringPage, type OpenRequest } from "../../services/hirings";
import { describeFailure, errorMessage, EmptyRow, FilterChips, Notice, Pager, formatDateTime } from "../payments/shared";

const PAGE_SIZE = 10;
const KINDS: Array<[string, string]> = [["all", "Todas"], ["no_professional", "Sin profesional"], ["awaiting", "Esperando respuesta"]];

const waiting = (hours: number) => (hours >= 48 ? `${Math.floor(hours / 24)} días` : `${hours} h`);

const AssignDialog: React.FC<{ request: OpenRequest; onClose: () => void; onAssigned: (text: string) => void }> = ({ request, onClose, onAssigned }) => {
  const [options, setOptions] = useState<AssignableProfessional[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hiringService.professionalsFor(request.id).then(setOptions).catch((failure) => setError(describeFailure(failure) || "No se pudo cargar la lista."));
  }, [request.id]);

  const assign = async (professional: AssignableProfessional) => {
    setBusy(true);
    try {
      onAssigned((await hiringService.assign(request.id, professional.id)).detail);
    } catch (failure) {
      setError(errorMessage(failure, "No se pudo asignar el profesional."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Asignar profesional" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }}>
      <div className="ad-card" style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Asignar profesional · solicitud #{request.id}</h3>
          <button type="button" className="ad-btn ad-btn-secondary" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>
        <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "0.85rem" }}>
          {request.service} · {request.city}. El profesional elegido recibirá una notificación y deberá aceptar la solicitud.
        </p>
        {error && <Notice kind="error">{error}</Notice>}
        {!options && !error && <p>Buscando profesionales que ofrecen este servicio...</p>}
        {options && options.length === 0 && <p>No hay profesionales activos que ofrezcan este servicio.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {options?.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{p.name}</strong>{p.verified && <span title="Verificado"> ✔</span>}{p.current && <small style={{ color: "#b45309" }}> · actual</small>}
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  {p.rating ? `★ ${p.rating}` : "Sin calificaciones"} · {p.jobs_completed} trabajos · {p.city}
                  {p.distance_km != null ? ` · a ${p.distance_km} km` : ""}
                </div>
              </div>
              <button type="button" className="ad-btn ad-btn-primary" disabled={busy || p.current} onClick={() => void assign(p)}>
                {p.current ? "Asignado" : "Asignar"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const RequestsTab: React.FC<{ initialKind?: string; onChanged?: () => void }> = ({ initialKind, onChanged }) => {
  const [kind, setKind] = useState(initialKind ?? "all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HiringPage<OpenRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [assigning, setAssigning] = useState<OpenRequest | null>(null);

  useEffect(() => {
    setKind(initialKind ?? "all");
    setPage(1);
  }, [initialKind]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await hiringService.requests({ kind: kind === "all" ? undefined : kind, page, page_size: PAGE_SIZE }));
      setError("");
    } catch (failure) {
      setError(describeFailure(failure) || "No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }, [kind, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="ad-card" style={{ padding: "16px 20px" }}>
      <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "0.88rem" }}>
        Solicitudes abiertas que todavía no se convirtieron en contratación, de la más antigua a la más reciente.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <FilterChips options={KINDS} value={kind} onChange={(value) => { setKind(value); setPage(1); }} />
        <button type="button" className="ad-btn ad-btn-secondary" onClick={() => void load()}>↻ Actualizar</button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="ok">{notice}</Notice>}
      <div className="ad-table-responsive">
        <table className="ad-table">
          <thead><tr><th>#</th><th>Creada</th><th>Espera</th><th>Cliente</th><th>Servicio</th><th>Ciudad</th><th>Urgencia</th><th>Profesional</th><th></th></tr></thead>
          <tbody>
            {!data || data.results.length === 0 ? (
              <EmptyRow colSpan={9} loading={loading && !data} message="No hay solicitudes abiertas pendientes. ¡Todo al día!" />
            ) : data.results.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>#{r.id}</td>
                <td>{formatDateTime(r.created_at)}</td>
                <td style={{ color: r.hours_waiting >= 24 ? "#b91c1c" : undefined, fontWeight: r.hours_waiting >= 24 ? 700 : 400 }}>{waiting(r.hours_waiting)}</td>
                <td>{r.client.name}<small style={{ display: "block", color: "#64748b" }}>{r.client.phone || r.client.email}</small></td>
                <td>{r.service}<small style={{ display: "block", color: "#64748b" }}>{r.description.slice(0, 50)}</small></td>
                <td>{r.city}</td>
                <td>{r.urgency_label}</td>
                <td>{r.professional ? r.professional.name : <em style={{ color: "#b91c1c" }}>Sin profesional</em>}</td>
                <td><button type="button" className="ad-btn ad-btn-primary" onClick={() => setAssigning(r)}>{r.professional ? "Reasignar" : "Asignar"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={data?.count ?? 0} pageSize={PAGE_SIZE} noun="solicitudes" onChange={setPage} />
      {assigning && (
        <AssignDialog request={assigning} onClose={() => setAssigning(null)}
          onAssigned={(text) => { setNotice(text); setAssigning(null); void load(); onChanged?.(); }} />
      )}
    </div>
  );
};
