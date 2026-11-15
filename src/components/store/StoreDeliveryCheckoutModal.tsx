import React, { useState } from "react";
import {
  IonModal,
  IonIcon,
} from "@ionic/react";
import {
  closeOutline,
  checkmarkCircle,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import {
  Truck,
  CreditCard,
  CheckCircle,
  ShieldAlert,
  MapPin,
  Phone,
  User,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import {
  MekoCartItem,
  MekoOrder,
  MekoPaymentRecord,
  saveMekoOrder,
  saveMekoPayment,
} from "../../data/storeStorage";

interface StoreDeliveryCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MekoCartItem[];
  defaultCity?: string;
  onOrderSuccess: (order: MekoOrder) => void;
}

export const StoreDeliveryCheckoutModal: React.FC<StoreDeliveryCheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  defaultCity = "Bogotá",
  onOrderSuccess,
}) => {
  // Datos del formulario de envío
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+57 ");
  const [city, setCity] = useState(defaultCity);
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Método de pago Wompi
  const [paymentMethod, setPaymentMethod] = useState<
    "Nequi" | "Bancolombia" | "Tarjeta de Crédito / Débito" | "PSE" | "Daviplata"
  >("Nequi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<MekoOrder | null>(null);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal > 1000000 ? 0 : 15000;
  const total = subtotal + shippingFee;

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert("Por favor ingresa el nombre de quien recibe el pedido.");
      return;
    }
    if (!address.trim()) {
      alert("Por favor ingresa la dirección de entrega.");
      return;
    }
    if (!phone.trim() || phone.trim() === "+57") {
      alert("Por favor ingresa un número de teléfono de contacto.");
      return;
    }

    setIsProcessing(true);

    // Simulación de pasarela de pago Wompi segura
    setTimeout(() => {
      const orderRef = `WOMPI-MEKO-${Math.floor(10000 + Math.random() * 90000)}`;
      const orderId = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const txId = `TX-WOMPI-${Math.floor(1000000 + Math.random() * 9000000)}`;
      const nowStr = new Date().toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      const newOrder: MekoOrder = {
        id: orderId,
        reference: orderRef,
        date: nowStr,
        items: [...items],
        total,
        status: "Pagado con Wompi",
        paymentMethod: `Wompi (${paymentMethod})`,
        wompiTransactionId: txId,
        shippingAddress: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          address: address.trim(),
          notes: notes.trim(),
        },
      };

      const newPayment: MekoPaymentRecord = {
        id: `PAY-${Date.now()}`,
        orderId: newOrder.id,
        reference: orderRef,
        date: nowStr,
        amount: total,
        status: "Aprobado",
        gateway: "Wompi (Bancolombia)",
        method: paymentMethod,
        productNames: items.map((i) => `${i.title} (x${i.quantity})`).join(", "),
        customerName: fullName.trim(),
        customerPhone: phone.trim(),
        city: city.trim(),
      };

      saveMekoOrder(newOrder);
      saveMekoPayment(newPayment);

      setIsProcessing(false);
      setCompletedOrder(newOrder);
      onOrderSuccess(newOrder);
    }, 1500);
  };

  const handleFinish = () => {
    setCompletedOrder(null);
    setFullName("");
    setAddress("");
    setNotes("");
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleFinish}>
      <div
        style={{
          background: "#ffffff",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        {/* Cabecera del modal */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #e2e8f0",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Truck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                Pedido a Domicilio · Wompi
              </h3>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Pago Seguro Garantizado por Wompi Bancolombia
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <IonIcon icon={closeOutline} style={{ fontSize: "1.6rem" }} />
          </button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {completedOrder ? (
            /* Vista de Confirmación de Pedido Exitoso */
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: "68px",
                  height: "68px",
                  borderRadius: "50%",
                  background: "#dcfce7",
                  color: "#16a34a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <CheckCircle size={44} />
              </div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#0f172a", margin: "0 0 6px" }}>
                ¡Pago Aprobado y Pedido Confirmado!
              </h2>
              <p style={{ color: "#64748b", fontSize: "0.92rem", margin: "0 0 20px" }}>
                Tu transacción se procesó con éxito a través de <strong>Wompi</strong>. Hemos notificado al
                vendedor para preparar el despacho a tu dirección.
              </p>

              {/* Recibo digital */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  padding: "18px",
                  textAlign: "left",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Referencia Wompi:</span>
                  <strong style={{ color: "#0f172a", fontSize: "0.85rem" }}>{completedOrder.reference}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>ID de Pedido:</span>
                  <strong style={{ color: "#2563eb", fontSize: "0.85rem" }}>{completedOrder.id}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Método:</span>
                  <span style={{ color: "#0f172a", fontSize: "0.85rem", fontWeight: 600 }}>
                    {completedOrder.paymentMethod}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>Destino:</span>
                  <span style={{ color: "#0f172a", fontSize: "0.85rem" }}>
                    {completedOrder.shippingAddress.address}, {completedOrder.shippingAddress.city}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "10px",
                    borderTop: "1px dashed #cbd5e1",
                    fontSize: "1.1rem",
                    fontWeight: 900,
                  }}
                >
                  <span style={{ color: "#0f172a" }}>Total Pagado:</span>
                  <span style={{ color: "#16a34a" }}>${completedOrder.total.toLocaleString("es-CO")} COP</span>
                </div>
              </div>

              {/* Botón Cerrar y Ver Pedido */}
              <button
                type="button"
                onClick={handleFinish}
                style={{
                  width: "100%",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  padding: "14px",
                  borderRadius: "14px",
                  fontWeight: 800,
                  fontSize: "1rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                }}
              >
                Entendido · Ver en Historia de Pedidos
              </button>
            </div>
          ) : (
            /* Formulario de Checkout Wompi */
            <form onSubmit={handleSubmitPayment}>
              {/* Resumen de Productos */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                  padding: "14px",
                  marginBottom: "20px",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "0.76rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "#64748b",
                    marginBottom: "10px",
                  }}
                >
                  Productos a entregar ({items.reduce((s, i) => s + i.quantity, 0)})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        background: "#ffffff",
                        padding: "8px 12px",
                        borderRadius: "12px",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        style={{
                          width: "44px",
                          height: "44px",
                          objectFit: "contain",
                          borderRadius: "8px",
                          background: "#f8fafc",
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            color: "#0f172a",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.title}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                          Cant: {item.quantity} · {item.city}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: "#16a34a", fontSize: "0.92rem" }}>
                        ${(item.price * item.quantity).toLocaleString("es-CO")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Datos de Entrega */}
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 12px", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
                  📍 Dirección de Entrega en Colombia
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Nombre completo de quien recibe *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Pérez"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label
                        style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                      >
                        Ciudad / Municipio *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. Bogotá"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.9rem",
                          outline: "none",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                      >
                        Teléfono de contacto *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+57 300 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.9rem",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Dirección exacta (Calle, Carrera, Apto, Barrio) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Carrera 15 # 85-30, Apto 402, Chicó"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}
                    >
                      Instrucciones de entrega (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Timbre 402 / Dejar en portería"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.9rem",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Selector de Método de Pago Wompi */}
              <div style={{ marginBottom: "20px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>
                    💳 Pasarela de Pago Wompi
                  </h4>
                  <span
                    style={{
                      background: "#f0fdf4",
                      color: "#16a34a",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    🔒 Wompi by Bancolombia
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { id: "Nequi", label: "Nequi", color: "#4f46e5", badge: "Directo" },
                    { id: "Bancolombia", label: "Bancolombia", color: "#f59e0b", badge: "Transferencia" },
                    { id: "Tarjeta de Crédito / Débito", label: "Tarjeta Crédito / Débito", color: "#2563eb", badge: "Visa / MC" },
                    { id: "PSE", label: "PSE", color: "#0f766e", badge: "Todos los bancos" },
                    { id: "Daviplata", label: "Daviplata", color: "#dc2626", badge: "Celular" },
                  ].map((m) => {
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          padding: "10px 12px",
                          borderRadius: "12px",
                          background: isSelected ? "#eff6ff" : "#ffffff",
                          border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ fontSize: "0.85rem", fontWeight: 800, color: isSelected ? "#1d4ed8" : "#1e293b" }}>
                          {m.label}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                          {m.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Total y Resumen de Costos */}
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: "14px",
                  padding: "14px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#64748b", marginBottom: "6px" }}>
                  <span>Subtotal productos:</span>
                  <span>${subtotal.toLocaleString("es-CO")} COP</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#64748b", marginBottom: "8px" }}>
                  <span>Envío a domicilio:</span>
                  <span>{shippingFee === 0 ? "Gratis" : `$${shippingFee.toLocaleString("es-CO")} COP`}</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "8px",
                    borderTop: "1px solid #cbd5e1",
                    fontSize: "1.15rem",
                    fontWeight: 900,
                  }}
                >
                  <span style={{ color: "#0f172a" }}>Total a Pagar con Wompi:</span>
                  <span style={{ color: "#16a34a" }}>${total.toLocaleString("es-CO")} COP</span>
                </div>
              </div>

              {/* Aviso de Seguridad de Pago */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "12px",
                  padding: "12px",
                  marginBottom: "20px",
                  fontSize: "0.78rem",
                  color: "#166534",
                  lineHeight: 1.45,
                }}
              >
                <ShieldCheckmarkIcon size={18} />
                <div>
                  <strong>Pago Protegido Wompi:</strong> Tus fondos quedan retenidos de forma segura hasta que
                  recibas y verifiques el producto en tu domicilio. Cifrado bancario SSL 256 bits.
                </div>
              </div>

              {/* Botón Pagar con Wompi */}
              <button
                type="submit"
                disabled={isProcessing}
                style={{
                  width: "100%",
                  background: isProcessing ? "#94a3b8" : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  color: "#ffffff",
                  border: "none",
                  padding: "15px",
                  borderRadius: "14px",
                  fontWeight: 900,
                  fontSize: "1.05rem",
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  boxShadow: "0 6px 18px rgba(37,99,235,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {isProcessing ? (
                  "Procesando con Wompi..."
                ) : (
                  <>
                    <CreditCard size={20} />
                    Pagar con Wompi (${total.toLocaleString("es-CO")} COP)
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </IonModal>
  );
};

const ShieldCheckmarkIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#16a34a"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
