import React from "react";
import { IonModal, IonIcon } from "@ionic/react";
import { closeOutline, trashOutline } from "ionicons/icons";
import { ShoppingCart, ArrowRight, Plus, Minus, ShoppingBag } from "lucide-react";
import { MekoCartItem } from "../../data/storeStorage";

interface StoreCartDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MekoCartItem[];
  onUpdateQuantity: (productId: string | number, newQty: number) => void;
  onRemoveItem: (productId: string | number) => void;
  onCheckout: () => void;
}

export const StoreCartDrawerModal: React.FC<StoreCartDrawerModalProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <div
        style={{
          background: "#ffffff",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          maxWidth: "540px",
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
              <ShoppingCart size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                Carrito de Compras
              </h3>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                {totalCount} {totalCount === 1 ? "artículo" : "artículos"} seleccionados
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

        {/* Lista de productos o vacío */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <ShoppingBag size={30} />
              </div>
              <h4 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                Tu carrito está vacío
              </h4>
              <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "0.9rem" }}>
                Explora los productos de Meko Shop y agrégalos a tu carrito para pedir a domicilio.
              </p>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Explorar Productos
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    background: "#f8fafc",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    style={{
                      width: "60px",
                      height: "60px",
                      objectFit: "contain",
                      background: "#ffffff",
                      borderRadius: "10px",
                      padding: "4px",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#64748b", margin: "2px 0 4px" }}>
                      {item.category} · 📍 {item.city}
                    </div>
                    <div style={{ fontWeight: 800, color: "#16a34a", fontSize: "0.95rem" }}>
                      ${(item.price * item.quantity).toLocaleString("es-CO")} COP
                    </div>
                  </div>

                  {/* Controles de Cantidad */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.productId, item.quantity - 1)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#334155",
                      }}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ fontWeight: 800, fontSize: "0.88rem", minWidth: "18px", textAlign: "center" }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.productId, item.quantity + 1)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        color: "#334155",
                      }}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.productId)}
                      aria-label="Eliminar"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "4px",
                        marginLeft: "4px",
                      }}
                    >
                      <IonIcon icon={trashOutline} style={{ fontSize: "1.2rem" }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer con Total y Botón Proceder a Domicilio */}
        {items.length > 0 && (
          <div
            style={{
              padding: "16px 20px",
              borderTop: "1px solid #f1f5f9",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "14px",
              }}
            >
              <span style={{ fontSize: "0.95rem", color: "#64748b", fontWeight: 600 }}>Total Carrito:</span>
              <span style={{ fontSize: "1.35rem", fontWeight: 900, color: "#16a34a" }}>
                ${total.toLocaleString("es-CO")} COP
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCheckout();
              }}
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
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
              }}
            >
              Pedir a Domicilio · Pagar con Wompi <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </IonModal>
  );
};
