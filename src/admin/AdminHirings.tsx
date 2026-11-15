import React, { useState } from "react";
import type { HiringAlertKey } from "../services/hirings";
import { ListTab } from "./hirings/ListTab";
import { RequestsTab } from "./hirings/RequestsTab";
import { SummaryTab } from "./hirings/SummaryTab";

type TabId = "summary" | "list" | "requests";

const TABS: Array<[TabId, string]> = [
  ["summary", "📊 Resumen"],
  ["list", "📅 Contrataciones"],
  ["requests", "🙋 Sin asignar o sin respuesta"],
];

/** Contrataciones: seguimiento de todas las órdenes de servicio de la plataforma, con datos de la base de datos. */
export const AdminHirings: React.FC = () => {
  const [tab, setTab] = useState<TabId>("summary");
  const [preset, setPreset] = useState<{ alert?: HiringAlertKey; status?: string; token: number }>({ token: 0 });
  const [requestKind, setRequestKind] = useState<string | undefined>();
  const [summaryKey, setSummaryKey] = useState(0);

  return (
    <section aria-label="Gestión de contrataciones">
      <div className="ad-view-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 className="ad-view-header-title">📅 Contrataciones</h2>
          <p className="ad-view-header-subtitle">
            Sigue cada servicio contratado, detecta los casos atrasados, asigna profesionales y gestiona cancelaciones y PQR.
          </p>
        </div>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            style={{
              padding: "9px 16px", borderRadius: 10, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer",
              border: tab === id ? "1px solid #2563eb" : "1px solid #e2e8f0",
              background: tab === id ? "#2563eb" : "#ffffff", color: tab === id ? "#ffffff" : "#475569",
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <SummaryTab
          key={summaryKey}
          onOpenList={(next) => { setPreset({ ...next, token: preset.token + 1 }); setTab("list"); }}
          onOpenRequests={(kind) => { setRequestKind(kind); setTab("requests"); }}
        />
      )}
      {tab === "list" && <ListTab preset={preset} />}
      {tab === "requests" && <RequestsTab initialKind={requestKind} onChanged={() => setSummaryKey((value) => value + 1)} />}
    </section>
  );
};

export default AdminHirings;
