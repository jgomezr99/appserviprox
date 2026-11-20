import React, { Component, ErrorInfo, ReactNode } from "react";
import { IonPage } from "@ionic/react";
import AdminDashboard from "../admin/AdminDashboard";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class AdminErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error capturado en el Panel Administrativo:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            padding: "20px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "600px",
              width: "100%",
              background: "#ffffff",
              padding: "36px 28px",
              borderRadius: "16px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🛡️</div>
            <h2 style={{ color: "#0f172a", margin: "0 0 10px", fontSize: "1.4rem", fontWeight: 800 }}>
              Panel Administrativo de Serviprox
            </h2>
            <p style={{ color: "#64748b", margin: "0 0 20px", fontSize: "0.92rem", lineHeight: 1.5 }}>
              Ocurrió un error al cargar la vista administrativa:
              <br />
              <strong style={{ color: "#dc2626" }}>{this.state.error?.message || "Error inesperado"}</strong>
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("serviprox_demo_user");
                    localStorage.removeItem("serviprox_cached_user");
                  } catch {}
                  window.location.reload();
                }}
                style={{
                  background: "#1d4ed8",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🔄 Reiniciar sesión administrativa y recargar
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false })}
                style={{
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const StaffHome: React.FC = () => {
  return (
    <IonPage className="sp-admin-page" style={{ background: "#f8fafc", overflowY: "auto" }}>
      <AdminErrorBoundary>
        <AdminDashboard />
      </AdminErrorBoundary>
    </IonPage>
  );
};

export default StaffHome;
