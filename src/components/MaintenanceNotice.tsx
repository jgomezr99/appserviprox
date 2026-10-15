import React from "react";
import { usePlatformSettings } from "../services/platformSettings";

/** Modo mantenimiento activo y mensaje definido por el administrador. */
export const useMaintenance = () => {
  const platform = usePlatformSettings();
  return { active: platform.features.maintenance, message: platform.maintenance_message };
};

export const MaintenanceNotice: React.FC = () => {
  const { active, message } = useMaintenance();
  if (!active) return null;
  return (
    <div
      role="alert"
      style={{
        padding: "12px 14px",
        borderRadius: "16px",
        background: "#fff7e6",
        border: "1px solid #ffd591",
        color: "#ad6800",
        fontSize: "0.88rem",
        fontWeight: 700,
        marginBottom: "12px",
      }}
    >
      🛠️ {message}
    </div>
  );
};
