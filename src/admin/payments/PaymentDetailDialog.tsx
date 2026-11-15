import React, { useEffect, useState } from "react";
import { financeService, type AdminPaymentDetail } from "../../services/finance";
import { downloadReceiptPdf, receiptNumber } from "../../components/historiadepago/receiptPdf";
import { Notice, Pill, describeFailure, errorMessage, formatDateTime, money } from "./shared";

type Props = { paymentId: number; onClose: () => void; onChanged?: () => void };

const Section: React.FC<{ title: string; rows: Array<[string, React.ReactNode]> }> = ({ title, rows }) => (
  <div style={{ marginBottom: 16 }}>
    <h4 style={{ margin: "0 0 8px", color: "#0f172a" }}>{title}</h4>
    <dl style={{ display: "grid", gridTemplateColumns: "minmax(120px, 40%) 1fr", gap: "6px 12px", margin: 0, fontSize: "0.88rem" }}>
      {rows.map(([label, value]) => (
        <React.Fragment key={label}>
          <dt style={{ color: "#64748b", fontWeight: 600 }}>{label}</dt>
          <dd style={{ margin: 0, color: "#0f172a", overflowWrap: "anywhere" }}>{value || "—"}</dd>
        </React.Fragment>
      ))}
    </dl>
  </div>
);

/** Detalle de un pago leído de la base de datos, con descarga del comprobante en PDF. */
export const PaymentDetailDialog: React.FC<Props> = ({ paymentId, onClose, onChanged }) => {
  const [detail, setDetail] = useState<AdminPaymentDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError("");
    financeService.admin
      .paymentDetail(paymentId)
      .then((data) => active && setDetail(data))
      .catch((failure) => active && setError(describeFailure(failure) || "No se pudo cargar el detalle del pago."));
    return () => {
      active = false;
    };
  }, [paymentId]);

  const download = async () => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await downloadReceiptPdf(detail);
    } catch (failure) {
      setNotice({ kind: "error", text: errorMessage(failure, "No se pudo generar el comprobante.") });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!detail || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await financeService.admin.verifyPayment(detail.id);
      setNotice({ kind: "ok", text: result.detail });
      setDetail(await financeService.admin.paymentDetail(detail.id));
      onChanged?.();
    } catch (failure) {
      setNotice({ kind: "error", text: errorMessage(failure, "No se pudo verificar el pago.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalle del pago"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 12 }}
    >
      <div className="ad-card" style={{ width: "min(720px, 100%)", maxHeight: "92vh", overflowY: "auto", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>
            Detalle del pago {detail ? receiptNumber(detail) : ""}
          </h3>
          <button type="button" className="ad-btn ad-btn-secondary" aria-label="Cerrar" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && <Notice kind="error">{error}</Notice>}
        {!detail && !error && <p>Cargando desde la base de datos...</p>}
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        {detail && (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
              <Pill status={detail.status} label={detail.status_label} />
              {detail.test_mode && <Pill status="pending" label="Pago de prueba" />}
              <strong style={{ marginLeft: "auto", fontSize: "1.2rem" }}>{money(detail.amount)}</strong>
            </div>

            <Section
              title="Pago"
              rows={[
                ["Referencia", detail.reference],
                ["Método", detail.method],
                ["Id de transacción", detail.transaction_id],
                ["Fecha de creación", formatDateTime(detail.created_at)],
                ["Pago confirmado", formatDateTime(detail.paid_at)],
                ["Última actualización", formatDateTime(detail.updated_at)],
              ]}
            />
            <Section
              title="Valores"
              rows={[
                ["Subtotal del servicio", money(detail.subtotal ?? detail.amount)],
                ["Descuento", detail.discount ? `-${money(detail.discount)}` : "$ 0"],
                ["Total pagado", money(detail.amount)],
                [
                  `Comisión Serviprox${detail.commission_rate != null ? ` (${detail.commission_rate}%)` : ""}`,
                  detail.commission_amount != null ? money(detail.commission_amount) : "Sin liquidar",
                ],
                ["Ganancia del profesional", detail.professional_amount != null ? money(detail.professional_amount) : "Sin liquidar"],
                ["Liquidación al profesional", detail.payout_status_label],
              ]}
            />
            <Section
              title="Cliente"
              rows={[
                ["Nombre", detail.client_name],
                ["Documento", detail.client_document],
                ["Teléfono", detail.client_phone],
                ["Correo", detail.client_email],
              ]}
            />
            <Section
              title="Servicio"
              rows={[
                ["Servicio", detail.service],
                ["Categoría", detail.service_category],
                ["Orden", `#${detail.order_id} · ${detail.order_status_label}`],
                ["Profesional", detail.professional],
                ["Correo del profesional", detail.professional_email],
                ["Dirección", detail.service_address],
                ["Visita agendada", detail.scheduled_for ? formatDateTime(detail.scheduled_for) : ""],
              ]}
            />

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {detail.can_verify && (
                <button type="button" className="ad-btn ad-btn-secondary" disabled={busy} onClick={() => void verify()}>
                  {busy ? "Verificando..." : "Verificar pago con Wompi"}
                </button>
              )}
              <button type="button" className="ad-btn ad-btn-primary" disabled={busy} onClick={() => void download()}>
                📄 Descargar comprobante PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentDetailDialog;
