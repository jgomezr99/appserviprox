import React, { useEffect, useState, useCallback } from "react";
import { IonButton, IonSpinner } from "@ionic/react";
import { checkBackendHealth } from "../services/api";

export const ConnectionBanner: React.FC = () => {
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  const testConnection = useCallback(async () => {
    setIsReconnecting(true);
    try {
      const res = await checkBackendHealth();
      if (res.ok) {
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
      const customEvent = event as CustomEvent<{ connected: boolean; url?: string }>;
      if (customEvent.detail?.connected === false) {
        setIsDisconnected(true);
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

  // Sondeo automático cada 4 segundos cuando está desconectado
  useEffect(() => {
    if (!isDisconnected) return;

    const interval = setInterval(() => {
      checkBackendHealth().then((res) => {
        if (res.ok) {
          setIsDisconnected(false);
          setJustReconnected(true);
          setTimeout(() => setJustReconnected(false), 3000);
        }
      });
    }, 4000);

    return () => clearInterval(interval);
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
          ? "Base de datos conectada correctamente"
          : "Servidor o base de datos desconectada"}
      </span>

      {isDisconnected && !justReconnected && (
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
      )}
    </div>
  );
};
