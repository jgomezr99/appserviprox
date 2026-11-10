import React, { useCallback, useEffect, useState } from "react";
import { financeService } from "../../services/finance";
import { hiringService, type HiringDetail } from "../../services/hirings";
import AuthenticatedImage from "../../components/serviprox/AuthenticatedImage";
import { describeFailure, errorMessage, Notice, Pill, formatDateTime, money } from "../payments/shared";
import { AlertChip, StatusPill } from "./shared";

type Props = { orderId: number; onClose: () => void; onChanged?: () => void };
type Panel = null | "cancel" | "pqr";

const Section: React.FC<{ title: string; rows: Array<[string, React.ReactNode]> }> = ({ title, rows }) => (
  <div style={{ marginBottom: 16 }}>
    <h4 style={{ margin: "0 0 8px", color: "#0f172a" }}>{title}</h4>
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(120px, 38%) 1fr", gap: "6px 12px", margin: 0, fontSize: "0.88rem" }}>
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt style={{ color: "#64748b", fontWeight: 600 }}>{label}</dt>
          <dd style={{ margin: 0, color: "#0f172a", overflowWrap: "anywhere" }}>{value || "—"}</dd>
        </React.Fragment>
      ))}
    </dl>
  </div>
);

const field = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: "0.88rem", boxSizing: "border-box" } as const;

