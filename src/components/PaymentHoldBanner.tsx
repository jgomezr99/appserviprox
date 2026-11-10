import React, { useCallback, useEffect, useState } from "react";
import { IonButton } from "@ionic/react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { financeService, formatMoney, type PaymentHold } from "../services/finance";

const REFRESH_MS = 60_000;
export const PAYMENT_CHANGED_EVENT = "serviprox:payment-changed";

/** Aviso fijo cuando la cuenta está suspendida por un servicio terminado sin pagar. */
export const PaymentHoldBanner: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const [hold, setHold] = useState<PaymentHold | null>(null);
  const role = user?.role;
  const applicable = isAuthenticated && (role === "client" || role === "professional");

  const refresh = useCallback(async () => {
    try {
      setHold(await financeService.paymentHold());
    } catch {
      setHold(null);
    }
  }, []);

  useEffect(() => {
    if (!applicable) {
      setHold(null);
      return undefined;
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onPaymentChanged = () => void refresh();
    window.addEventListener(PAYMENT_CHANGED_EVENT, onPaymentChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(PAYMENT_CHANGED_EVENT, onPaymentChanged);
    };
  }, [applicable, refresh, location.pathname]);

  if (!applicable || !hold?.hold) return null;

  const first = hold.orders[0];
  const isClient = hold.role === "client";
  const onPayPage = location.pathname.startsWith("/cliente/historialpago");

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 20000,
        width: "min(94vw, 560px)",
        background: "#7f1d1d",
        color: "#fff",
        borderRadius: 16,
        padding: "12px 16px",
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <strong style={{ display: "block" }}>Cuenta suspendida por pago pendiente</strong>
        <span style={{ fontSize: "0.85rem" }}>
          {hold.message}
          {first ? ` (${first.service} · ${formatMoney(first.amount)})` : ""}
        </span>
      </div>
      {isClient && first && !onPayPage && (
        <IonButton
          routerLink={`/cliente/historialpago?order=${first.order_id}`}
          color="light"
          size="small"
          style={{ fontWeight: 700 }}
        >
          Pagar ahora
        </IonButton>
      )}
    </div>
  );
};
