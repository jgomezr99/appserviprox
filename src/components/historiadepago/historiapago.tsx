import React, { useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { useLocation } from "react-router-dom";
import { cardOutline, checkmarkCircleOutline, refreshOutline } from "ionicons/icons";
import { useAuth } from "../../context/AuthContext";
import { orderService } from "../../services/serviprox";
import type { Order } from "../../types/serviprox";
import "../../pages/RolePages.css";
import "../misreservas/misreserva.css";
import "./historiadepago.css";

const formatMoney = (value: string | null) => {
  if (!value) return "Monto por definir";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "Monto por definir";
  return amount.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
};

const paymentColor = (paymentStatus: Order["payment_status"]) =>
  paymentStatus === "paid" ? "success" : "warning";

const PaymentPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const orderId = useMemo(() => new URLSearchParams(location.search).get("order"), [location.search]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      if (orderId) {
        const order = await orderService.get(orderId);
        setSelectedOrder(order);
        setOrders([order]);
      } else {
        const payload = await orderService.list();
        setOrders(payload);
        setSelectedOrder(payload[0] || null);
      }
    } catch {
      setError("No pudimos cargar la información de pago.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [orderId]);

  const confirmPayment = async () => {
    if (!selectedOrder || processing) return;
    setProcessing(true);
    setError("");
    try {
      const nextOrder = await orderService.confirmDemoPayment(selectedOrder.id);
      setSelectedOrder(nextOrder);
      setOrders((current) =>
        current.map((order) => (order.id === nextOrder.id ? nextOrder : order))
      );
      setToast("Pago confirmado en modo desarrollo");
    } catch {
      setError("No pudimos confirmar el pago de esta orden.");
    } finally {
      setProcessing(false);
    }
  };

  const renderOrder = (order: Order) => (
    <article className="sp-card sp-payment-card" key={order.id}>
      <div className="sp-card-header">
        <div className="sp-card-title">
          <h2>Orden #{order.id}</h2>
          <p>{order.client_notes || "Servicio aceptado por el profesional."}</p>
        </div>
        <IonBadge color={paymentColor(order.payment_status)}>
          {order.payment_status_label}
        </IonBadge>
      </div>
      <div className="sp-request-meta">
        <span>
          <IonIcon icon={cardOutline} />
          {formatMoney(order.final_price || order.estimate_max || order.estimate_min)}
        </span>
        <span>
          <IonIcon icon={checkmarkCircleOutline} />
          {order.status_label}
        </span>
      </div>
      {order.payment_status === "pending" ? (
        <div className="sp-payment-demo">
          <p>
            Confirmación simulada para desarrollo/demo. No representa una pasarela
            real ni un cobro externo.
          </p>
          <IonButton
            className="sp-primary-button"
            onClick={confirmPayment}
            disabled={processing || selectedOrder?.id !== order.id}
          >
            {processing && selectedOrder?.id === order.id ? (
              <IonSpinner name="crescent" />
            ) : (
              "Confirmar pago demo"
            )}
          </IonButton>
        </div>
      ) : (
        <p className="sp-muted">
          Referencia: {order.payment_reference || "Confirmación registrada"}
        </p>
      )}
    </article>
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Pago de orden</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">CLIENTE</span>
            <h1>Pago de orden</h1>
            <p>El pago se registra sobre la orden aceptada, separado del estado de la solicitud.</p>
          </header>

          {user?.role !== "client" ? (
            <section className="sp-card sp-empty">
              Solo el cliente de la orden puede confirmar pagos.
            </section>
          ) : loading ? (
            <div className="sp-card sp-route-loading">
              <IonSpinner name="crescent" />
              <span>Cargando orden...</span>
            </div>
          ) : error ? (
            <section className="sp-card">
              <p className="sp-error">{error}</p>
              <IonButton onClick={() => void loadOrders()}>
                <IonIcon slot="start" icon={refreshOutline} />
                Reintentar
              </IonButton>
            </section>
          ) : selectedOrder ? (
            <section className="sp-payment-list">
              {orders.map(renderOrder)}
            </section>
          ) : (
            <section className="sp-card sp-empty">No tienes órdenes aceptadas para pagar.</section>
          )}
        </main>
        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={1800}
          onDidDismiss={() => setToast("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default PaymentPage;
