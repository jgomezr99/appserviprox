import React, { useState } from "react";
import { OverviewTab } from "./payments/OverviewTab";
import { PayoutsTab } from "./payments/PayoutsTab";
import { RefundsTab } from "./payments/RefundsTab";
import { ReportsTab } from "./payments/ReportsTab";
import { TransactionsTab } from "./payments/TransactionsTab";
import { WithdrawalsTab } from "./payments/WithdrawalsTab";

type TabId = "overview" | "transactions" | "payouts" | "withdrawals" | "refunds" | "reports";

const TABS: Array<[TabId, string]> = [
  ["overview", "📊 Resumen"],
  ["transactions", "🧾 Transacciones"],
  ["payouts", "💼 Liquidaciones y comisiones"],
  ["withdrawals", "🏦 Retiros"],
  ["refunds", "↩️ Reembolsos"],
  ["reports", "📄 Reportes"],
];

export const AdminPayments: React.FC<{ onOpenSettings?: () => void }> = ({ onOpenSettings }) => {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <section aria-label="Gestión de pagos e ingresos">
      <div
        className="ad-view-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}
      >
        <div>
          <h2 className="ad-view-header-title">💳 Gestión de pagos e ingresos</h2>
          <p className="ad-view-header-subtitle">
            Supervisa transacciones, liquida a los profesionales, gestiona retiros y reembolsos, y consulta las comisiones de Serviprox.
          </p>
        </div>
        {onOpenSettings && (
          <button type="button" className="ad-btn ad-btn-primary" onClick={onOpenSettings}>
            ⚙️ Métodos de pago y comisión
          </button>
        )}
      </div>

      <div role="tablist" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            style={{
              padding: "9px 16px",
              borderRadius: "10px",
              border: tab === id ? "1px solid #2563eb" : "1px solid #e2e8f0",
              background: tab === id ? "#2563eb" : "#ffffff",
              color: tab === id ? "#ffffff" : "#475569",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab onNavigate={(next) => setTab(next as TabId)} />}
      {tab === "transactions" && <TransactionsTab />}
      {tab === "payouts" && <PayoutsTab />}
      {tab === "withdrawals" && <WithdrawalsTab />}
      {tab === "refunds" && <RefundsTab />}
      {tab === "reports" && <ReportsTab />}
    </section>
  );
};

export default AdminPayments;
