import React, { useState, useEffect } from "react";
import {
  IonButtons,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonTitle,
  IonToolbar,
  IonToast,
  IonBadge,
} from "@ionic/react";
import {
  giftOutline,
  star,
  walletOutline,
  checkmarkCircleOutline,
  sparkles,
  ribbonOutline,
  alertCircleOutline,
  arrowBackOutline,
} from "ionicons/icons";
import { useAuth } from "../context/AuthContext";
import { usePlatformSettings } from "../services/platformSettings";
import { useHistory } from "react-router-dom";
import "./RolePages.css";

interface BenefitItem {
  id: string | number;
  title: string;
  points: number;
  recharge: number;
  category: string;
  icon: string;
  level: "Todos" | "Bronce" | "Plata" | "Oro";
  description: string;
}

const DEFAULT_BENEFITS: BenefitItem[] = [
  {
    id: "ben-1",
    title: "Bono \$50.000 COP en Ferreterías Aliadas",
    points: 500,
    recharge: 50000,
    category: "Equipamiento",
    icon: "🛠️",
    level: "Todos",
    description: "Válido para compras de herramientas y materiales en ferreterías Homecenter o Constructor.",
  },
  {
    id: "ben-2",
    title: "Certificación y Recertificación RETIE",
    points: 1200,
    recharge: 100000,
    category: "Capacitaciones",
    icon: "📜",
    level: "Plata",
    description: "Descuento del 50% en el curso oficial de actualización de normas eléctricas y seguridad.",
  },
  {
    id: "ben-3",
    title: "Kit de Protección Personal (EPP)",
    points: 800,
    recharge: 60000,
    category: "Seguridad",
    icon: "🦺",
    level: "Bronce",
    description: "Casco dieléctrico, guantes de alta resistencia, gafas de seguridad y chaleco reflectivo.",
  },
  {
    id: "ben-4",
    title: "Recarga de Saldo de Cuenta \$100.000",
    points: 1000,
    recharge: 100000,
    category: "Financiero",
    icon: "💳",
    level: "Oro",
    description: "Saldo directo en tu billetera Serviprox para postularte a servicios premium y destacar tu perfil.",
  },
];

