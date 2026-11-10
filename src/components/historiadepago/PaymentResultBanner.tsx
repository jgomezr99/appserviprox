import React from "react";
import { resultBoxStyle, type PaymentResultStyle } from "../../services/paymentForm";

type Props = {
  kind: "approved" | "declined";
  result: PaymentResultStyle;
  onClose?: () => void;
};

/** Aviso de pago aprobado o rechazado con el diseño que definió el administrador. */
const PaymentResultBanner: React.FC<Props> = ({ kind, result, onClose }) => {
  const solid = result.style === "solid";
  return (
    <div
      role="status"
      className="sp-payment-result"
      style={{ ...resultBoxStyle(result), position: "relative", display: "block" }}
    >
      <strong style={{ color: solid ? "#ffffff" : result.color }}>
        {kind === "approved" ? "✔ " : "✖ "}
        {result.title}
      </strong>
      <p style={{ margin: "4px 0 0", color: solid ? "#ffffff" : "#1f2937" }}>{result.message}</p>
      {onClose && (
        <button
          type="button"
          aria-label="Cerrar aviso"
          onClick={onClose}
          style={{ position: "absolute", top: 8, right: 12, color: solid ? "#ffffff" : "#1f2937" }}
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default PaymentResultBanner;
