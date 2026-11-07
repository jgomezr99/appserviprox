import React from "react";
import { IonModal, IonIcon } from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { CreditCard, CheckCircle2, ShieldCheck, Receipt, Download } from "lucide-react";
import { MekoPaymentRecord } from "../../data/storeStorage";

interface StorePaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: MekoPaymentRecord[];
}

export const StorePaymentHistoryModal: React.FC<StorePaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  payments,
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
              <CreditCard size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                Historia de Pagos de Productos
              </h3>
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
                Comprobantes de transacciones seguras procesadas con Wompi
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

        {/* Lista de Pagos */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {payments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 16px" }}>
              <Receipt size={48} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
              <h4 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                No hay pagos registrados
              </h4>
              <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                Cuando realices compras o pedidos a domicilio con Wompi, aparecerán aquí todos tus comprobantes bancarios.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {payments.map((pay) => (
                <div
                  key={pay.id}
                  style={{
                    background: "#f8fafc",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "10px",
                      borderBottom: "1px solid #e2e8f0",
                      paddingBottom: "8px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 800, fontSize: "0.92rem", color: "#0f172a" }}>
                          {pay.reference}
                        </span>
                        <span
                          style={{
                            background: "#dcfce7",
                            color: "#15803d",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: "10px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <CheckCircle2 size={12} /> {pay.status}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.76rem", color: "#64748b", marginTop: "2px", display: "block" }}>
                        {pay.date} · Pasarela: {pay.gateway}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#16a34a" }}>
                        ${pay.amount.toLocaleString("es-CO")} COP
                      </span>
                      <span style={{ display: "block", fontSize: "0.72rem", color: "#64748b" }}>
                        Método: {pay.method}
                      </span>
                    </div>
                  </div>

                  {/* Detalle del producto pagado */}
                  <div style={{ fontSize: "0.82rem", color: "#334155", marginBottom: "8px" }}>
                    <strong>Concepto:</strong> {pay.productNames}
                  </div>

                  <div style={{ fontSize: "0.78rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                    <span>Cliente: {pay.customerName} ({pay.city})</span>
                    <span>ID Pago: {pay.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </IonModal>
  );
};
