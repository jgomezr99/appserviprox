import React, { useEffect, useState, useCallback } from "react";
import { IonButton, IonSpinner } from "@ionic/react";
import { checkBackendHealth, type ConnectionMode } from "../services/api";

const getReconnectedLabel = (mode: ConnectionMode | null): string => {
  switch (mode) {
    case "vm-direct":
      return "Máquina Virtual conectada correctamente";
    case "vm-proxy":
      return "Máquina Virtual conectada (proxy anti-CORS)";
    case "local-sqlite":
      return "Base de datos conectada (respaldo SQLite local)";
    default:
      return "Base de datos conectada correctamente";
  }
};

export const ConnectionBanner: React.FC = () => {
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode | null>(null);

  const testConnection = useCallback(async () => {
    setIsReconnecting(true);
    try {
      const res = await checkBackendHealth();
      if (res.ok) {
        setConnectionMode(res.mode || null);
        setIsDisconnected(false);
        setJustReconnected(true);
        setTimeout(() => setJustReconnected(false), 3000);
      } else {
        setIsDisconnected(true);
      }
    } catch {
      setIsDisconnected(true);
    } finally {
      setIsReconnecting(false);
    }
  }, []);

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const customEvent = event as CustomEvent<{
        connected: boolean;
        url?: string;
        mode?: ConnectionMode;
      }>;
      if (customEvent.detail?.mode) {
        setConnectionMode(customEvent.detail.mode);
      }
      if (customEvent.detail?.connected === false) {
        // En modo local-sqlite o desarrollo, revalidar salud en vez de desconectar de inmediato
        checkBackendHealth().then((health) => {
          if (health.ok) {
            setConnectionMode(health.mode || null);
            setIsDisconnected(false);
          } else {
            setIsDisconnected(true);
          }
        }).catch(() => {
          setIsDisconnected(true);
        });
      } else if (customEvent.detail?.connected === true) {
        setIsDisconnected((prev) => {
          if (prev) {
            setJustReconnected(true);
            setTimeout(() => setJustReconnected(false), 3000);
          }
          return false;
        });
      }
    };

    window.addEventListener("serviprox:connection-status", handleStatus);

    return () => {
      window.removeEventListener("serviprox:connection-status", handleStatus);
    };
  }, []);

  // Verifica la API y su conexión a la BD al abrir la app y mientras está visible.
  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      if (document.visibilityState === "hidden") return;
      const res = await checkBackendHealth();
      if (!active) return;
      if (res.ok) {
        if (res.mode) {
          setConnectionMode(res.mode);
        }
        setIsDisconnected((wasDisconnected) => {
          if (wasDisconnected) {
            setJustReconnected(true);
            setTimeout(() => setJustReconnected(false), 3000);
          }
          return false;
        });
      } else {
        setIsDisconnected(true);
      }
    };

    void checkConnection();
    const interval = window.setInterval(checkConnection, isDisconnected ? 4000 : 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [isDisconnected]);

  if (!isDisconnected && !justReconnected) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "12px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 16px",
        borderRadius: "24px",
        fontSize: "0.85rem",
        fontWeight: 700,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.22)",
        transition: "all 0.3s ease",
        background: justReconnected
          ? "#2e7d32"
          : "#c62828",
        color: "#ffffff",
      }}
      role="status"
      aria-live="polite"
    >
      <span style={{ fontSize: "1rem" }}>
        {justReconnected ? "✓" : "⚠️"}
      </span>
      <span>
        {justReconnected
          ? getReconnectedLabel(connectionMode)
          : "Servidor o base de datos desconectada"}
      </span>

      {isDisconnected && !justReconnected && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <IonButton
            fill="clear"
            size="small"
            onClick={testConnection}
            disabled={isReconnecting}
            style={{
              "--color": "#ffffff",
              margin: 0,
              textDecoration: "underline",
              textTransform: "none",
              fontWeight: 800,
              fontSize: "0.82rem",
            }}
          >
            {isReconnecting ? (
              <>
                <IonSpinner name="crescent" style={{ width: "14px", height: "14px", marginRight: "4px" }} />
                Conectando...
              </>
            ) : (
              "Reintentar ahora"
            )}
          </IonButton>
          <IonButton
            fill="clear"
            size="small"
            onClick={() => window.dispatchEvent(new CustomEvent("serviprox:open-server-modal"))}
            style={{
              "--color": "#ffd54f",
              margin: 0,
              textDecoration: "underline",
              textTransform: "none",
              fontWeight: 800,
              fontSize: "0.82rem",
            }}
          >
            🔌 Cambiar BD
          </IonButton>
        </div>
      )}
    </div>
  );
};