/** Detalle de una contratación leído de la base de datos, con las acciones del administrador. */
export const HiringDetailDialog: React.FC<Props> = ({ orderId, onClose, onChanged }) => {
  const [detail, setDetail] = useState<HiringDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [reason, setReason] = useState("");
  const [pqrType, setPqrType] = useState<"queja" | "reclamo" | "peticion">("queja");
  const [pqrText, setPqrText] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setDetail(await hiringService.detail(orderId));
      setError("");
    } catch (failure) {
      setError(describeFailure(failure) || "No se pudo cargar la contratación.");
    }
  }, [orderId]);

  useEffect(() => {
    setDetail(null);
    void load();
  }, [load]);

  const run = async (action: () => Promise<string>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const text = await action();
      setNotice({ kind: "ok", text });
      await load();
      onChanged?.();
      after?.();
    } catch (failure) {
      setNotice({ kind: "error", text: errorMessage(failure, "No se pudo completar la acción.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Detalle de la contratación"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }}>
      <div className="ad-card" style={{ width: "min(780px, 100%)", maxHeight: "92vh", overflowY: "auto", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Contratación #{orderId}</h3>
          <button type="button" className="ad-btn ad-btn-secondary" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>

        {error && <Notice kind="error">{error}</Notice>}
        {!detail && !error && <p>Cargando desde la base de datos...</p>}
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        {detail && (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <StatusPill status={detail.status} label={detail.status_label} />
              <Pill status={detail.payment_status} label={detail.payment_status_label} />
              {detail.alerts.map((a) => <AlertChip key={a} kind={a} />)}
              <strong style={{ marginLeft: "auto", fontSize: "1.15rem" }}>{detail.final_price != null ? money(detail.final_price) : "Valor por acordar"}</strong>
            </div>

            <Section title="Servicio" rows={[
              ["Servicio", `${detail.service} (${detail.category})`],
              ["Descripción", detail.description || detail.client_notes],
              ["Urgencia", detail.urgency],
              ["Dirección", detail.address],
              ["Creada", formatDateTime(detail.created_at)],
              ["Visita agendada", detail.scheduled_for ? formatDateTime(detail.scheduled_for) : ""],
              ["Rango publicado", detail.estimate_min != null ? `${money(detail.estimate_min)} — ${money(detail.estimate_max)}` : ""],
            ]} />
            <Section title="Cliente" rows={[["Nombre", detail.client.name], ["Correo", detail.client.email], ["Teléfono", detail.client.phone]]} />
            <Section title="Profesional" rows={[
              ["Nombre", detail.professional.name],
              ["Correo", detail.professional_detail.email],
              ["Teléfono", detail.professional_detail.phone],
              ["Calificación", detail.professional_detail.rating ? `★ ${detail.professional_detail.rating}` : "Sin calificaciones"],
              ["Trabajos completados", String(detail.professional_detail.jobs_completed)],
              ["Verificado", detail.professional_detail.verified ? "Sí" : "No"],
            ]} />
            <Section title="Pago y liquidación" rows={[
              ["Estado del pago", detail.payment_status_label],
              ["Referencia", detail.payment_reference],
              ["Pago confirmado", detail.payment_confirmed_at ? formatDateTime(detail.payment_confirmed_at) : ""],
              ["Comisión Serviprox", detail.commission_amount != null ? money(detail.commission_amount) : ""],
              ["Pago al profesional", detail.professional_amount != null ? money(detail.professional_amount) : ""],
              ["Liquidación al profesional", `${detail.payout_status_label}${detail.payout_settled_at ? ` · ${formatDateTime(detail.payout_settled_at)}` : ""}`],
            ]} />
            {detail.payments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 8px" }}>Transacciones</h4>
                {detail.payments.map((p) => (
                  <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: "0.85rem", padding: "4px 0" }}>
                    <Pill status={p.status} label={p.status_label} /><span>{p.method}</span>
                    <code>{p.reference}</code><strong style={{ marginLeft: "auto" }}>{money(p.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
            {detail.review && <Section title="Calificación del cliente" rows={[["Puntaje", `★ ${detail.review.rating} / 5`], ["Comentario", detail.review.comment]]} />}

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 8px" }}>Línea de tiempo</h4>
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: "0.86rem" }}>
                {detail.events.map((event, index) => (
                  <li key={`${event.created_at}-${index}`}>
                    <strong>{event.label}</strong> · {formatDateTime(event.created_at)} · <span style={{ color: "#64748b" }}>{event.by}</span>
                    {event.note && <div style={{ color: "#475569" }}>{event.note}</div>}
                  </li>
                ))}
              </ol>
            </div>

            {detail.evidence.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 8px" }}>Evidencias</h4>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {detail.evidence.map((item) => (
                    <AuthenticatedImage key={item.id} src={item.url} alt={item.caption || "Evidencia del trabajo"} style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 8px" }}>Notas internas</h4>
              {detail.notes.length === 0 && <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: "0.85rem" }}>Aún no hay notas. Solo las ve el equipo administrativo.</p>}
              {detail.notes.map((n) => (
                <div key={n.id} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: "0.85rem" }}>
                  {n.text}<div style={{ color: "#64748b", fontSize: "0.75rem" }}>{n.author} · {formatDateTime(n.created_at)}</div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8 }}>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar una nota interna" maxLength={1000} style={field} aria-label="Nota interna" />
                <button type="button" className="ad-btn ad-btn-secondary" disabled={busy || note.trim().length < 3}
                  onClick={() => void run(async () => { await hiringService.addNote(detail.id, note.trim()); return "Nota guardada."; }, () => setNote(""))}>
                  Guardar
                </button>
              </div>
            </div>

            {panel === "cancel" && (
              <div className="ad-card" style={{ padding: 12, marginBottom: 12, background: "#fff7ed" }}>
                <strong>Cancelar contratación</strong>
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la cancelación (obligatorio)" style={{ ...field, margin: "8px 0" }} aria-label="Motivo de la cancelación" />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="ad-btn ad-btn-secondary" onClick={() => setPanel(null)}>Volver</button>
                  <button type="button" className="ad-btn ad-btn-primary" disabled={busy || reason.trim().length < 5}
                    onClick={() => void run(async () => (await hiringService.cancel(detail.id, reason.trim())).detail, () => { setPanel(null); setReason(""); })}>
                    Confirmar cancelación
                  </button>
                </div>
              </div>
            )}
            {panel === "pqr" && (
              <div className="ad-card" style={{ padding: 12, marginBottom: 12, background: "#eff6ff" }}>
                <strong>Abrir PQR sobre esta contratación</strong>
                <select value={pqrType} onChange={(e) => setPqrType(e.target.value as typeof pqrType)} style={{ ...field, margin: "8px 0" }} aria-label="Tipo de PQR">
                  <option value="queja">Queja</option><option value="reclamo">Reclamo</option><option value="peticion">Petición</option>
                </select>
                <textarea rows={3} value={pqrText} onChange={(e) => setPqrText(e.target.value)} placeholder="Describe el caso (mínimo 10 caracteres)" style={{ ...field, marginBottom: 8 }} aria-label="Descripción del PQR" />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="ad-btn ad-btn-secondary" onClick={() => setPanel(null)}>Volver</button>
                  <button type="button" className="ad-btn ad-btn-primary" disabled={busy || pqrText.trim().length < 10}
                    onClick={() => void run(async () => `PQR ${(await hiringService.openPqr(detail.id, pqrType, pqrText.trim())).radicado_number} creado.`, () => { setPanel(null); setPqrText(""); })}>
                    Crear PQR
                  </button>
                </div>
              </div>
            )}

            {detail.cancel_blocked_reason && <Notice kind="error">{detail.cancel_blocked_reason}</Notice>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {detail.can_settle && (
                <button type="button" className="ad-btn ad-btn-primary" disabled={busy}
                  onClick={() => void run(async () => (await financeService.admin.settle({ order_ids: [detail.id] })).detail)}>
                  💼 Liquidar pago al profesional
                </button>
              )}
              <button type="button" className="ad-btn ad-btn-secondary" onClick={() => setPanel(panel === "pqr" ? null : "pqr")}>📝 Abrir PQR</button>
              {detail.can_cancel && (
                <button type="button" className="ad-btn ad-btn-secondary" onClick={() => setPanel(panel === "cancel" ? null : "cancel")}>🚫 Cancelar contratación</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HiringDetailDialog;
