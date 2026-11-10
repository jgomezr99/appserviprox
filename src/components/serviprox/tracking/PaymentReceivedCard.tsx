import React, { useState } from "react";
import { IonButton, IonIcon } from "@ionic/react";
import { downloadOutline, receiptOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { financeService } from "../../../services/finance";
import { downloadReceiptPdf } from "../../historiadepago/receiptPdf";
import { apiMessage } from "../../../utils/workflow";
import type { Order } from "../../../types/serviprox";

const money = (value: string) =>
  Number(value).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Props = { order: Order; isClient: boolean; onMessage: (text: string) => void };

/** Pago registrado de la orden: lo ven el cliente y el profesional; solo el cliente descarga el comprobante. */
const PaymentReceivedCard: React.FC<Props> = ({ order, isClient, onMessage }) => {
  const history = useHistory();
  const [busy, setBusy] = useState(false);
  const info = order.payment_info;
  if (!info) return null;

  const download = async () => {
    if (!info.receipt_id || busy) return;
    setBusy(true);
    try {
      const receipt = await financeService.clientReceipt(info.receipt_id);
      const incomplete = !receipt.client_document || !receipt.client_phone || receipt.client_name === receipt.client_email;
      if (incomplete) {
        // El historial pide los datos que faltan antes de generar el comprobante.
        onMessage("Completa tus datos para generar el comprobante.");
        history.push(`/cliente/historialpago?order=${order.id}`);
        return;
      }
      await downloadReceiptPdf(receipt);
    } catch (failure) {
      onMessage(apiMessage(failure, "No pudimos generar el comprobante en PDF."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tracking-card" aria-label="Pago recibido">
      <h2>{isClient ? "Pago realizado" : "Pago recibido del cliente"}</h2>
      <div className="tracking-summary-grid">
        <div><span>Valor pagado</span><strong>{money(info.amount)}</strong></div>
        {Number(info.discount) > 0 && (
          <div><span>Descuento aplicado</span><strong>-{money(info.discount)} (subtotal {money(info.subtotal)})</strong></div>
        )}
        <div><span>Método de pago</span><strong>{info.method}</strong></div>
        <div><span>Referencia</span><strong>{info.reference}</strong></div>
        {info.paid_at && (
          <div><span>Fecha del pago</span><strong>{new Date(info.paid_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</strong></div>
        )}
      </div>
      {isClient && info.receipt_id && (
        <>
          <IonButton className="sp-primary-button" disabled={busy} onClick={() => void download()}>
            <IonIcon slot="start" icon={downloadOutline} />
            {busy ? "Generando PDF..." : "Descargar comprobante PDF"}
          </IonButton>
          <IonButton fill="outline" routerLink={`/cliente/historialpago?order=${order.id}`}>
            <IonIcon slot="start" icon={receiptOutline} />
            Ver historial de pagos
          </IonButton>
        </>
      )}
    </section>
  );
};

export default PaymentReceivedCard;
