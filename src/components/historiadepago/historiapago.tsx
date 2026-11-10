import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonModal,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { useLocation } from "react-router-dom";
import {
  cardOutline,
  checkmarkCircleOutline,
  closeOutline,
  printOutline,
  receiptOutline,
  refreshOutline,
} from "ionicons/icons";
import { useAuth } from "../../context/AuthContext";
import { orderService } from "../../services/serviprox";
import { usePlatformSettings } from "../../services/platformSettings";
import { apiMessage } from "../../utils/workflow";
import {
  financeService,
  formatDate,
  formatMoney as formatCop,
  type ClientPaymentRow,
  type PaymentStatus,
} from "../../services/finance";
import type { Order } from "../../types/serviprox";
import "../../pages/RolePages.css";
import "../finanzas/finanzas.css";

import "./historiadepago.css";
import ServiceProgress from "../serviprox/ServiceProgress";
import ServiceButtonContent from "../serviprox/ServiceButtonContent";

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
  paymentStatus === "paid" ? "success" : paymentStatus === "refunded" ? "medium" : "warning";

const historyColor = (status: PaymentStatus) =>
  status === "approved"
    ? "success"
    : status === "pending"
      ? "warning"
      : status === "refunded"
        ? "medium"
        : "danger";

const HISTORY_FILTERS: Array<[string, string]> = [
  ["all", "Todos"],
  ["approved", "Aprobados"],
  ["pending", "Pendientes"],
  ["declined", "Rechazados"],
  ["refunded", "Reembolsados"],
];

const PaymentPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { test_payment_enabled: testPaymentEnabled } = usePlatformSettings();
  const showDemoPayment = import.meta.env.DEV || testPaymentEnabled === true;
  const orderId = useMemo(() => new URLSearchParams(location.search).get("order"), [location.search]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [history, setHistory] = useState<ClientPaymentRow[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [receipt, setReceipt] = useState<ClientPaymentRow | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await financeService.clientHistory());
      setHistoryError(false);
    } catch {
      setHistoryError(true);
    }
  }, []);

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
        setSelectedOrder(payload.find((order) => order.payment_status === "pending") || payload[0] || null);
      }
    } catch {
      setError("No pudimos cargar la información de pago.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
    void loadHistory();
  }, [orderId, loadHistory]);

  // Wompi confirma por webhook: tras volver del checkout se consulta unos segundos.
  useEffect(() => {
    if (!orderId || selectedOrder?.payment_status !== "pending") return;
    let tries = 0;
    const timer = window.setInterval(async () => {
      tries += 1;
      try {
        const next = await orderService.get(orderId);
        setSelectedOrder(next);
        setOrders([next]);
        if (next.payment_status === "paid" || tries >= 6) {
          window.clearInterval(timer);
          void loadHistory();
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [orderId, selectedOrder?.payment_status, loadHistory]);

  const payWithWompi = async (target: Order) => {
    if (processing) return;
    setProcessing(true);
    try {
      const { checkout_url } = await orderService.wompiCheckout(target.id);
      if (!checkout_url.startsWith("https://checkout.wompi.co/")) {
        throw new Error("URL de pago inválida");
      }
      window.location.href = checkout_url;
    } catch (err) {
      setToast(apiMessage(err, "No pudimos iniciar el pago."));
      setProcessing(false);
    }
  };

  const confirmPayment = async (target: Order) => {
    if (processing) return;
    setProcessing(true);
    setError("");
    try {
      const nextOrder = await orderService.confirmDemoPayment(target.id);
      setSelectedOrder(nextOrder);
      setOrders((current) =>
        current.map((order) => (order.id === nextOrder.id ? nextOrder : order))
      );
      setToast("Pago confirmado en modo desarrollo");
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No pudimos confirmar el pago de esta orden.");
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
          {formatMoney(order.final_price)}
        </span>
        <span>
          <IonIcon icon={checkmarkCircleOutline} />
          {order.status_label}
        </span>
      </div>
      <ServiceProgress status={order.status} />
      {order.payment_status === "pending" && order.status !== "completed" ? (
        <p className="sp-muted">
          El pago se habilita cuando el profesional termine el trabajo. Si el servicio termina
          sin pago, tu cuenta y la del profesional quedan suspendidas hasta que pagues.
        </p>
      ) : order.payment_status === "pending" ? (
        <div className="sp-payment-demo">
          {!order.final_price && <p>El profesional debe registrar el valor acordado antes de iniciar el pago.</p>}
          <IonButton
            className="sp-primary-button"
            onClick={() => void payWithWompi(order)}
            disabled={processing || order.status !== "completed" || !order.final_price}
          >
            <ServiceButtonContent busy={processing} icon={cardOutline}
              label="Pagar con Wompi" busyLabel="Procesando..." />
          </IonButton>
          {showDemoPayment && (
            <>
              <p>Confirmación simulada para pruebas. No genera un cobro real.</p>
              <IonButton fill="outline" onClick={() => void confirmPayment(order)} disabled={processing}>
                Confirmar pago demo
              </IonButton>
            </>
          )}
        </div>
      ) : (
        <p className="sp-muted">
          Referencia: {order.payment_reference || "Confirmación registrada"}
        </p>
      )}
      <IonButton fill="outline" routerLink={`/seguimiento/${order.id}`}>Volver al seguimiento</IonButton>
    </article>
  );

  // Solo se cobran servicios ya terminados; con ?order= se muestra esa orden aunque aún no aplique.
  const pendingOrders = orders.filter(
    (order) => order.payment_status === "pending" && order.status === "completed"
  );
  const focusedOrder = orderId && selectedOrder ? selectedOrder : null;

  const filteredHistory = history.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [row.service, row.professional, row.reference, row.method].some((value) =>
      value.toLowerCase().includes(query)
    );
  });
  const totalPaid = history
    .filter((row) => row.status === "approved")
    .reduce((sum, row) => sum + row.amount, 0);

  return (
    <IonPage className="sp-service-flow">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Historial de pagos</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">CLIENTE</span>
            <h1>Historial de pagos</h1>
            <p>Consulta los servicios contratados, tus pagos, su estado y descarga tus comprobantes.</p>
          </header>

          {user?.role !== "client" ? (
            <section className="sp-card sp-empty">
              Solo el cliente de la orden puede consultar sus pagos.
            </section>
          ) : (
            <>
              {loading ? (
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
              ) : pendingOrders.length > 0 || focusedOrder ? (
                <section className="sp-payment-list">
                  <h2 className="fin-section-title">Pagos por realizar</h2>
                  {(focusedOrder ? [focusedOrder] : pendingOrders).map(renderOrder)}
                </section>
              ) : null}

              <section className="fin-kpis" aria-label="Resumen de pagos">
                <div className="sp-card fin-kpi">
                  <span>Total pagado</span>
                  <strong>{formatCop(totalPaid)}</strong>
                </div>
                <div className="sp-card fin-kpi">
                  <span>Pagos realizados</span>
                  <strong>{history.filter((row) => row.status === "approved").length}</strong>
                </div>
                <div className="sp-card fin-kpi">
                  <span>Pendientes</span>
                  <strong>{history.filter((row) => row.status === "pending").length}</strong>
                </div>
              </section>

              <section className="sp-card fin-history">
                <div className="fin-toolbar">
                  <h2 className="fin-section-title">Transacciones</h2>
                  <IonButton fill="clear" size="small" onClick={() => void loadHistory()}>
                    <IonIcon slot="start" icon={refreshOutline} />
                    Actualizar
                  </IonButton>
                </div>
                <div className="fin-filters">
                  {HISTORY_FILTERS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`fin-chip ${statusFilter === value ? "is-active" : ""}`}
                      onClick={() => setStatusFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                  <input
                    type="search"
                    className="fin-search"
                    placeholder="Buscar por servicio, profesional o referencia"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Buscar pagos"
                  />
                </div>

                {historyError && (
                  <p className="sp-error">No pudimos cargar tu historial de pagos.</p>
                )}

                {filteredHistory.length === 0 ? (
                  <p className="sp-muted fin-empty">
                    {history.length === 0
                      ? "Aún no has realizado pagos."
                      : "No hay pagos que coincidan con el filtro."}
                  </p>
                ) : (
                  <div className="fin-table-wrap">
                    <table className="fin-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Servicio</th>
                          <th>Valor</th>
                          <th>Método</th>
                          <th>Estado</th>
                          <th>Referencia</th>
                          <th>Comprobante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((row) => (
                          <tr key={row.id}>
                            <td data-label="Fecha">{formatDate(row.date)}</td>
                            <td data-label="Servicio">
                              <strong>{row.service}</strong>
                              <small>
                                {row.professional} · Orden #{row.order_id}
                              </small>
                            </td>
                            <td data-label="Valor">{formatCop(row.amount)}</td>
                            <td data-label="Método">{row.method}</td>
                            <td data-label="Estado">
                              <IonBadge color={historyColor(row.status)}>{row.status_label}</IonBadge>
                            </td>
                            <td data-label="Referencia" className="fin-mono">
                              {row.reference}
                            </td>
                            <td data-label="Comprobante">
                              {row.receipt_available ? (
                                <IonButton fill="outline" size="small" onClick={() => setReceipt(row)}>
                                  <IonIcon slot="start" icon={receiptOutline} />
                                  Ver
                                </IonButton>
                              ) : (
                                <span className="sp-muted">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </main>

        <IonModal isOpen={!!receipt} onDidDismiss={() => setReceipt(null)} className="fin-receipt-modal">
          <IonHeader>
            <IonToolbar>
              <IonTitle>Comprobante de pago</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setReceipt(null)} aria-label="Cerrar">
                  <IonIcon icon={closeOutline} />
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {receipt && (
              <div className="fin-receipt" id="fin-receipt-print">
                <h2>Serviprox</h2>
                <p className="sp-muted">Comprobante de pago · {receipt.reference}</p>
                <dl>
                  <dt>Estado</dt>
                  <dd>{receipt.status_label}</dd>
                  <dt>Fecha de la transacción</dt>
                  <dd>{formatDate(receipt.date)}</dd>
                  <dt>Cliente</dt>
                  <dd>
                    {receipt.client_name} ({receipt.client_email})
                  </dd>
                  <dt>Servicio contratado</dt>
                  <dd>
                    {receipt.service} · Orden #{receipt.order_id}
                  </dd>
                  <dt>Profesional</dt>
                  <dd>{receipt.professional}</dd>
                  <dt>Método de pago</dt>
                  <dd>{receipt.method}</dd>
                  <dt>Valor pagado</dt>
                  <dd className="fin-receipt-total">{formatCop(receipt.amount)}</dd>
                </dl>
                <IonButton expand="block" className="sp-primary-button fin-no-print" onClick={() => window.print()}>
                  <IonIcon slot="start" icon={printOutline} />
                  Imprimir o guardar como PDF
                </IonButton>
              </div>
            )}
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={3500}
          onDidDismiss={() => setToast("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default PaymentPage;
