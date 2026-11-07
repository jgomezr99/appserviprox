import React from "react";
import { IonModal, IonIcon } from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { Package, Truck, Clock, CheckCircle2, MapPin, ExternalLink } from "lucide-react";
import { MekoOrder } from "../../data/storeStorage";

interface StoreOrderHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: MekoOrder[];
}

export const StoreOrderHistoryModal: React.FC<StoreOrderHistoryModalProps> = ({
  isOpen,
  onClose,
  orders,
}) => {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
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
        {/* Cabecera */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
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
              <Package size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                Historia de Pedidos
              </h3>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Seguimiento de tus compras a domicilio en Meko Shop
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <IonIcon icon={closeOutline} style={{ fontSize: "1.6rem" }} />
          </button>
        </div>

        {/* Lista de pedidos */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {orders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <Package size={48} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
              <h4 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                Aún no tienes pedidos registrados
              </h4>
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                Cuando pidas productos a domicilio con Wompi, podrás ver aquí el seguimiento y el estado de entrega.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {orders.map((order) => {
                const isPaid = order.status === "Pagado con Wompi";
                const isEnCamino = order.status === "En camino";
                const isEntregado = order.status === "Entregado";

                return (
                  <article
                    key={order.id}
                    style={{
                      background: "#f8fafc",
                      borderRadius: "16px",
                      border: "1px solid #e2e8f0",
                      padding: "16px",
                    }}
                  >
                    {/* Header pedido */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: "12px",
                        borderBottom: "1px solid #e2e8f0",
                        paddingBottom: "10px",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "0.76rem", color: "#64748b", display: "block" }}>
                          Pedido <strong>{order.id}</strong> · {order.date}
                        </span>
                        <span style={{ fontSize: "0.74rem", color: "#2563eb", fontWeight: 700 }}>
                          Ref. Wompi: {order.reference}
                        </span>
                      </div>

                      {/* Estado */}
                      <span
                        style={{
                          background: isEntregado ? "#dcfce7" : isEnCamino ? "#eff6ff" : "#fef3c7",
                          color: isEntregado ? "#16a34a" : isEnCamino ? "#2563eb" : "#d97706",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "0.76rem",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {isEntregado ? (
                          <CheckCircle2 size={13} />
                        ) : isEnCamino ? (
                          <Truck size={13} />
                        ) : (
                          <Clock size={13} />
                        )}
                        {order.status}
                      </span>
                    </div>

                    {/* Productos del pedido */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                      {order.items.map((it) => (
                        <div
                          key={it.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "10px",
                            border: "1px solid #f1f5f9",
                          }}
                        >
                          <img
                            src={it.image}
                            alt={it.title}
                            style={{
                              width: "40px",
                              height: "40px",
                              objectFit: "contain",
                              borderRadius: "6px",
                              background: "#f8fafc",
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "0.86rem",
                                fontWeight: 700,
                                color: "#0f172a",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {it.title}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                              Cantidad: {it.quantity} · Vendedor: {it.sellerName}
                            </div>
                          </div>
                          <div style={{ fontWeight: 800, color: "#16a34a", fontSize: "0.88rem" }}>
                            ${(it.price * it.quantity).toLocaleString("es-CO")}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Dirección de entrega */}
                    <div
                      style={{
                        background: "#ffffff",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid #f1f5f9",
                        fontSize: "0.8rem",
                        color: "#475569",
                        marginBottom: "12px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: 700, color: "#1e293b", marginBottom: "2px" }}>
                        <MapPin size={13} color="#2563eb" /> Entregar a: {order.shippingAddress.fullName} ({order.shippingAddress.phone})
                      </div>
                      <div>
                        {order.shippingAddress.address}, {order.shippingAddress.city}
                      </div>
                      {order.shippingAddress.notes && (
                        <div style={{ color: "#94a3b8", fontSize: "0.75rem", marginTop: "2px" }}>
                          Nota: {order.shippingAddress.notes}
                        </div>
                      )}
                    </div>

                    {/* Pie de pedido: Total y Método */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.85rem",
                      }}
                    >
                      <span style={{ color: "#64748b" }}>
                        Pagado mediante: <strong>{order.paymentMethod}</strong>
                      </span>
                      <span style={{ fontSize: "1.05rem", fontWeight: 900, color: "#16a34a" }}>
                        ${order.total.toLocaleString("es-CO")} COP
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </IonModal>
  );
};