export const BenefitsPage: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const platform = usePlatformSettings();
  const benefitsEnabled = platform.features.benefits;

  const [userPoints, setUserPoints] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("serviprox_user_points");
      if (saved) return parseInt(saved, 10);
    } catch {}
    return 1250;
  });

  const [catalog, setCatalog] = useState<BenefitItem[]>(() => {
    try {
      const saved = localStorage.getItem("serviprox_benefits_catalog");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_BENEFITS;
  });

  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [toastMessage, setToastMessage] = useState("");
  const [redeemedIds, setRedeemedIds] = useState<Set<string | number>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem("serviprox_benefits_catalog");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCatalog(parsed);
        }
      }
    } catch {}
  }, []);

  const handleRedeem = (item: BenefitItem) => {
    if (userPoints < item.points) {
      setToastMessage(`Puntos insuficientes. Necesitas ${item.points} pts y tienes ${userPoints} pts.`);
      return;
    }
    const newPoints = userPoints - item.points;
    setUserPoints(newPoints);
    try {
      localStorage.setItem("serviprox_user_points", String(newPoints));
    } catch {}
    setRedeemedIds((prev) => new Set(prev).add(item.id));
    setToastMessage(`¡Felicidades! Has canjeado "${item.title}". Revisa tu correo para el código de canje.`);
  };

  // Si la función está desactivada por el administrador, bloquear vista
  if (!benefitsEnabled) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton autoHide={false} menu="main-menu" />
            </IonButtons>
            <IonTitle>Beneficios</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding sp-role-content">
          <div
            style={{
              maxWidth: "520px",
              margin: "60px auto",
              padding: "36px 24px",
              background: "#ffffff",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#fee2e2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: "2rem",
              }}
            >
              <IonIcon icon={alertCircleOutline} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>
              Módulo de Beneficios Desactivado
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "24px" }}>
              El programa de puntos e incentivos ha sido desactivado temporalmente por la administración de Serviprox.
            </p>
            <IonButton
              fill="solid"
              color="primary"
              onClick={() => history.push(user?.role === "professional" ? "/profesional/inicio" : "/cliente/inicio")}
              style={{ fontWeight: 700, borderRadius: "12px" }}
            >
              <IonIcon slot="start" icon={arrowBackOutline} /> Volver al Inicio
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const categories = ["Todos", ...Array.from(new Set(catalog.map((c) => c.category || "General")))];
  const filteredCatalog = selectedCategory === "Todos"
    ? catalog
    : catalog.filter((c) => c.category === selectedCategory);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>🎁 Programa de Beneficios</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page" style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px 16px" }}>
          {/* Header de bienvenida con saldo */}
          <header className="sp-role-header" style={{ marginBottom: "24px" }}>
            <span className="sp-role-kicker" style={{ color: "#2563eb", fontWeight: 700 }}>
              PROGRAMA DE FIDELIZACIÓN SERVIPROX
            </span>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#0f172a", margin: "6px 0 8px" }}>
              Tus Puntos y Recompensas
            </h1>
            <p style={{ color: "#64748b", margin: 0, fontSize: "0.95rem" }}>
              Acumula puntos completando servicios con alta calificación y canjéalos por equipamiento, capacitaciones y recargas.
            </p>
          </header>

          {/* Tarjetas de Puntos y Nivel */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            {/* Saldo de Puntos */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                borderRadius: "18px",
                padding: "22px",
                color: "#ffffff",
                boxShadow: "0 10px 20px -5px rgba(59, 130, 246, 0.35)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.9 }}>
                  Puntos Acumulados
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "6px" }}>
                  <h2 style={{ fontSize: "2.4rem", fontWeight: 900, margin: 0 }}>{userPoints.toLocaleString()}</h2>
                  <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>pts</span>
                </div>
              </div>
              <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <IonIcon icon={sparkles} style={{ fontSize: "1.2rem", color: "#fbbf24" }} />
                <span style={{ fontSize: "0.85rem", opacity: 0.95 }}>
                  Ganas 100 pts por cada servicio con calificación de 5 estrellas
                </span>
              </div>
            </div>

            {/* Nivel y Beneficio Extra */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                padding: "22px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Tu Nivel de Profesional
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                  <span style={{ fontSize: "1.8rem" }}>🥈</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 800, color: "#1e293b" }}>Nivel Plata</h3>
                    <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 600 }}>
                      +10% de visibilidad en el mapa
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Faltan <strong>750 pts</strong> para subir a <strong>Nivel Oro</strong>
                </span>
              </div>
            </div>

            {/* Billetera de Recargas */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                padding: "22px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                  Saldo Billetera Serviprox
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                  <IonIcon icon={walletOutline} style={{ fontSize: "2rem", color: "#059669" }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 900, color: "#065f46" }}>
                      \$50.000 COP
                    </h3>
                    <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Disponible para postulaciones</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage("Saldo activo para usar en contrataciones y servicios premium.")}
                style={{
                  marginTop: "14px",
                  padding: "8px 14px",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  borderRadius: "8px",
                  color: "#047857",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Ver movimientos
              </button>
            </div>
          </section>

          {/* Filtros de Categoría */}
          <div style={{ marginBottom: "20px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: selectedCategory === cat ? "#2563eb" : "#f1f5f9",
                  color: selectedCategory === cat ? "#ffffff" : "#475569",
                  boxShadow: selectedCategory === cat ? "0 4px 10px rgba(37,99,235,0.25)" : "none",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grilla de Catálogo de Beneficios */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "18px",
            }}
          >
            {filteredCatalog.map((item) => {
              const isRedeemed = redeemedIds.has(item.id);
              const canAfford = userPoints >= item.points;

              return (
                <article
                  key={item.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "18px",
                    border: "1px solid #e2e8f0",
                    padding: "20px",
                    boxShadow: "0 4px 8px -2px rgba(0, 0, 0, 0.04)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <span style={{ fontSize: "2rem" }}>{item.icon || "🎁"}</span>
                      <span
                        style={{
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: "12px",
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        Nivel: {item.level}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "1.08rem", fontWeight: 700, color: "#0f172a", margin: "0 0 8px", lineHeight: 1.35 }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 16px", lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                  </div>

                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Costo:</span>
                      <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#2563eb" }}>
                        ⭐ {item.points} pts
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isRedeemed || !canAfford}
                      onClick={() => handleRedeem(item)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        borderRadius: "10px",
                        border: "none",
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        cursor: isRedeemed || !canAfford ? "not-allowed" : "pointer",
                        background: isRedeemed
                          ? "#10b981"
                          : canAfford
                          ? "#2563eb"
                          : "#cbd5e1",
                        color: "#ffffff",
                        transition: "all 0.15s",
                      }}
                    >
                      {isRedeemed ? "✓ Canjeado" : canAfford ? "Canjear Beneficio" : "Puntos insuficientes"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </main>

        <IonToast
          isOpen={!!toastMessage}
          message={toastMessage}
          duration={3500}
          color="dark"
          onDidDismiss={() => setToastMessage("")}
        />
      </IonContent>
    </IonPage>
  );
};

export default BenefitsPage;

